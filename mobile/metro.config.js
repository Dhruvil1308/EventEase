// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Release bundles inline EXPO_PUBLIC_* values, but Metro's transform cache doesn't
// know about them: without this, changing EXPO_PUBLIC_API_URL keeps the old URL.
config.cacheVersion = Object.keys(process.env)
  .filter((key) => key.startsWith("EXPO_PUBLIC_"))
  .sort()
  .map((key) => `${key}=${process.env[key]}`)
  .join("&");

module.exports = config;
