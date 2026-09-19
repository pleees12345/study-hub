/**
 * Download links for the desktop apps.
 *
 * The installers are hosted on Google Drive. Links use the standard Drive
 * share link, which opens the Drive page where the user clicks "Download".
 * (The files are >100 MB, so Google Drive shows its own warning/confirm page —
 * the standard share link handles this most reliably.)
 */

export const DOWNLOADS = {
  mac: "https://drive.google.com/file/d/16GLxo7pAX8tIO-DPgOZ-rpc0iWsO1_lT/view?usp=sharing",
  windows: "https://drive.google.com/file/d/1U_jxwZPxuiNkgaS7a5yfOAbmgyub7iT5/view?usp=sharing",
};

/** True when a link is a real Drive link (not a placeholder). */
export function isConfigured(url: string): boolean {
  return /drive\.google\.com/.test(url);
}

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