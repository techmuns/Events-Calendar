import { useEffect, useState } from "react";

// Remember whether a collapsible panel is expanded, across reloads.
export function usePersistedOpen(key: string, def: boolean): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem(key);
      return s === null ? def : s === "1";
    } catch {
      return def;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [key, open]);
  return [open, setOpen];
}
