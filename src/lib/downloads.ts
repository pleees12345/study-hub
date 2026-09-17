/**
 * Download links for the desktop apps.
 * These point to the latest release assets hosted on GitHub Releases.
 *
 * To publish, build the apps with `npm run electron:build` and
 * `npm run electron:build:win`, upload the `.dmg` / `.zip` / `.exe` files
 * to a GitHub Release, then replace the owner/repo below.
 */
export const GITHUB_OWNER = "ericdraperi";
export const GITHUB_REPO = "study-hub";

const LATEST = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download`;

/** Direct download URLs for each platform asset. */
export const DOWNLOADS = {
  mac: `${LATEST}/Study-Hub-2.0.0-mac-arm64.dmg`,
  macZip: `${LATEST}/Study-Hub-2.0.0-mac-arm64.zip`,
  windows: `${LATEST}/Study-Hub-2.0.0-win-x64.exe`,
  windowsZip: `${LATEST}/Study-Hub-2.0.0-win-x64.zip`,
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