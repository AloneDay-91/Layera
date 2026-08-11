"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextType = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedMode: "light" | "dark";
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "filecloud-theme-mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved && ["light", "dark", "system"].includes(saved)) {
      setModeState(saved);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    function applyMode(targetMode: "light" | "dark") {
      root.setAttribute("data-mode", targetMode);
      setResolvedMode(targetMode);
    }

    if (mode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      applyMode(mediaQuery.matches ? "dark" : "light");

      const handleChange = (e: MediaQueryListEvent) => {
        applyMode(e.matches ? "dark" : "light");
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      applyMode(mode);
    }
  }, [mode]);

  function setMode(newMode: ThemeMode) {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolvedMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
