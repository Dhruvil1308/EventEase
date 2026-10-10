"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { Spinner } from "@/components/ui/Button";
import { compressImage } from "@/lib/image-compress";
import { formatBytes, MAX_IMAGE_BYTES } from "@/lib/media";

type Props = {
  label: string;
  /** Current image, if any. */
  value: string | null;
  shape?: "avatar" | "banner";
  /**
   * Upload straight away to this endpoint (PUT multipart `file`, DELETE to
   * remove). Without it the compressed file is handed to `onFile` instead —
   * for forms that upload after the record exists.
   */
  endpoint?: string;
  onChange?: (url: string | null) => void;
  onFile?: (file: File | null) => void;
  /** Text shown inside an empty avatar. */
  initials?: string;
  hint?: string;
};

export function ImageUpload({ label, value, shape = "banner", endpoint, onChange, onFile, initials, hint }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value);
  const [seenValue, setSeenValue] = useState(value);
  const [busy, setBusy] = useState<"compressing" | "uploading" | "removing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  if (value !== seenValue) {
    setSeenValue(value);
    setPreview(value);
  }

  async function take(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    try {
      setBusy("compressing");
      const small =
        file.size <= MAX_IMAGE_BYTES - 8 * 1024 && file.type !== "image/heic"
          ? file
          : await compressImage(file, shape === "avatar" ? { maxWidth: 640, maxHeight: 640 } : {});
      setSize(small.size);
      const local = URL.createObjectURL(small);
      setPreview(local);

      if (!endpoint) {
        onFile?.(small);
        setBusy(null);
        return;
      }
      setBusy("uploading");
      const form = new FormData();
      form.append("file", small);
      const res = await fetch(endpoint, { method: "PUT", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.fields?.file?.[0] ?? data.error?.message ?? "Upload failed.");
      const url: string | null = data.avatarUrl ?? data.coverUrl ?? null;
      setPreview(url ?? local);
      onChange?.(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setPreview(value);
      setSize(null);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setError(null);
    if (!endpoint) {
      setPreview(null);
      setSize(null);
      onFile?.(null);
      return;
    }
    setBusy("removing");
    const res = await fetch(endpoint, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      setError("Couldn't remove the image.");
      return;
    }
    setPreview(null);
    setSize(null);
    onChange?.(null);
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    take(e.dataTransfer.files?.[0]);
  };

  const frame = shape === "avatar" ? "h-28 w-28 rounded-full" : "aspect-[16/7] w-full rounded-2xl";

  return (
    <div className="space-y-2">
      <p id={`${id}-label`} className="text-sm font-medium text-zinc-200">
        {label}
      </p>
      <div className={shape === "avatar" ? "flex items-center gap-5" : "space-y-3"}>
        <button
          type="button"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={busy !== null}
          className={`group relative shrink-0 overflow-hidden border-2 border-dashed transition-[border-color,box-shadow] duration-300 ${frame} ${
            dragging
              ? "border-cyan shadow-[0_0_0_6px_rgba(34,211,238,0.15)]"
              : preview
                ? "border-transparent"
                : "border-white/15 hover:border-violet-soft/60"
          } bg-ink-900/70`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob previews and ≤300 KB storage images
            <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : shape === "avatar" ? (
            <span className="absolute inset-0 grid place-items-center bg-aurora font-display text-3xl font-bold text-ink-950">
              {initials || "?"}
            </span>
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-400">
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden
              >
                <path
                  d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-sm">Drop an image or click to choose</span>
            </span>
          )}
          <span className="absolute inset-0 grid place-items-center bg-ink-950/60 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
            {preview ? "Change" : "Upload"}
          </span>
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-ink-950/70 text-xs text-white">
              <span className="flex items-center gap-2">
                <Spinner className="h-4 w-4" />
                {busy === "compressing" ? "Optimising…" : busy === "uploading" ? "Uploading…" : "Removing…"}
              </span>
            </span>
          )}
        </button>
        <div className="space-y-2 text-xs">
          <p id={`${id}-hint`} className="text-zinc-500">
            {hint ?? "JPEG, PNG or WebP."} Large photos are optimised automatically to fit the{" "}
            {formatBytes(MAX_IMAGE_BYTES)} limit.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {size !== null && (
              <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 font-mono text-[11px] text-success">
                {formatBytes(size)} / {formatBytes(MAX_IMAGE_BYTES)}
              </span>
            )}
            {preview && (
              <button
                type="button"
                onClick={remove}
                disabled={busy !== null}
                className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-danger/40 hover:text-danger"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => take(e.target.files?.[0])}
      />
    </div>
  );
}
