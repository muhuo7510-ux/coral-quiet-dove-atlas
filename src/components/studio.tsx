import { useEffect, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  ChevronDown,
  Clapperboard,
  Copy,
  Download,
  LoaderCircle,
  ScanText,
  Square,
  Upload,
} from "lucide-react";
import { assetUrl } from "@/lib/asset-url";
import {
  buildSrt,
  buildTxt,
  countFrames,
  formatStamp,
  SAMPLE_FPS,
  transcribeVideo,
  type Engine,
  type LayoutMode,
  type Region,
  type ScanStatus,
  type Segment,
} from "@/lib/transcribe";

const LANGS = [
  { id: "chi_sim+eng", label: "简体中文 + 英文" },
  { id: "chi_tra+eng", label: "繁体中文 + 英文" },
  { id: "eng", label: "英文" },
  { id: "jpn+eng", label: "日文 + 英文" },
] as const;

const REGIONS: { id: Region; label: string }[] = [
  { id: "full", label: "全画面" },
  { id: "bottom", label: "底部字幕" },
  { id: "top", label: "顶部标题" },
];

const MODES: { id: LayoutMode; label: string }[] = [
  { id: "auto", label: "自动" },
  { id: "block", label: "成块文字" },
  { id: "sparse", label: "零散文字" },
];

const ENGINES: { id: Engine; label: string }[] = [
  { id: "paddle", label: "检测识别" },
  { id: "tesseract", label: "整页识别" },
];

const PREF_KEY = "zhenxi-prefs";

type Phase = "idle" | "preparing" | "ready" | "loading" | "running" | "done" | "error";

type Prefs = { langs: string; region: Region; mode: LayoutMode; engine: Engine };

function readPrefs(): Prefs {
  const fallback: Prefs = { langs: "chi_sim+eng", region: "full", mode: "auto", engine: "paddle" };
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      langs: LANGS.some((item) => item.id === parsed.langs) ? parsed.langs! : fallback.langs,
      region: REGIONS.some((item) => item.id === parsed.region) ? parsed.region! : fallback.region,
      mode: MODES.some((item) => item.id === parsed.mode) ? parsed.mode! : fallback.mode,
      engine: ENGINES.some((item) => item.id === parsed.engine) ? parsed.engine! : fallback.engine,
    };
  } catch {
    return fallback;
  }
}

function isVideo(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|mkv|m4v|ogg)$/i.test(file.name);
}

function stem(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "文稿";
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("已复制");
  } catch {
    toast.error("复制失败，可以改用下载");
  }
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Studio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const prefsRef = useRef<Prefs>({ langs: "chi_sim+eng", region: "full", mode: "auto", engine: "paddle" });
  const rangeRef = useRef({ start: "", end: "" });

  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [langs, setLangs] = useState(prefsRef.current.langs);
  const [region, setRegion] = useState<Region>(prefsRef.current.region);
  const [mode, setMode] = useState<LayoutMode>(prefsRef.current.mode);
  const [engine, setEngine] = useState<Engine>(prefsRef.current.engine);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scan, setScan] = useState<ScanStatus | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [autoStart, setAutoStart] = useState(false);

  prefsRef.current = { langs, region, mode, engine };
  rangeRef.current = { start: startAt, end: endAt };

  useEffect(() => {
    const prefs = readPrefs();
    setLangs(prefs.langs);
    setRegion(prefs.region);
    setMode(prefs.mode);
    setEngine(prefs.engine);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PREF_KEY, JSON.stringify({ langs, region, mode, engine }));
  }, [hydrated, langs, region, mode, engine]);

  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function adoptFile(file: File) {
    if (!isVideo(file)) {
      setError("请选择视频文件，例如 mp4 或 webm");
      setPhase("error");
      return;
    }
    abortRef.current?.abort();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const next = URL.createObjectURL(file);
    urlRef.current = next;
    setUrl(next);
    setFileName(file.name);
    setDuration(null);
    setSegments([]);
    setActiveId(null);
    setScan(null);
    setNote("");
    setError("");
    setPhase("ready");
  }

  async function onDemo() {
    setPhase("preparing");
    setError("");
    setNote("");
    try {
      const res = await fetch(assetUrl("/demo.mp4"));
      if (!res.ok) throw new Error("示例片段加载失败");
      const blob = await res.blob();
      setAutoStart(true);
      adoptFile(new File([blob], "帧析示例.mp4", { type: "video/mp4" }));
    } catch (err) {
      setAutoStart(false);
      setError(err instanceof Error ? err.message : "示例片段加载失败");
      setPhase("error");
    }
  }

  async function start() {
    const video = videoRef.current;
    if (!video) return;
    if (startAt.trim() && endAt.trim() && Number(startAt) > Number(endAt)) {
      setError("结束时间要晚于开始时间");
      setPhase("error");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setNote("");
    setSegments([]);
    setActiveId(null);
    setPhase("loading");
    setScan({ kind: "model", label: "正在准备识别模型", progress: 0 });
    try {
      const prefs = prefsRef.current;
      const range = rangeRef.current;
      const result = await transcribeVideo({
        video,
        langs: prefs.langs,
        region: prefs.region,
        mode: prefs.mode,
        engine: prefs.engine,
        startRaw: range.start,
        endRaw: range.end,
        signal: controller.signal,
        onStatus: (status) => {
          setScan(status);
          setPhase(status.kind === "model" ? "loading" : "running");
        },
        onSegments: setSegments,
      });
      setPhase("done");
      if (result.stopped) {
        setNote("已停止，保留了已经识别出的文字。");
      } else if (result.segments.length === 0) {
        setNote(
          prefsRef.current.engine === "paddle"
            ? "没有识别到文字。可以改成「全画面」，或换「整页识别」再试。"
            : "没有识别到文字。可以改成「底部字幕」或「成块文字」再试。",
        );
      } else {
        setNote("");
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setPhase("done");
        setNote("已停止，保留了已经识别出的文字。");
        return;
      }
      setError(err instanceof Error ? err.message : "解析失败");
      setPhase("error");
    }
  }

  useEffect(() => {
    if (!autoStart || duration == null) return;
    setAutoStart(false);
    void start();
    // start reads the latest settings from refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, duration]);

  function stop() {
    abortRef.current?.abort();
  }

  function onLoadedMetadata() {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    setDuration(video.duration);
  }

  function seekSegment(segment: Segment) {
    const video = videoRef.current;
    setActiveId(segment.id);
    if (!video) return;
    video.pause();
    video.currentTime = segment.start;
  }

  const busy = phase === "preparing" || phase === "loading" || phase === "running";
  const frames =
    duration == null ? 0 : countFrames(duration, startAt, endAt);
  const visible = query.trim()
    ? segments.filter((segment) => segment.text.toLowerCase().includes(query.trim().toLowerCase()))
    : segments;
  const chars = segments.reduce((sum, segment) => sum + segment.text.replace(/\s/g, "").length, 0);
  const bar = Math.max(0, Math.min(1, scan?.progress ?? 0));

  return (
    <main className="shell">
      <Toaster theme="dark" position="top-center" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mark" aria-hidden="true">
            <ScanText />
          </span>
          <div>
            <p className="text-sm font-medium text-primary">视频文字解析</p>
            <h1 className="font-serif text-4xl text-fg">帧析</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="badge">
            <strong className="text-primary">{SAMPLE_FPS}</strong>
            帧/秒
          </span>
          <span className="badge">浏览器本地 · 不上传</span>
        </div>
      </header>
      <p className="mt-4 max-w-2xl text-muted">
        按每秒五帧拆开画面，读出上面的字。字幕、标题、课件、包装都能抽，视频只留在这台设备上。
      </p>
      <ol className="steps">
        <li>
          <span>1</span>放入视频
        </li>
        <li>
          <span>2</span>每秒拆五帧
        </li>
        <li>
          <span>3</span>带时间的文稿
        </li>
      </ol>

      <div className="studio-grid">
        <section className="panel stage">
          {url ? (
            <div className="player-wrap">
              <video
                ref={videoRef}
                className="player"
                src={url}
                controls={phase !== "loading" && phase !== "running"}
                playsInline
                preload="auto"
                onLoadedMetadata={onLoadedMetadata}
                onError={() => {
                  setError("这个浏览器播不了该视频，请换 mp4 或 webm");
                  setPhase("error");
                }}
              />
            </div>
          ) : (
            <div
              className={over ? "drop is-over" : "drop"}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setOver(false);
                const file = event.dataTransfer.files[0];
                if (file) adoptFile(file);
              }}
            >
              <Upload aria-hidden="true" />
              <div>
                <p className="text-lg font-medium">把视频拖到这里</p>
                <p className="mt-1 text-sm text-muted">mp4、webm、mov</p>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                >
                  选择视频
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => void onDemo()} disabled={busy}>
                  <Clapperboard aria-hidden="true" className="size-4" />
                  示例片段
                </button>
              </div>
            </div>
          )}

          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            suppressHydrationWarning
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) adoptFile(file);
            }}
          />

          <div className="controls">
            {url ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm text-muted">{fileName}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy}
                  >
                    换一个
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => void onDemo()} disabled={busy}>
                    示例
                  </button>
                </div>
              </div>
            ) : null}

            <label className="block text-sm text-muted">
              语言
              <span className="select-wrap mt-1 block">
                <select
                  className="field"
                  value={langs}
                  disabled={busy}
                  onChange={(event) => setLangs(event.target.value)}
                >
                  {LANGS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="size-4" aria-hidden="true" />
              </span>
            </label>

            <div>
              <p className="mb-1 text-sm text-muted">引擎</p>
              <div className="seg" role="group" aria-label="识别引擎">
                {ENGINES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={engine === item.id}
                    disabled={busy}
                    onClick={() => setEngine(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-sm text-muted">
                {engine === "paddle"
                  ? "先框出每一行再识别，同一句用多帧投票。第一次要下载模型。"
                  : "整页交给 Tesseract，不单独检测文字位置。"}
              </p>
            </div>

            <div>
              <p className="mb-1 text-sm text-muted">识别区域</p>
              <div className="seg" role="group" aria-label="识别区域">
                {REGIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={region === item.id}
                    disabled={busy}
                    onClick={() => setRegion(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm text-muted">版面</p>
              <div className="seg" role="group" aria-label="版面">
                {MODES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={mode === item.id}
                    disabled={busy || engine === "paddle"}
                    onClick={() => setMode(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="times">
              <label className="block text-sm text-muted">
                开始（秒）
                <input
                  className="field mt-1"
                  inputMode="decimal"
                  placeholder="片头"
                  value={startAt}
                  disabled={busy}
                  suppressHydrationWarning
                  onChange={(event) => setStartAt(event.target.value)}
                />
              </label>
              <label className="block text-sm text-muted">
                结束（秒）
                <input
                  className="field mt-1"
                  inputMode="decimal"
                  placeholder="片尾"
                  value={endAt}
                  disabled={busy}
                  suppressHydrationWarning
                  onChange={(event) => setEndAt(event.target.value)}
                />
              </label>
            </div>

            <div className="actions">
              {phase === "loading" || phase === "running" ? (
                <button type="button" className="btn btn-stop" onClick={stop}>
                  <Square className="size-4" aria-hidden="true" />
                  停止
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!url || phase === "preparing"}
                  onClick={() => void start()}
                >
                  {phase === "preparing" ? (
                    <LoaderCircle className="spin size-4" aria-hidden="true" />
                  ) : (
                    <ScanText className="size-4" aria-hidden="true" />
                  )}
                  {phase === "done" ? "重新解析" : "开始解析"}
                </button>
              )}
              {!url ? null : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy || duration == null}
                  onClick={() => setEndAt(duration != null && duration > 60 ? "60" : "")}
                >
                  只看前 60 秒
                </button>
              )}
            </div>

            <p className="text-sm text-muted tabular-nums">
              固定每秒 {SAMPLE_FPS} 帧
              {duration != null ? ` · 片长 ${formatStamp(duration)} · 约 ${frames} 帧` : ""}
            </p>
            {frames > 600 ? (
              <p className="text-sm text-primary">这段比较长，识别会花一些时间，可以先填开始和结束。</p>
            ) : null}

            {scan && (phase === "loading" || phase === "running" || phase === "done") ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span>{scan.label}</span>
                  <span className="tabular-nums text-muted">
                    {scan.frame && scan.total
                      ? `${scan.frame}/${scan.total}`
                      : `${Math.round(bar * 100)}%`}
                    {scan.time != null ? ` · ${formatStamp(scan.time)}` : ""}
                  </span>
                </div>
                <div className="bar" aria-hidden="true">
                  <span style={{ width: `${bar * 100}%` }} />
                </div>
                <p className="live mt-2 text-sm" aria-live="polite">
                  {scan.liveText || " "}
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="alert" role="alert">
                {error}
              </p>
            ) : null}
            {note ? <p className="text-sm text-muted">{note}</p> : null}
          </div>
        </section>

        <section className="panel transcript" aria-label="文稿">
          <div className="transcript-head">
            <div>
              <h2 className="font-serif text-2xl">文稿</h2>
              <p className="text-sm text-muted tabular-nums">
                {segments.length > 0 ? `${segments.length} 段 · ${chars} 字` : "同一句会合并成一段"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="复制全文"
                disabled={segments.length === 0}
                onClick={() => void copyText(buildTxt(segments))}
              >
                <Copy className="size-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="下载 TXT"
                disabled={segments.length === 0}
                onClick={() => download(`${stem(fileName)}.txt`, buildTxt(segments))}
              >
                <Download className="size-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={segments.length === 0}
                onClick={() => download(`${stem(fileName)}.srt`, buildSrt(segments))}
              >
                SRT
              </button>
            </div>
          </div>
          <div className="px-4 pb-2">
            <input
              className="field"
              placeholder="在文稿里搜索"
              value={query}
              suppressHydrationWarning
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="cue-list">
            {visible.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted">
                {segments.length === 0
                  ? "解析之后，每段文字会带着时间和画面缩略图出现在这里。"
                  : "没有匹配的文字。"}
              </p>
            ) : (
              visible.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  className={segment.id === activeId ? "cue is-on" : "cue"}
                  onClick={() => seekSegment(segment)}
                >
                    {segment.thumb ? (
                      <img className="thumb" src={segment.thumb} alt="" />
                    ) : (
                      <span className="thumb" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm tabular-nums text-muted">
                        {formatStamp(segment.start)} – {formatStamp(segment.end)}
                        {segment.samples > 1 ? ` · ${segment.samples} 帧` : ""}
                      </span>
                      <span className="cue-text mt-1 block">{segment.text}</span>
                    </span>
                    <span className="cue-side text-sm tabular-nums text-muted">
                      {segment.confidence > 0 ? `${segment.confidence}%` : ""}
                    </span>
                  </button>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
