/**
 * Builds an installable Android APK on this machine:
 *
 *   npm run build:apk                 # → dist/EventEase.apk (phones + emulator)
 *   ABIS=arm64-v8a npm run build:apk  # phones only, smaller
 *
 * Finds a JDK 17 (JAVA_HOME, ~/.jdks, /usr/lib/jvm) and the Android SDK
 * (ANDROID_HOME, ~/Android/Sdk), regenerates the native project from app.json
 * (`expo prebuild --clean`, so settings removed from app.json disappear too), and
 * runs Gradle's release build. The release is signed
 * with the debug key, which is fine for sideloading; the Play Store needs your
 * own upload key (see README).
 */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { cpus, homedir, totalmem } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const home = homedir();

function findJdk() {
  if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, "bin/java"))) return process.env.JAVA_HOME;
  for (const dir of [join(home, ".jdks"), "/usr/lib/jvm"]) {
    if (!existsSync(dir)) continue;
    const jdk = readdirSync(dir)
      .filter((d) => /17/.test(d))
      .map((d) => join(dir, d))
      .find((d) => existsSync(join(d, "bin/javac")));
    if (jdk) return jdk;
  }
  throw new Error("No JDK 17 found. Install one (e.g. Temurin 17) or set JAVA_HOME.");
}

function findSdk() {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? join(home, "Android/Sdk");
  if (!existsSync(join(sdk, "platform-tools"))) throw new Error(`No Android SDK at ${sdk}. Install it or set ANDROID_HOME.`);
  return sdk;
}

const JAVA_HOME = findJdk();
const ANDROID_HOME = findSdk();
const env = {
  ...process.env,
  JAVA_HOME,
  ANDROID_HOME,
  ANDROID_SDK_ROOT: ANDROID_HOME,
  NODE_ENV: "production",
  EXPO_NO_GIT_STATUS: "1", // android/ is generated and gitignored; don't ask about uncommitted changes
  CI: "1",
  PATH: `${JAVA_HOME}/bin:${ANDROID_HOME}/platform-tools:${process.env.PATH}`,
};
const run = (cmd, cwd = root) => {
  console.log(`\n▸ ${cmd}`);
  execSync(cmd, { cwd, env, stdio: "inherit" });
};

/**
 * Slow connections: Gradle's wrapper gives up after 10 s, and a fresh Gradle is
 * ~130 MB, so allow 2 minutes. Don't substitute another Gradle release — each
 * bundles its own Kotlin, and React Native's build plugins only compile against
 * the one they were made for.
 */
function tuneGradleWrapper() {
  const file = join(root, "android/gradle/wrapper/gradle-wrapper.properties");
  writeFileSync(file, readFileSync(file, "utf8").replace(/networkTimeout=\d+/, "networkTimeout=120000"));
}

console.log(`JDK:         ${JAVA_HOME}\nAndroid SDK: ${ANDROID_HOME}`);
run("npx expo prebuild --clean --platform android --no-install");
tuneGradleWrapper();
const abis = process.env.ABIS ?? "arm64-v8a,armeabi-v7a,x86_64";
// Native (C++) compiles take ~1 GB each; keep parallel work within ~3 GB of RAM per worker.
const workers = Math.max(2, Math.min(cpus().length, Math.floor(totalmem() / 2 ** 30 / 3)));
run(
  `./gradlew assembleRelease -PreactNativeArchitectures=${abis} --max-workers=${workers} -Pkotlin.daemon.jvmargs=-Xmx1536m --console=plain`,
  join(root, "android"),
);

const apk = join(root, "android/app/build/outputs/apk/release/app-release.apk");
mkdirSync(join(root, "dist"), { recursive: true });
const out = join(root, "dist/EventEase.apk");
copyFileSync(apk, out);
console.log(`\n✓ ${out}  (${(statSync(out).size / 1024 / 1024).toFixed(1)} MB)`);
