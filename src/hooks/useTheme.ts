import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function initial(): Theme {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem("ec-theme") : null;
  if (saved === "light" || saved === "dark") return saved;
  return systemDark() ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("ec-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return { theme, isDark: theme === "dark", toggle };
}
