"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "bluespherix-theme";

function appliedTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function storedTheme() {
  try { return localStorage.getItem(STORAGE_KEY); }
  catch { return null; }
}

function applyTheme(theme: Theme, remember: boolean) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.dataset.themeChanging = "true";
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#edf4f3" : "#070a0f");
  if (remember) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }
  window.dispatchEvent(new CustomEvent("bluespherix:theme", { detail: theme }));
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const media = matchMedia("(prefers-color-scheme: light)");
    const sync = () => setTheme(appliedTheme());
    const followSystem = () => {
      if (storedTheme()) return;
      const next: Theme = media.matches ? "light" : "dark";
      applyTheme(next, false);
      setTheme(next);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      transitionTimer.current = setTimeout(() => delete document.documentElement.dataset.themeChanging, 650);
    };
    sync();
    media.addEventListener("change", followSystem);
    window.addEventListener("bluespherix:theme", sync);
    return () => {
      media.removeEventListener("change", followSystem);
      window.removeEventListener("bluespherix:theme", sync);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      delete root.dataset.themeChanging;
    };
  }, []);

  const toggle = () => {
    const next: Theme = appliedTheme() === "light" ? "dark" : "light";
    applyTheme(next, true);
    setTheme(next);
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => delete document.documentElement.dataset.themeChanging, 650);
  };

  const light = theme === "light";
  return (
    <button className="theme-toggle" type="button" onClick={toggle} aria-label={light ? "Attiva modalità scura" : "Attiva modalità chiara"} title={light ? "Modalità scura" : "Modalità chiara"}>
      <Sun className="theme-icon-light" size={17} aria-hidden="true" />
      <Moon className="theme-icon-dark" size={16} aria-hidden="true" />
    </button>
  );
}
