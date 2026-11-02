import { assetUrl } from "@/lib/asset-url";

export type Engine = "paddle" | "tesseract";

type LineItem = {
  text?: string;
  score?: number;
  poly?: number[][];
};

type PaddleSession = {
  predict: (
    image: HTMLCanvasElement,
    params?: Record<string, unknown>,
  ) => Promise<Array<{ items?: LineItem[] }>>;
};

const sessions = new Map<string, Promise<PaddleSession>>();

export function paddleLang(langs: string): string {
  if (langs.startsWith("chi_tra")) return "chinese_cht";
  if (langs.startsWith("jpn")) return "japan";
  if (langs === "eng") return "en";
  return "ch";
}

function localAsset(path: string): string {
  return new URL(assetUrl(path), window.location.href).href;
}

export function loadPaddle(langs: string): Promise<PaddleSession> {
  const lang = paddleLang(langs);
  const cached = sessions.get(lang);
  if (cached) return cached;
  const pending = import("@paddleocr/paddleocr-js")
    .then(({ PaddleOCR }) =>
      PaddleOCR.create({
        lang,
        ocrVersion: "PP-OCRv5",
        worker: false,
        textDetectionModelName: "PP-OCRv5_mobile_det",
        textRecognitionModelName: "PP-OCRv5_mobile_rec",
        textDetectionModelAsset: { url: localAsset("/paddle/det.tar") },
        textRecognitionModelAsset: { url: localAsset("/paddle/rec.tar") },
        textRecScoreThresh: 0.3,
        textDetThresh: 0.3,
        textDetBoxThresh: 0.4,
        textDetUnclipRatio: 1.6,
        ortOptions: {
          backend: "wasm",
          wasmPaths: localAsset("/ort/"),
          numThreads: 1,
          simd: true,
          proxy: false,
          disableWasmProxy: true,
        },
      }),
    )
    .then((ocr) => ocr as PaddleSession);
  sessions.set(lang, pending);
  pending.catch(() => {
    sessions.delete(lang);
  });
  return pending;
}

function meaningful(text: string): boolean {
  if ((text.match(/\p{Script=Han}/gu) ?? []).length >= 1) return true;
  if (text.replace(/[^A-Za-z]/g, "").length >= 2) return true;
  if (text.replace(/\D/g, "").length >= 2) return true;
  return false;
}

export async function recognizePaddle(
  session: PaddleSession,
  canvas: HTMLCanvasElement,
): Promise<{ text: string; confidence: number }> {
  const [page] = await session.predict(canvas, {
    textRecScoreThresh: 0.3,
    textDetThresh: 0.3,
    textDetBoxThresh: 0.4,
    textDetUnclipRatio: 1.6,
  });
  const lines = (page?.items ?? [])
    .map((item) => ({
      text: (item.text || "").replace(/[|¦]/g, "").trim(),
      score: item.score ?? 0,
      y: item.poly?.[0]?.[1] ?? 0,
      x: item.poly?.[0]?.[0] ?? 0,
    }))
    .filter((line) => line.text && line.score >= 0.3 && meaningful(line.text))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (lines.length === 0) return { text: "", confidence: 0 };
  const confidence = (lines.reduce((sum, line) => sum + line.score, 0) / lines.length) * 100;
  return { text: lines.map((line) => line.text).join("\n"), confidence };
}
