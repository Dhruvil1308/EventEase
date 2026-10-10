/** Reads a WAV header well enough to know how long the audio plays. */
export function wavDurationMs(bytes: Uint8Array): number | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.slice(offset, offset + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;

  let byteRate = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt ") byteRate = view.getUint32(offset + 16, true);
    if (id === "data") {
      if (!byteRate) return null;
      // Streaming encoders sometimes leave the size as 0 or 0xFFFFFFFF; use what's actually there.
      const available = bytes.length - (offset + 8);
      const dataBytes = size > 0 && size <= available ? size : available;
      return Math.round((dataBytes / byteRate) * 1000);
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

/** What kind of audio file this is, from its first bytes — extensions on recordings can't be trusted. */
export function sniffAudio(bytes: Uint8Array): { mime: string; ext: string } {
  const ascii = String.fromCharCode(...bytes.slice(0, 4));
  if (ascii === "RIFF") return { mime: "audio/wav", ext: "wav" };
  if (ascii === "OggS") return { mime: "audio/ogg", ext: "ogg" };
  if (ascii === "fLaC") return { mime: "audio/flac", ext: "flac" };
  return { mime: "audio/mpeg", ext: "mp3" };
}
