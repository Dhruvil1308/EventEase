import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ApiError, authHeaders } from "./api";
import { API_URL } from "./config";

/** Downloads a CSV from the API (signed in) and opens Android's share sheet for it. */
export async function shareCsv(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: await authHeaders() });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
    throw new ApiError(body?.error?.message ?? `Export failed (HTTP ${res.status}).`, res.status, body?.error?.code ?? "EXPORT_FAILED");
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(await res.text());
  if (!(await Sharing.isAvailableAsync())) throw new ApiError("Sharing isn't available on this device.", 0, "NO_SHARE");
  await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Share the attendance sheet" });
}
