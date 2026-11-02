import { o as __toESM } from "../_runtime.mjs";
import { q as require_react, x as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as LoaderCircle, c as Clapperboard, i as ScanText, l as ChevronDown, o as Download, r as Square, s as Copy, t as Upload } from "../_libs/lucide-react.mjs";
import { n as previewPathPrefix } from "./router-CrBdesKG.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Y-QIdY1I.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Root-absolute URL, with the path-based preview prefix when the host uses one. */
function assetUrl(path) {
	const clean = path.startsWith("/") ? path : `/${path}`;
	if (typeof window === "undefined") return clean;
	return `${previewPathPrefix(window.location.hostname, window.location.pathname) ?? ""}${clean}`;
}
var sessions = /* @__PURE__ */ new Map();
function paddleLang(langs) {
	if (langs.startsWith("chi_tra")) return "chinese_cht";
	if (langs.startsWith("jpn")) return "japan";
	if (langs === "eng") return "en";
	return "ch";
}
function loadPaddle(langs) {
	const lang = paddleLang(langs);
	const cached = sessions.get(lang);
	if (cached) return cached;
	const pending = import("../_libs/@paddleocr/paddleocr-js+[...].mjs").then((n) => n.t).then(({ PaddleOCR }) => PaddleOCR.create({
		lang,
		ocrVersion: "PP-OCRv5",
		worker: false,
		textRecScoreThresh: .3,
		textDetThresh: .3,
		textDetBoxThresh: .4,
		textDetUnclipRatio: 1.6,
		ortOptions: {
			backend: "wasm",
			wasmPaths: assetUrl("/ort/"),
			numThreads: 1,
			simd: true,
			proxy: false,
			disableWasmProxy: true
		}
	})).then((ocr) => ocr);
	sessions.set(lang, pending);
	pending.catch(() => {
		sessions.delete(lang);
	});
	return pending;
}
function meaningful$1(text) {
	if ((text.match(/\p{Script=Han}/gu) ?? []).length >= 1) return true;
	if (text.replace(/[^A-Za-z]/g, "").length >= 2) return true;
	if (text.replace(/\D/g, "").length >= 2) return true;
	return false;
}
async function recognizePaddle(session, canvas) {
	const [page] = await session.predict(canvas, {
		textRecScoreThresh: .3,
		textDetThresh: .3,
		textDetBoxThresh: .4,
		textDetUnclipRatio: 1.6
	});
	const lines = (page?.items ?? []).map((item) => ({
		text: (item.text || "").replace(/[|¦]/g, "").trim(),
		score: item.score ?? 0,
		y: item.poly?.[0]?.[1] ?? 0,
		x: item.poly?.[0]?.[0] ?? 0
	})).filter((line) => line.text && line.score >= .3 && meaningful$1(line.text)).sort((a, b) => a.y - b.y || a.x - b.x);
	if (lines.length === 0) return {
		text: "",
		confidence: 0
	};
	const confidence = lines.reduce((sum, line) => sum + line.score, 0) / lines.length * 100;
	return {
		text: lines.map((line) => line.text).join("\n"),
		confidence
	};
}
var SAMPLE_STEP = 1 / 5;
var STATUS_LABEL = {
	"loading tesseract core": "正在加载识别引擎",
	"initializing tesseract": "正在初始化",
	"loading language traineddata": "正在准备语言模型",
	"initializing api": "正在准备语言模型",
	"recognizing text": "正在读字"
};
function formatStamp(sec) {
	const s = Math.max(0, sec);
	const h = Math.floor(s / 3600);
	const m = Math.floor(s % 3600 / 60);
	const whole = Math.floor(s % 60);
	const tenth = Math.min(9, Math.floor((s - Math.floor(s)) * 10));
	const body = `${String(m).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${tenth}`;
	return h > 0 ? `${h}:${body}` : body;
}
function formatSrtTime(sec) {
	const s = Math.max(0, sec);
	const h = Math.floor(s / 3600);
	const m = Math.floor(s % 3600 / 60);
	const whole = Math.floor(s % 60);
	const ms = Math.min(999, Math.round((s - Math.floor(s)) * 1e3));
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(whole).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
function buildTxt(segments) {
	return segments.map((s) => `${formatStamp(s.start)} – ${formatStamp(s.end)}\n${s.text}`).join("\n\n");
}
function buildSrt(segments) {
	return segments.map((s, i) => {
		const end = s.end > s.start ? s.end : s.start + SAMPLE_STEP;
		return `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(end)}\n${s.text}\n`;
	}).join("\n");
}
function countFrames(duration, startRaw, endRaw) {
	if (!Number.isFinite(duration) || duration <= 0) return 0;
	const from = bound(startRaw, duration, 0);
	const to = Math.max(from, bound(endRaw, duration, duration));
	return Math.floor((to - from) / SAMPLE_STEP + 1e-6) + 1;
}
function bound(raw, duration, fallback) {
	if (raw.trim() === "") return fallback;
	const n = Number(raw);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(Math.max(0, n), duration);
}
function clampByte(n) {
	return n < 0 ? 0 : n > 255 ? 255 : n;
}
function normalize(text) {
	return text.replace(/\s+/g, "").replace(/[|｜·•]+/g, "").replace(/[，。！？、,.!?:：；;""''“”‘’（）()【】[\]—\-]/g, "").toLowerCase();
}
function meaningful(text) {
	if ((text.match(/\p{Script=Han}/gu) ?? []).length >= 1) return true;
	if (text.replace(/[^A-Za-z]/g, "").length >= 2) return true;
	if (text.replace(/\D/g, "").length >= 2) return true;
	return false;
}
function keepLine(text, confidence) {
	if (!meaningful(text)) return false;
	if (confidence < 0) return true;
	if (confidence >= 45) return true;
	return (text.match(/\p{Script=Han}/gu) ?? []).length >= 2 && confidence >= 28;
}
function clean(raw) {
	return raw.replace(/\r/g, "").split("\n").map((line) => line.replace(/[|¦]/g, "").trim()).filter(Boolean).join("\n").trim();
}
function pageText(page) {
	const lines = [];
	for (const block of page.blocks ?? []) for (const para of block.paragraphs ?? []) for (const line of para.lines ?? []) {
		const text = (line.text || "").trim();
		if (keepLine(text, line.confidence ?? 0)) lines.push({
			text,
			confidence: line.confidence ?? 0
		});
	}
	if (lines.length > 0) {
		const confidence = lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length;
		return {
			text: clean(lines.map((line) => line.text).join("\n")),
			confidence
		};
	}
	const text = clean(page.text || "");
	const confidence = page.confidence ?? 0;
	if (keepLine(text, confidence)) return {
		text,
		confidence
	};
	return {
		text: "",
		confidence: 0
	};
}
function dice(a, b) {
	if (a === b) return 1;
	if (a.length < 2 || b.length < 2) return 0;
	const grams = (s) => {
		const map = /* @__PURE__ */ new Map();
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
	return 2 * inter / (sizeA + sizeB);
}
function shouldMerge(prev, next) {
	const a = normalize(prev);
	const b = normalize(next);
	if (!a || !b) return false;
	if (a === b) return true;
	const short = a.length < b.length ? a : b;
	const long = a.length < b.length ? b : a;
	if (long.includes(short) && short.length / long.length >= .6) return true;
	return dice(a, b) >= .82;
}
function castVote(ballots, id, text, confidence) {
	const list = ballots.get(id) ?? [];
	const key = normalize(text);
	const found = list.find((item) => normalize(item.text) === key);
	if (found) {
		found.count += 1;
		if (confidence > found.confidence || confidence === found.confidence && text.length > found.text.length) {
			found.confidence = confidence;
			found.text = text;
		}
	} else list.push({
		text,
		confidence,
		count: 1
	});
	ballots.set(id, list);
	let best = list[0];
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
	return {
		text: best.text,
		confidence: Math.round(best.confidence),
		samples
	};
}
function meanDiff(a, b) {
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
	return diff / a.length;
}
function lumaGrid(canvas, bucket, sx, sy, sw, sh) {
	const cols = 12;
	const rows = 8;
	if (bucket.width !== cols) bucket.width = cols;
	if (bucket.height !== rows) bucket.height = rows;
	const ctx = bucket.getContext("2d", { willReadFrequently: true });
	if (!ctx) return /* @__PURE__ */ new Uint8Array(96);
	ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, cols, rows);
	const data = ctx.getImageData(0, 0, cols, rows).data;
	const out = /* @__PURE__ */ new Uint8Array(96);
	for (let i = 0; i < out.length; i++) {
		const o = i * 4;
		out[i] = data[o] * .299 + data[o + 1] * .587 + data[o + 2] * .114 | 0;
	}
	return out;
}
function seekTo(video, time) {
	const duration = video.duration;
	const target = Number.isFinite(duration) ? Math.min(Math.max(0, time), Math.max(0, duration - .04)) : Math.max(0, time);
	if (video.readyState >= 2 && Math.abs(video.currentTime - target) < .03) return Promise.resolve();
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
async function ensureDuration(video) {
	if (video.readyState < 1) await new Promise((resolve, reject) => {
		const ok = () => resolve();
		const bad = () => reject(/* @__PURE__ */ new Error("这个视频播不了，请换 mp4 或 webm"));
		video.addEventListener("loadedmetadata", ok, { once: true });
		video.addEventListener("error", bad, { once: true });
	});
	if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
	await new Promise((resolve) => {
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
	if (!Number.isFinite(duration) || duration <= 0) throw new Error("读不到视频时长，请换成 mp4 或 webm");
	return duration;
}
function paintFrame(video, canvas) {
	const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
	const w = Math.max(2, Math.round(video.videoWidth * scale));
	const h = Math.max(2, Math.round(video.videoHeight * scale));
	if (canvas.width !== w) canvas.width = w;
	if (canvas.height !== h) canvas.height = h;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) throw new Error("无法读取画面");
	ctx.drawImage(video, 0, 0, w, h);
	return {
		w,
		h
	};
}
function paintOcr(source, dest, region) {
	const w = source.width;
	const h = source.height;
	let sx = 0;
	let sy = 0;
	let sw = w;
	let sh = h;
	if (region === "bottom") {
		sh = Math.max(2, Math.round(h * .36));
		sy = h - sh;
	} else if (region === "top") sh = Math.max(2, Math.round(h * .3));
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
		const intercept = -23.039999999999992;
		for (let i = 0; i < data.length; i += 4) {
			data[i] = clampByte(data[i] * contrast + intercept);
			data[i + 1] = clampByte(data[i + 1] * contrast + intercept);
			data[i + 2] = clampByte(data[i + 2] * contrast + intercept);
		}
		ctx.putImageData(img, 0, 0);
	}
	return dest;
}
function makeThumb(video, canvas) {
	const w = 320;
	const h = Math.max(1, Math.round(w * video.videoHeight / video.videoWidth));
	if (canvas.width !== w) canvas.width = w;
	if (canvas.height !== h) canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) return "";
	ctx.drawImage(video, 0, 0, w, h);
	return canvas.toDataURL("image/jpeg", .72);
}
async function loadCreateWorker() {
	const mod = await import("../_libs/tesseract.js.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()));
	const createWorker = mod.createWorker ?? mod.default?.createWorker;
	if (!createWorker) throw new Error("识别引擎没有加载成功");
	return createWorker;
}
function explain(err) {
	const msg = err instanceof Error ? err.message : String(err);
	if (/network|fetch|failed to load|importScripts|Response code/i.test(msg)) return "识别引擎加载失败，请刷新后再试";
	return msg || "解析失败";
}
async function transcribeVideo(args) {
	const { video, signal, onStatus, onSegments } = args;
	if (!video.videoWidth || !video.videoHeight) throw new Error("没有读到画面，换一个视频试试");
	video.muted = true;
	try {
		await video.play();
		video.pause();
	} catch {}
	video.muted = false;
	const duration = await ensureDuration(video);
	const from = bound(args.startRaw, duration, 0);
	const to = Math.max(from, bound(args.endRaw, duration, Math.max(0, duration - .04)));
	if (args.startRaw.trim() && args.endRaw.trim() && Number(args.startRaw) > Number(args.endRaw)) throw new Error("结束时间要晚于开始时间");
	const times = [];
	for (let i = 0;; i++) {
		const t = Math.round(i * SAMPLE_STEP * 1e3) / 1e3;
		if (t < from - 1e-6) continue;
		if (t > to + 1e-6) break;
		times.push(Math.min(t, to));
		if (times.length > 2e4) break;
	}
	if (times.length === 0) times.push(from);
	onStatus({
		kind: "model",
		label: "正在准备识别模型",
		progress: 0
	});
	const segments = [];
	const ballots = /* @__PURE__ */ new Map();
	let seq = 0;
	let stopped = false;
	let worker = null;
	let paddle = null;
	try {
		if (args.engine === "paddle") {
			onStatus({
				kind: "model",
				label: "正在加载检测模型，第一次会下载",
				progress: .2
			});
			paddle = await loadPaddle(args.langs);
			if (signal.aborted) {
				stopped = true;
				return {
					segments,
					stopped
				};
			}
			onStatus({
				kind: "model",
				label: "检测模型已就绪",
				progress: 1
			});
		} else {
			worker = await (await loadCreateWorker())(args.langs, 1, {
				workerPath: assetUrl("/tesseract/worker.min.js"),
				corePath: assetUrl("/tesseract-core"),
				langPath: assetUrl("/tessdata"),
				gzip: true,
				workerBlobURL: true,
				logger: (message) => {
					const status = message.status ?? "";
					if (status === "recognizing text") return;
					onStatus({
						kind: "model",
						label: STATUS_LABEL[status] ?? "正在准备识别模型",
						progress: message.progress ?? 0
					});
				}
			});
			if (signal.aborted) {
				stopped = true;
				return {
					segments,
					stopped
				};
			}
			const psm = args.mode === "block" ? "6" : args.mode === "sparse" ? "11" : "3";
			await worker.setParameters({
				tessedit_pageseg_mode: psm,
				user_defined_dpi: "150",
				preserve_interword_spaces: "1"
			});
		}
		const frameCanvas = document.createElement("canvas");
		const ocrCanvas = document.createElement("canvas");
		const hashCanvas = document.createElement("canvas");
		const bottomHashCanvas = document.createElement("canvas");
		const thumbCanvas = document.createElement("canvas");
		let prevFull = null;
		let prevBottom = null;
		let holdingText = false;
		let fails = 0;
		for (let index = 0; index < times.length; index++) {
			if (signal.aborted) {
				stopped = true;
				break;
			}
			const t = times[index];
			await seekTo(video, t);
			await new Promise((resolve) => requestAnimationFrame(() => resolve(void 0)));
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
			const bottomH = Math.max(2, Math.round(h * .36));
			const bottom = lumaGrid(frameCanvas, bottomHashCanvas, 0, h - bottomH, w, bottomH);
			const unchanged = prevFull && prevBottom && meanDiff(full, prevFull) < 3.2 && meanDiff(bottom, prevBottom) < 5;
			prevFull = full;
			prevBottom = bottom;
			const end = Math.min(duration, t + SAMPLE_STEP);
			if (unchanged) {
				if (holdingText && segments.length > 0) {
					segments[segments.length - 1].end = end;
					onSegments(segments.map((item) => ({ ...item })));
				}
				onStatus({
					kind: "scan",
					label: "画面没变，沿用上一帧",
					progress: (index + 1) / times.length,
					frame: index + 1,
					total: times.length,
					time: t,
					liveText: segments[segments.length - 1]?.text
				});
				continue;
			}
			let text = "";
			let confidence = 0;
			try {
				paintOcr(frameCanvas, ocrCanvas, args.region);
				const read = paddle ? await recognizePaddle(paddle, ocrCanvas) : pageText((await worker.recognize(ocrCanvas, {}, {
					text: true,
					blocks: true
				})).data);
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
			if (!text) holdingText = false;
			else {
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
						thumb: makeThumb(video, thumbCanvas)
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
				liveText: text
			});
		}
	} catch (err) {
		console.error(err);
		throw new Error(explain(err));
	} finally {
		if (worker) try {
			await worker.terminate();
		} catch {}
	}
	return {
		segments,
		stopped
	};
}
var LANGS = [
	{
		id: "chi_sim+eng",
		label: "简体中文 + 英文"
	},
	{
		id: "chi_tra+eng",
		label: "繁体中文 + 英文"
	},
	{
		id: "eng",
		label: "英文"
	},
	{
		id: "jpn+eng",
		label: "日文 + 英文"
	}
];
var REGIONS = [
	{
		id: "full",
		label: "全画面"
	},
	{
		id: "bottom",
		label: "底部字幕"
	},
	{
		id: "top",
		label: "顶部标题"
	}
];
var MODES = [
	{
		id: "auto",
		label: "自动"
	},
	{
		id: "block",
		label: "成块文字"
	},
	{
		id: "sparse",
		label: "零散文字"
	}
];
var ENGINES = [{
	id: "paddle",
	label: "检测识别"
}, {
	id: "tesseract",
	label: "整页识别"
}];
var PREF_KEY = "zhenxi-prefs";
function readPrefs() {
	const fallback = {
		langs: "chi_sim+eng",
		region: "full",
		mode: "auto",
		engine: "paddle"
	};
	try {
		const raw = localStorage.getItem(PREF_KEY);
		if (!raw) return fallback;
		const parsed = JSON.parse(raw);
		return {
			langs: LANGS.some((item) => item.id === parsed.langs) ? parsed.langs : fallback.langs,
			region: REGIONS.some((item) => item.id === parsed.region) ? parsed.region : fallback.region,
			mode: MODES.some((item) => item.id === parsed.mode) ? parsed.mode : fallback.mode,
			engine: ENGINES.some((item) => item.id === parsed.engine) ? parsed.engine : fallback.engine
		};
	} catch {
		return fallback;
	}
}
function isVideo(file) {
	if (file.type.startsWith("video/")) return true;
	return /\.(mp4|webm|mov|mkv|m4v|ogg)$/i.test(file.name);
}
function stem(name) {
	return name.replace(/\.[^.]+$/, "") || "文稿";
}
async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success("已复制");
	} catch {
		toast.error("复制失败，可以改用下载");
	}
}
function download(filename, content) {
	const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
function Studio() {
	const videoRef = (0, import_react.useRef)(null);
	const inputRef = (0, import_react.useRef)(null);
	const abortRef = (0, import_react.useRef)(null);
	const urlRef = (0, import_react.useRef)(null);
	const prefsRef = (0, import_react.useRef)({
		langs: "chi_sim+eng",
		region: "full",
		mode: "auto",
		engine: "paddle"
	});
	const rangeRef = (0, import_react.useRef)({
		start: "",
		end: ""
	});
	const [phase, setPhase] = (0, import_react.useState)("idle");
	const [fileName, setFileName] = (0, import_react.useState)("");
	const [url, setUrl] = (0, import_react.useState)(null);
	const [duration, setDuration] = (0, import_react.useState)(null);
	const [over, setOver] = (0, import_react.useState)(false);
	const [langs, setLangs] = (0, import_react.useState)(prefsRef.current.langs);
	const [region, setRegion] = (0, import_react.useState)(prefsRef.current.region);
	const [mode, setMode] = (0, import_react.useState)(prefsRef.current.mode);
	const [engine, setEngine] = (0, import_react.useState)(prefsRef.current.engine);
	const [startAt, setStartAt] = (0, import_react.useState)("");
	const [endAt, setEndAt] = (0, import_react.useState)("");
	const [segments, setSegments] = (0, import_react.useState)([]);
	const [activeId, setActiveId] = (0, import_react.useState)(null);
	const [query, setQuery] = (0, import_react.useState)("");
	const [scan, setScan] = (0, import_react.useState)(null);
	const [note, setNote] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [hydrated, setHydrated] = (0, import_react.useState)(false);
	const [autoStart, setAutoStart] = (0, import_react.useState)(false);
	prefsRef.current = {
		langs,
		region,
		mode,
		engine
	};
	rangeRef.current = {
		start: startAt,
		end: endAt
	};
	(0, import_react.useEffect)(() => {
		const prefs = readPrefs();
		setLangs(prefs.langs);
		setRegion(prefs.region);
		setMode(prefs.mode);
		setEngine(prefs.engine);
		setHydrated(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		localStorage.setItem(PREF_KEY, JSON.stringify({
			langs,
			region,
			mode,
			engine
		}));
	}, [
		hydrated,
		langs,
		region,
		mode,
		engine
	]);
	(0, import_react.useEffect)(() => {
		urlRef.current = url;
	}, [url]);
	(0, import_react.useEffect)(() => {
		return () => {
			abortRef.current?.abort();
			if (urlRef.current) URL.revokeObjectURL(urlRef.current);
		};
	}, []);
	function adoptFile(file) {
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
		setScan({
			kind: "model",
			label: "正在准备识别模型",
			progress: 0
		});
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
				onSegments: setSegments
			});
			setPhase("done");
			if (result.stopped) setNote("已停止，保留了已经识别出的文字。");
			else if (result.segments.length === 0) setNote(prefsRef.current.engine === "paddle" ? "没有识别到文字。可以改成「全画面」，或换「整页识别」再试。" : "没有识别到文字。可以改成「底部字幕」或「成块文字」再试。");
			else setNote("");
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
	(0, import_react.useEffect)(() => {
		if (!autoStart || duration == null) return;
		setAutoStart(false);
		start();
	}, [autoStart, duration]);
	function stop() {
		abortRef.current?.abort();
	}
	function onLoadedMetadata() {
		const video = videoRef.current;
		if (!video || !Number.isFinite(video.duration)) return;
		setDuration(video.duration);
	}
	function seekSegment(segment) {
		const video = videoRef.current;
		setActiveId(segment.id);
		if (!video) return;
		video.pause();
		video.currentTime = segment.start;
	}
	const busy = phase === "preparing" || phase === "loading" || phase === "running";
	const frames = duration == null ? 0 : countFrames(duration, startAt, endAt);
	const visible = query.trim() ? segments.filter((segment) => segment.text.toLowerCase().includes(query.trim().toLowerCase())) : segments;
	const chars = segments.reduce((sum, segment) => sum + segment.text.replace(/\s/g, "").length, 0);
	const bar = Math.max(0, Math.min(1, scan?.progress ?? 0));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "shell",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
				theme: "dark",
				position: "top-center"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mark",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScanText, {})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium text-primary",
						children: "视频文字解析"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-serif text-4xl text-fg",
						children: "帧析"
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "badge",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
							className: "text-primary",
							children: 5
						}), "帧/秒"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "badge",
						children: "浏览器本地 · 不上传"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 max-w-2xl text-muted",
				children: "按每秒五帧拆开画面，读出上面的字。字幕、标题、课件、包装都能抽，视频只留在这台设备上。"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
				className: "steps",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "1" }), "放入视频"] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "2" }), "每秒拆五帧"] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "3" }), "带时间的文稿"] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "studio-grid",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel stage",
					children: [
						url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "player-wrap",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
								ref: videoRef,
								className: "player",
								src: url,
								controls: phase !== "loading" && phase !== "running",
								playsInline: true,
								preload: "auto",
								onLoadedMetadata,
								onError: () => {
									setError("这个浏览器播不了该视频，请换 mp4 或 webm");
									setPhase("error");
								}
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: over ? "drop is-over" : "drop",
							onDragOver: (event) => {
								event.preventDefault();
								setOver(true);
							},
							onDragLeave: () => setOver(false),
							onDrop: (event) => {
								event.preventDefault();
								setOver(false);
								const file = event.dataTransfer.files[0];
								if (file) adoptFile(file);
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { "aria-hidden": "true" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-lg font-medium",
									children: "把视频拖到这里"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-muted",
									children: "mp4、webm、mov"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "actions",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn btn-primary",
										onClick: () => inputRef.current?.click(),
										disabled: busy,
										children: "选择视频"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "btn btn-ghost",
										onClick: () => void onDemo(),
										disabled: busy,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clapperboard, {
											"aria-hidden": "true",
											className: "size-4"
										}), "示例片段"]
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							ref: inputRef,
							className: "sr-only",
							type: "file",
							accept: "video/mp4,video/webm,video/quicktime,video/*",
							suppressHydrationWarning: true,
							onChange: (event) => {
								const file = event.target.files?.[0];
								event.target.value = "";
								if (file) adoptFile(file);
							}
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "controls",
							children: [
								url ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "min-w-0 truncate text-sm text-muted",
										children: fileName
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn btn-ghost",
											onClick: () => inputRef.current?.click(),
											disabled: busy,
											children: "换一个"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn btn-ghost",
											onClick: () => void onDemo(),
											disabled: busy,
											children: "示例"
										})]
									})]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "block text-sm text-muted",
									children: ["语言", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "select-wrap mt-1 block",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
											className: "field",
											value: langs,
											disabled: busy,
											onChange: (event) => setLangs(event.target.value),
											children: LANGS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: item.id,
												children: item.label
											}, item.id))
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, {
											className: "size-4",
											"aria-hidden": "true"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mb-1 text-sm text-muted",
										children: "引擎"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "seg",
										role: "group",
										"aria-label": "识别引擎",
										children: ENGINES.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											"aria-pressed": engine === item.id,
											disabled: busy,
											onClick: () => setEngine(item.id),
											children: item.label
										}, item.id))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-sm text-muted",
										children: engine === "paddle" ? "先框出每一行再识别，同一句用多帧投票。第一次要下载模型。" : "整页交给 Tesseract，不单独检测文字位置。"
									})
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-1 text-sm text-muted",
									children: "识别区域"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "seg",
									role: "group",
									"aria-label": "识别区域",
									children: REGIONS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										"aria-pressed": region === item.id,
										disabled: busy,
										onClick: () => setRegion(item.id),
										children: item.label
									}, item.id))
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-1 text-sm text-muted",
									children: "版面"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "seg",
									role: "group",
									"aria-label": "版面",
									children: MODES.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										"aria-pressed": mode === item.id,
										disabled: busy || engine === "paddle",
										onClick: () => setMode(item.id),
										children: item.label
									}, item.id))
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "times",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "block text-sm text-muted",
										children: ["开始（秒）", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											className: "field mt-1",
											inputMode: "decimal",
											placeholder: "片头",
											value: startAt,
											disabled: busy,
											suppressHydrationWarning: true,
											onChange: (event) => setStartAt(event.target.value)
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "block text-sm text-muted",
										children: ["结束（秒）", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											className: "field mt-1",
											inputMode: "decimal",
											placeholder: "片尾",
											value: endAt,
											disabled: busy,
											suppressHydrationWarning: true,
											onChange: (event) => setEndAt(event.target.value)
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "actions",
									children: [phase === "loading" || phase === "running" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "btn btn-stop",
										onClick: stop,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, {
											className: "size-4",
											"aria-hidden": "true"
										}), "停止"]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "btn btn-primary",
										disabled: !url || phase === "preparing",
										onClick: () => void start(),
										children: [phase === "preparing" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
											className: "spin size-4",
											"aria-hidden": "true"
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScanText, {
											className: "size-4",
											"aria-hidden": "true"
										}), phase === "done" ? "重新解析" : "开始解析"]
									}), !url ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn btn-ghost",
										disabled: busy || duration == null,
										onClick: () => setEndAt(duration != null && duration > 60 ? "60" : ""),
										children: "只看前 60 秒"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-sm text-muted tabular-nums",
									children: [
										"固定每秒 ",
										5,
										" 帧",
										duration != null ? ` · 片长 ${formatStamp(duration)} · 约 ${frames} 帧` : ""
									]
								}),
								frames > 600 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-primary",
									children: "这段比较长，识别会花一些时间，可以先填开始和结束。"
								}) : null,
								scan && (phase === "loading" || phase === "running" || phase === "done") ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mb-2 flex items-center justify-between gap-3 text-sm",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: scan.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "tabular-nums text-muted",
											children: [scan.frame && scan.total ? `${scan.frame}/${scan.total}` : `${Math.round(bar * 100)}%`, scan.time != null ? ` · ${formatStamp(scan.time)}` : ""]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "bar",
										"aria-hidden": "true",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: `${bar * 100}%` } })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "live mt-2 text-sm",
										"aria-live": "polite",
										children: scan.liveText || " "
									})
								] }) : null,
								error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "alert",
									role: "alert",
									children: error
								}) : null,
								note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-muted",
									children: note
								}) : null
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel transcript",
					"aria-label": "文稿",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "transcript-head",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-serif text-2xl",
								children: "文稿"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted tabular-nums",
								children: segments.length > 0 ? `${segments.length} 段 · ${chars} 字` : "同一句会合并成一段"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn btn-ghost btn-icon",
										"aria-label": "复制全文",
										disabled: segments.length === 0,
										onClick: () => void copyText(buildTxt(segments)),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn btn-ghost btn-icon",
										"aria-label": "下载 TXT",
										disabled: segments.length === 0,
										onClick: () => download(`${stem(fileName)}.txt`, buildTxt(segments)),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn btn-ghost",
										disabled: segments.length === 0,
										onClick: () => download(`${stem(fileName)}.srt`, buildSrt(segments)),
										children: "SRT"
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "px-4 pb-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "field",
								placeholder: "在文稿里搜索",
								value: query,
								suppressHydrationWarning: true,
								onChange: (event) => setQuery(event.target.value)
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "cue-list",
							children: visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "px-2 py-8 text-center text-sm text-muted",
								children: segments.length === 0 ? "解析之后，每段文字会带着时间和画面缩略图出现在这里。" : "没有匹配的文字。"
							}) : visible.map((segment) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: segment.id === activeId ? "cue is-on" : "cue",
								onClick: () => seekSegment(segment),
								children: [
									segment.thumb ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										className: "thumb",
										src: segment.thumb,
										alt: ""
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "thumb" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "block text-sm tabular-nums text-muted",
											children: [
												formatStamp(segment.start),
												" – ",
												formatStamp(segment.end),
												segment.samples > 1 ? ` · ${segment.samples} 帧` : ""
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "cue-text mt-1 block",
											children: segment.text
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "cue-side text-sm tabular-nums text-muted",
										children: segment.confidence > 0 ? `${segment.confidence}%` : ""
									})
								]
							}, segment.id))
						})
					]
				})]
			})
		]
	});
}
var SplitComponent = Studio;
//#endregion
export { SplitComponent as component };
