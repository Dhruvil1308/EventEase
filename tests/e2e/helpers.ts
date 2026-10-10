import { crc32, deflateSync } from "node:zlib";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "eventease123";

/** Signs a fresh `@e2e.test` account up through the UI (the teardown deletes it afterwards). */
export async function signUp(page: Page, portal: "host" | "attendee", name: string, email: string) {
  await page.goto(portal === "host" ? "/host/signup" : "/signup");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(portal === "host" ? /\/host$/ : /\/dashboard$/);
}

/**
 * A real PNG built in memory, so upload tests need no fixture files: a colour
 * gradient, plus random noise of up to `noise` per channel to make it big and
 * hard to compress (a stand-in for a phone photo).
 */
export function makePng(width: number, height: number, { noise = 0 } = {}): Buffer {
  const row = width * 3 + 1;
  const raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * row + 1 + x * 3;
      const jitter = () => (noise ? Math.floor(Math.random() * noise) : 0);
      raw[i] = ((x / width) * 200 + jitter()) & 255;
      raw[i + 1] = ((y / height) * 160 + jitter()) & 255;
      raw[i + 2] = (120 + jitter()) & 255;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
