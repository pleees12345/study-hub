import { useEffect, useState } from "react";

export type Theme = "sepia" | "dark" | "white";

const STORAGE_KEY = "study-hub-theme";

function normalizeTheme(value: string | null): Theme {
  if (value === "dark" || value === "sepia") return value;
  // Migrate the old "glass" value to the new "white" name.
  if (value === "glass" || value === "white") return "white";
  return "sepia";
}

export function getTheme(): Theme {
  if (typeof window === "undefined") return "sepia";
  const saved = localStorage.getItem(STORAGE_KEY);
  return normalizeTheme(saved);
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

/** App-wide theme hook. Persists the choice and reflects it on <html data-theme>. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return { theme, setTheme };
}
