"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

const SCAN_INTERVAL_MS = 140;
const REPEAT_COOLDOWN_MS = 2500;
const MAX_DECODE_WIDTH = 640;

async function createDetector(): Promise<BarcodeDetectorLike | null> {
  const Ctor = (
    globalThis as unknown as {
      BarcodeDetector?: BarcodeDetectorCtor & { getSupportedFormats?: () => Promise<string[]> };
    }
  ).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const formats = (await Ctor.getSupportedFormats?.()) ?? ["qr_code"];
    return formats.includes("qr_code") ? new Ctor({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

/** Decodes a QR from any drawable source with jsQR (pure JS fallback). */
function decodeWithJsQR(source: CanvasImageSource, width: number, height: number, canvas: HTMLCanvasElement) {
  const scale = Math.min(1, MAX_DECODE_WIDTH / width);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  return jsQR(data.data, w, h, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

export async function decodeQrFromFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const detector = await createDetector();
    if (detector) {
      const found = await detector.detect(bitmap).catch(() => []);
      if (found[0]?.rawValue) return found[0].rawValue;
    }
    return decodeWithJsQR(bitmap, bitmap.width, bitmap.height, document.createElement("canvas"));
  } finally {
    bitmap.close();
  }
}

type ScannerState = "starting" | "scanning" | "denied" | "unavailable" | "insecure";

export function QrScanner({ onResult, paused = false }: { onResult: (text: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const onResultRef = useRef(onResult);
  const pausedRef = useRef(paused);
  const [state, setState] = useState<ScannerState>("starting");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(-1);

  useEffect(() => {
    onResultRef.current = onResult;
    pausedRef.current = paused;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let lastScan = 0;
    let cancelled = false;
    let busy = false;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setState(window.isSecureContext ? "unavailable" : "insecure");
        return;
      }
      setState("starting");
      try {
        const deviceId = deviceIndex >= 0 ? devices[deviceIndex]?.deviceId : undefined;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
        return;
      }
      if (cancelled || !video.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      setState("scanning");
      if (!devices.length) {
        const all = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) setDevices(all.filter((d) => d.kind === "videoinput"));
      }

      const detector = await createDetector();
      const tick = async (now: number) => {
        if (cancelled) return;
        raf = requestAnimationFrame(tick);
        const v = video.current;
        if (busy || pausedRef.current || !v || v.readyState < 2 || now - lastScan < SCAN_INTERVAL_MS) return;
        lastScan = now;
        busy = true;
        try {
          let text: string | null = null;
          if (detector) {
            const found = await detector.detect(v).catch(() => []);
            text = found[0]?.rawValue ?? null;
          } else if (canvas.current) {
            text = decodeWithJsQR(v, v.videoWidth, v.videoHeight, canvas.current);
          }
          if (text) {
            const t = performance.now();
            if (text !== last.current.text || t - last.current.at > REPEAT_COOLDOWN_MS) {
              last.current = { text, at: t };
              onResultRef.current(text);
            }
          }
        } finally {
          busy = false;
        }
      };
      raf = requestAnimationFrame(tick);
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // Restart only when the chosen camera changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceIndex]);

  const message: Record<Exclude<ScannerState, "scanning">, { title: string; body: string }> = {
    starting: { title: "Starting camera…", body: "Allow camera access when your browser asks." },
    denied: {
      title: "Camera blocked",
      body: "Allow camera access in your browser's site settings, or type the code instead.",
    },
    unavailable: { title: "No camera found", body: "Use manual entry, or scan from an image of the QR." },
    insecure: {
      title: "Camera needs HTTPS",
      body: "Browsers only allow cameras on https:// or localhost. Use manual entry, or run `npm run dev:https`.",
    },
  };

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      <video ref={video} className="h-full w-full object-cover" playsInline muted aria-label="Camera preview" />
      <canvas ref={canvas} className="hidden" />

      {/* Viewfinder overlay */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative aspect-square w-[58%] max-w-[300px]">
          {[
            "left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl",
            "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl",
            "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
            "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl",
          ].map((c) => (
            <span key={c} className={`absolute h-10 w-10 border-cyan ${c}`} />
          ))}
          {state === "scanning" && !paused && (
            <span className="absolute inset-x-2 top-1/2 h-0.5 animate-[scan-line_2.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-cyan to-transparent shadow-[0_0_16px_#22d3ee]" />
          )}
        </div>
      </div>

      {state !== "scanning" && (
        <div className="absolute inset-0 grid place-items-center bg-ink-950/85 p-6 text-center backdrop-blur-sm">
          <div className="max-w-xs">
            <p className="font-display text-lg font-semibold text-white">{message[state].title}</p>
            <p className="mt-2 text-sm text-zinc-400">{message[state].body}</p>
          </div>
        </div>
      )}

      {state === "scanning" && devices.length > 1 && (
        <button
          type="button"
          onClick={() => setDeviceIndex((i) => (i + 1) % devices.length)}
          className="absolute right-3 bottom-3 rounded-xl px-3 py-2 text-xs font-medium text-white glass-strong"
        >
          Switch camera
        </button>
      )}
      {paused && state === "scanning" && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-center text-xs text-zinc-300">
          Processing…
        </div>
      )}
    </div>
  );
}
