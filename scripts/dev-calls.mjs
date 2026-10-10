/**
 * Local development with Aanaya's reminder calls, in one command:
 *
 *   npm run dev:calls              # port 3000, or the next free one
 *   PORT=3005 npm run dev:calls    # a fixed port
 *
 * Starts `next dev` and the ngrok tunnel on the same port, so Vobiz webhooks
 * reach this machine, and passes PORT to the app so its reminder scheduler
 * calls itself on the right port. Ctrl+C stops both.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import { findTunnel, startTunnel } from "./tunnel.mjs";

const isFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, () => server.close(() => resolve(true)));
  });

async function pickPort() {
  if (process.env.PORT) {
    const port = Number(process.env.PORT);
    if (!(await isFree(port))) {
      console.error(`Port ${port} is already in use — stop that app or choose another PORT.`);
      process.exit(1);
    }
    return port;
  }
  for (let port = 3000; port < 3020; port++) if (await isFree(port)) return port;
  console.error("No free port between 3000 and 3019.");
  process.exit(1);
}

const port = await pickPort();
if (port !== 3000) console.log(`Port 3000 is busy, so EventEase runs on ${port}.`);

const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port)], {
  stdio: "inherit",
  env: { ...process.env, PORT: String(port) },
});
const { child: tunnel, url } = startTunnel(port, { quiet: true });

const children = [app, tunnel];
let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500);
};
app.on("exit", (code) => stop(code ?? 0));
tunnel.on("exit", (code) => {
  if (!stopping) console.error(`ngrok stopped (exit ${code}). Check NGROK_AUTHTOKEN / NGROK_DOMAIN in .env.`);
  stop(code ?? 1);
});
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

// Confirm the tunnel is up and pointing at this app before announcing it.
for (let i = 0; i < 30 && !stopping; i++) {
  const live = await findTunnel(port);
  if (live) {
    console.log(`\n  ▸ EventEase   http://localhost:${port}`);
    console.log(`  ▸ Webhooks    ${live}  (Vobiz → this machine)\n`);
    break;
  }
  if (i === 29) console.warn(`\n  ⚠ ngrok didn't report a tunnel to port ${port}${url ? ` (${url})` : ""} yet.\n`);
  await new Promise((r) => setTimeout(r, 500));
}
