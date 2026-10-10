/**
 * Opens the ngrok tunnel Vobiz uses to reach Aanaya's webhooks during local
 * development:
 *
 *   ngrok http <PORT> --url <NGROK_DOMAIN>
 *
 *   npm run tunnel              # next to `npm run dev` (port 3000)
 *   PORT=3001 npm run tunnel    # when the app runs on another port
 *
 * NGROK_DOMAIN (your free static domain) and NGROK_AUTHTOKEN come from .env;
 * without a domain ngrok hands out a random URL, which works too. The app
 * finds the tunnel through ngrok's local API, so nothing else needs setting.
 * `npm run dev:calls` starts the app and this tunnel together.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

/** .env values, without loading them into this process. */
export function readDotEnv() {
  return existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")) : {};
}

/** The static domain from NGROK_DOMAIN, with or without its https:// prefix. */
export function ngrokDomain(dotEnv = readDotEnv()) {
  const raw = (process.env.NGROK_DOMAIN ?? dotEnv.NGROK_DOMAIN)?.trim();
  return raw ? raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null;
}

/**
 * Starts ngrok for `port`. `quiet` swaps ngrok's full-screen view for warnings
 * on stdout, so it can share a terminal with `next dev`.
 */
export function startTunnel(port, { quiet = false } = {}) {
  const dotEnv = readDotEnv();
  const args = ["http", String(port)];
  const domain = ngrokDomain(dotEnv);
  if (domain) args.push("--url", domain);
  if (quiet) args.push("--log", "stdout", "--log-format", "logfmt", "--log-level", "warn");

  const env = { ...process.env };
  // ngrok reads NGROK_AUTHTOKEN itself; `ngrok config add-authtoken` works as well.
  if (!env.NGROK_AUTHTOKEN && dotEnv.NGROK_AUTHTOKEN) env.NGROK_AUTHTOKEN = dotEnv.NGROK_AUTHTOKEN;

  const child = spawn("ngrok", args, { stdio: quiet ? ["ignore", "inherit", "inherit"] : "inherit", env });
  child.on("error", (error) => {
    console.error(
      error.code === "ENOENT" ? "ngrok isn't installed — get it from https://ngrok.com/download" : error.message,
    );
    process.exit(1);
  });
  return { child, url: domain ? `https://${domain}` : null };
}

/** The https tunnel ngrok has open to `port`, from its local API (null if none yet). */
export async function findTunnel(port) {
  try {
    const res = await fetch(process.env.NGROK_API_URL ?? "http://127.0.0.1:4040/api/tunnels", {
      signal: AbortSignal.timeout(800),
    });
    const { tunnels = [] } = await res.json();
    return (
      tunnels.find((t) => t.public_url?.startsWith("https://") && t.config?.addr?.endsWith(`:${port}`))?.public_url ??
      null
    );
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const { child } = startTunnel(port);
  child.on("exit", (code) => process.exit(code ?? 0));
}
