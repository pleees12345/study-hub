/**
 * Download links for the desktop apps.
 *
 * The installers are hosted on GitHub Releases:
 *   https://github.com/pleees12345/study-hub/releases
 *
 * Each link is a direct download (no warning page, works for files up to 2 GB).
 */
export const DOWNLOADS = {
  mac: "https://github.com/pleees12345/study-hub/releases/download/v2.0.0/Study-Hub-2.0.0-mac-arm64.dmg",
  windows: "https://github.com/pleees12345/study-hub/releases/download/v2.0.0/Study-Hub-2.0.0-win-x64.exe",
};

/** Human-readable labels + metadata for the download UI. */
export const PLATFORMS = [
  {
    id: "mac",
    label: "macOS",
    detail: "Apple Silicon (M1/M2/M3)",
    ext: ".dmg",
    url: DOWNLOADS.mac,
  },
  {
    id: "windows",
    label: "Windows",
    detail: "x64 (64-bit)",
    ext: ".exe",
    url: DOWNLOADS.windows,
  },
] as const;