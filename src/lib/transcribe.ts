import { assetUrl } from "@/lib/asset-url";
import { loadPaddle, recognizePaddle, type Engine } from "@/lib/paddle-read";

export type { Engine };

export const SAMPLE_FPS = 5;
export const SAMPLE_STEP = 1 / SAMPLE_FPS;

export type Region = "full" | "bottom" | "top";
export type LayoutMode = "auto" | "block" | "sparse";

export type Segment = {
  id: string;
  start: number;
  end: number;
  text: string;
  confidence: number;
  samples: number;
  thumb: string;
};

export type ScanStatus = {
  kind: "model" | "scan";
  label: string;
  progress: number;
  frame?: number;
  total?: number;
  time?: number;
  liveText?: string;
};

type OcrLine = { text: string; confidence: number };
type OcrPage = {
  text?: string;
  confidence?: number;
  blocks?: Array<{
    paragraphs?: Array<{ lines?: OcrLine[] }>;
  }> | null;
};

type OcrWorker = {
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  recognize: (
    image: HTMLCanvasElement,
    options?: Record<string, never>,
    output?: { text?: boolean; blocks?: boolean },
  ) => Promise<{ data: OcrPage }>;
  terminate: () => Promise<unknown>;
};

const STATUS_LABEL: Record<string, string> = {
  "loading tesseract core": "正在加载识别引擎",
  "initializing tesseract": "正在初始化",
  "loading language traineddata": "正在准备语言模型",
  "initializing api": "正在准备语言模型",
  "recognizing text": "正在读字",
};

export function formatStamp(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const whole = Math.floor(s % 60);
  const tenth = Math.min(9, Math.floor((s - Math.floor(s)) * 10));
  const body = `${String(m).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${tenth}`;
  return h > 0 ? `${h}:${body}` : body;
}

export function formatSrtTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const whole = Math.floor(s % 60);
  const ms = Math.min(999, Math.round((s - Math.floor(s)) * 1000));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(whole).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function buildTxt(segments: Segment[]): string {
  return segments
    .map((s) => `${formatStamp(s.start)} – ${formatStamp(s.end)}\n${s.text}`)
    .join("\n\n");
}

export function buildSrt(segments: Segment[]): string {
  return segments
    .map((s, i) => {
      const end = s.end > s.start ? s.end : s.start + SAMPLE_STEP;
      return `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(end)}\n${s.text}\n`;
    })
    .join("\n");
}

export function countFrames(duration: number, startRaw: string, endRaw: string): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const from = bound(startRaw, duration, 0);
  const to = Math.max(from, bound(endRaw, duration, duration));
  return Math.floor((to - from) / SAMPLE_STEP + 1e-6) + 1;
}

function bound(raw: string, duration: number, fallback: number): number {
  if (raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(0, n), duration);
}

function clampByte(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function normalize(text: string): string {
  return text
    .replace(/\s+/g, "")
    .replace(/[|｜·•]+/g, "")
    .replace(/[，。！？、,.!?:：；;""''“”‘’（）()【】[\]—\-]/g, "")
    .toLowerCase();
}

function meaningful(text: string): boolean {
  if ((text.match(/\p{Script=Han}/gu) ?? []).length >= 1) return true;
  if (text.replace(/[^A-Za-z]/g, "").length >= 2) return true;
  if (text.replace(/\D/g, "").length >= 2) return true;
  return false;
}

function keepLine(text: string, confidence: number): boolean {
  if (!meaningful(text)) return false;
  if (confidence < 0) return true;
  if (confidence >= 45) return true;
  const cjk = (text.match(/\p{Script=Han}/gu) ?? []).length;
  return cjk >= 2 && confidence >= 28;
}

function clean(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[|¦]/g, "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function pageText(page: OcrPage): { text: string; confidence: number } {
  const lines: OcrLine[] = [];
  for (const block of page.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        const text = (line.text || "").trim();
        if (keepLine(text, line.confidence ?? 0)) {
          lines.push({ text, confidence: line.confidence ?? 0 });
        }
      }
    }
  }
  if (lines.length > 0) {
    const confidence = lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length;
    return { text: clean(lines.map((line) => line.text).join("\n")), confidence };
  }
  const text = clean(page.text || "");
  const confidence = page.confidence ?? 0;
  if (keepLine(text, confidence)) return { text, confidence };
  return { text: "", confidence: 0 };
}

function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s: string) => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      map.set(g, (map.get(g) ?? 0) + 1);
    }
    return map;
  };
  const left = grams(a);
  const right = grams(b);
  let inter = 0;
  let sizeA = 0;
  let sizeB = 0;
  for (const n of left.values()) sizeA += n;
  for (const n of right.values()) sizeB += n;
  for (const [g, n] of left) inter += Math.min(n, right.get(g) ?? 0);
  return (2 * inter) / (sizeA + sizeB);
}

function shouldMerge(prev: string, next: string): boolean {
  const a = normalize(prev);
  const b = normalize(next);
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  if (long.includes(short) && short.length / long.length >= 0.6) return true;
  return dice(a, b) >= 0.82;
}

type Vote = { text: string; confidence: number; count: number };

function castVote(
  ballots: Map<string, Vote[]>,
  id: string,
  text: string,
  confidence: number,
): { text: string; confidence: number; samples: number } {
  const list = ballots.get(id) ?? [];
  const key = normalize(text);
  const found = list.find((item) => normalize(item.text) === key);
  if (found) {
    found.count += 1;
    if (confidence > found.confidence || (confidence === found.confidence && text.length > found.text.length)) {
      found.confidence = confidence;
      found.text = text;
    }
  } else {
    list.push({ text, confidence, count: 1 });
  }
  ballots.set(id, list);
  let best = list[0]!;
  let bestRank = -Infinity;
  let samples = 0;
  for (const item of list) {
    samples += item.count;
    const len = item.text.replace(/\s/g, "").length;
    const rank = item.count * 12 + item.confidence + Math.min(len, 24);
    if (rank > bestRank) {
      best = item;
      bestRank = rank;
    }
  }
  return { text: best.text, confidence: Math.round(best.confidence), samples };
}

function meanDiff(a: Uint8Array, b: Uint8Array): number {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i]! - b[i]!);
  return diff / a.length;
}

function lumaGrid(
  canvas: HTMLCanvasElement,
  bucket: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): Uint8Array {
  const cols = 12;
  const rows = 8;
  if (bucket.width !== cols) bucket.width = cols;
  if (bucket.height !== rows) bucket.height = rows;
  const ctx = bucket.getContext("2d", { willReadFrequently: true });
  if (!ctx) return new Uint8Array(cols * rows);
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;
  const out = new Uint8Array(cols * rows);
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    out[i] = (data[o]! * 0.299 + data[o + 1]! * 0.587 + data[o + 2]! * 0.114) | 0;
  }
  return out;
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  const duration = video.duration;
  const target = Number.isFinite(duration)
    ? Math.min(Math.max(0, time), Math.max(0, duration - 0.04))
    : Math.max(0, time);
  if (video.readyState >= 2 && Math.abs(video.currentTime - target) < 0.03) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener("seeked", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, 1500);
    video.addEventListener("seeked", finish);
    video.currentTime = target;
  });
}

async function ensureDuration(video: HTMLVideoElement): Promise<number> {
  if (video.readyState < 1) {
    await new Promise<void>((resolve, reject) => {
      const ok = () => resolve();
      const bad = () => reject(new Error("这个视频播不了，请换 mp4 或 webm"));
      video.addEventListener("loadedmetadata", ok, { once: true });
      video.addEventListener("error", bad, { once: true });
    });
  }
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener("seeked", finish);
      video.removeEventListener("timeupdate", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, 1500);
    video.addEventListener("seeked", finish);
    video.addEventListener("timeupdate", finish);
    try {
      video.currentTime = 1e101;
    } catch {
      finish();
    }
  });
  const duration = video.duration;
  await seekTo(video, 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("读不到视频时长，请换成 mp4 或 webm");
  }
  return duration;
}

function paintFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.max(2, Math.round(video.videoWidth * scale));
  const h = Math.max(2, Math.round(video.videoHeight * scale));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("无法读取画面");
  ctx.drawImage(video, 0, 0, w, h);
  return { w, h };
}

function paintOcr(
  source: HTMLCanvasElement,
  dest: HTMLCanvasElement,
  region: Region,
): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  let sx = 0;
  let sy = 0;
  let sw = w;
  let sh = h;
  if (region === "bottom") {
    sh = Math.max(2, Math.round(h * 0.36));
    sy = h - sh;
  } else if (region === "top") {
    sh = Math.max(2, Math.round(h * 0.3));
  }
  const minH = region === "full" ? 480 : 240;
  const scale = sh < minH ? minH / sh : 1;
  const dw = Math.max(2, Math.round(sw * scale));
  const dh = Math.max(2, Math.round(sh * scale));
  if (dest.width !== dw) dest.width = dw;
  if (dest.height !== dh) dest.height = dh;
  const ctx = dest.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("无法读取画面");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh);
  if (region !== "full") {
    const img = ctx.getImageData(0, 0, dw, dh);
    const data = img.data;
    const contrast = 1.18;
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clampByte(data[i]! * contrast + intercept);
      data[i + 1] = clampByte(data[i + 1]! * contrast + intercept);
      data[i + 2] = clampByte(data[i + 2]! * contrast + intercept);
    }
    ctx.putImageData(img, 0, 0);
  }
  return dest;
}

function makeThumb(video: HTMLVideoElement, canvas: HTMLCanvasElement): string {
  const w = 320;
  const h = Math.max(1, Math.round((w * video.videoHeight) / video.videoWidth));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.72);
}

async function loadCreateWorker() {
  const mod = (await import("tesseract.js")) as unknown as {
    createWorker?: (
      langs: string,
      oem: number,
      options: Record<string, unknown>,
    ) => Promise<OcrWorker>;
    default?: {
      createWorker?: (
        langs: string,
        oem: number,
        options: Record<string, unknown>,
      ) => Promise<OcrWorker>;
    };
  };
  const createWorker = mod.createWorker ?? mod.default?.createWorker;
  if (!createWorker) throw new Error("识别引擎没有加载成功");
  return createWorker;
}

function explain(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/wasm|no available backend|ort-/i.test(msg)) {
    return "识别组件没有加载成功，请刷新后再试";
  }
  if (/network|fetch|failed to load|importScripts|Response code/i.test(msg)) {
    return "模型没有加载成功，请再试一次";
  }
  return msg || "解析失败";
}

export async function transcribeVideo(args: {
  video: HTMLVideoElement;
  langs: string;
  region: Region;
  mode: LayoutMode;
  engine: Engine;
  startRaw: string;
  endRaw: string;
  signal: AbortSignal;
  onStatus: (status: ScanStatus) => void;
  onSegments: (segments: Segment[]) => void;
}): Promise<{ segments: Segment[]; stopped: boolean }> {
  const { video, signal, onStatus, onSegments } = args;
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("没有读到画面，换一个视频试试");
  }
  video.muted = true;
  try {
    await video.play();
    video.pause();
  } catch {
    /* seek still works on most files */
  }
  video.muted = false;

  const duration = await ensureDuration(video);
  const from = bound(args.startRaw, duration, 0);
  const to = Math.max(from, bound(args.endRaw, duration, Math.max(0, duration - 0.04)));
  if (args.startRaw.trim() && args.endRaw.trim() && Number(args.startRaw) > Number(args.endRaw)) {
    throw new Error("结束时间要晚于开始时间");
  }

  const times: number[] = [];
  for (let i = 0; ; i++) {
    const t = Math.round(i * SAMPLE_STEP * 1000) / 1000;
    if (t < from - 1e-6) continue;
    if (t > to + 1e-6) break;
    times.push(Math.min(t, to));
    if (times.length > 20000) break;
  }
  if (times.length === 0) times.push(from);

  onStatus({ kind: "model", label: "正在准备识别模型", progress: 0 });
  const segments: Segment[] = [];
  const ballots = new Map<string, Vote[]>();
  let seq = 0;
  let stopped = false;
  let worker: OcrWorker | null = null;
  let paddle: Awaited<ReturnType<typeof loadPaddle>> | null = null;

  try {
    if (args.engine === "paddle") {
      onStatus({ kind: "model", label: "正在加载检测模型，第一次会下载", progress: 0.2 });
      paddle = await loadPaddle(args.langs);
      if (signal.aborted) {
        stopped = true;
        return { segments, stopped };
      }
      onStatus({ kind: "model", label: "检测模型已就绪", progress: 1 });
    } else {
      const createWorker = await loadCreateWorker();
      worker = await createWorker(args.langs, 1, {
        workerPath: assetUrl("/tesseract/worker.min.js"),
        corePath: assetUrl("/tesseract-core"),
        langPath: assetUrl("/tessdata"),
        gzip: true,
        workerBlobURL: true,
        logger: (message: { status?: string; progress?: number }) => {
          const status = message.status ?? "";
          if (status === "recognizing text") return;
          onStatus({
            kind: "model",
            label: STATUS_LABEL[status] ?? "正在准备识别模型",
            progress: message.progress ?? 0,
          });
        },
      });
      if (signal.aborted) {
        stopped = true;
        return { segments, stopped };
      }
      const psm = args.mode === "block" ? "6" : args.mode === "sparse" ? "11" : "3";
      await worker.setParameters({
        tessedit_pageseg_mode: psm,
        user_defined_dpi: "150",
        preserve_interword_spaces: "1",
      });
    }

    const frameCanvas = document.createElement("canvas");
    const ocrCanvas = document.createElement("canvas");
    const hashCanvas = document.createElement("canvas");
    const bottomHashCanvas = document.createElement("canvas");
    const thumbCanvas = document.createElement("canvas");
    let prevFull: Uint8Array | null = null;
    let prevBottom: Uint8Array | null = null;
    let holdingText = false;
    let fails = 0;

    for (let index = 0; index < times.length; index++) {
      if (signal.aborted) {
        stopped = true;
        break;
      }
      const t = times[index]!;
      await seekTo(video, t);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      if (!video.videoWidth) continue;

      let w = 0;
      let h = 0;
      try {
        const painted = paintFrame(video, frameCanvas);
        w = painted.w;
        h = painted.h;
      } catch {
        continue;
      }

      const full = lumaGrid(frameCanvas, hashCanvas, 0, 0, w, h);
      const bottomH = Math.max(2, Math.round(h * 0.36));
      const bottom = lumaGrid(frameCanvas, bottomHashCanvas, 0, h - bottomH, w, bottomH);
      const unchanged =
        prevFull &&
        prevBottom &&
        meanDiff(full, prevFull) < 3.2 &&
        meanDiff(bottom, prevBottom) < 5;
      prevFull = full;
      prevBottom = bottom;

      const end = Math.min(duration, t + SAMPLE_STEP);
      if (unchanged) {
        if (holdingText && segments.length > 0) {
          segments[segments.length - 1]!.end = end;
          onSegments(segments.map((item) => ({ ...item })));
        }
        onStatus({
          kind: "scan",
          label: "画面没变，沿用上一帧",
          progress: (index + 1) / times.length,
          frame: index + 1,
          total: times.length,
          time: t,
          liveText: segments[segments.length - 1]?.text,
        });
        continue;
      }

      let text = "";
      let confidence = 0;
      try {
        paintOcr(frameCanvas, ocrCanvas, args.region);
        const read = paddle
          ? await recognizePaddle(paddle, ocrCanvas)
          : pageText((await worker!.recognize(ocrCanvas, {}, { text: true, blocks: true })).data);
        text = read.text;
        confidence = read.confidence;
        fails = 0;
      } catch (err) {
        fails += 1;
        if (fails >= 3) throw err;
      }

      if (signal.aborted) {
        stopped = true;
        break;
      }

      if (!text) {
        holdingText = false;
      } else {
        const last = segments[segments.length - 1];
        if (last && t - last.end <= 1.05 && shouldMerge(last.text, text)) {
          const voted = castVote(ballots, last.id, text, confidence);
          last.end = end;
          last.text = voted.text;
          last.confidence = voted.confidence;
          last.samples = voted.samples;
        } else {
          const id = `s${seq++}`;
          const voted = castVote(ballots, id, text, confidence);
          segments.push({
            id,
            start: t,
            end,
            text: voted.text,
            confidence: voted.confidence,
            samples: voted.samples,
            thumb: makeThumb(video, thumbCanvas),
          });
        }
        holdingText = true;
        onSegments(segments.map((item) => ({ ...item })));
      }

      onStatus({
        kind: "scan",
        label: paddle ? "正在检测并读字" : "正在读字",
        progress: (index + 1) / times.length,
        frame: index + 1,
        total: times.length,
        time: t,
        liveText: text,
      });
    }
  } catch (err) {
    console.error(err);
    throw new Error(explain(err));
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        /* worker already gone */
      }
    }
  }

  return { segments, stopped };
}
