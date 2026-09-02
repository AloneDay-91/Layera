"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type NavigationContextValue = {
  pathname: string;
  displayedPath: string;
  isPending: boolean;
  markPending: (href: string) => void;
  notifyReady: (fromPath: string) => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);
const PENDING_TIMEOUT_MS = 8000;

export function normalizeAppPath(href: string) {
  const path = href.split("#")[0]?.split("?")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const reachedDestRef = useRef(false);

  const clearPending = useCallback(() => {
    reachedDestRef.current = false;
    setPendingPath(null);
  }, []);

  const markPending = useCallback(
    (href: string) => {
      const next = normalizeAppPath(href);
      if (next.startsWith("/dashboard") && next !== pathname) {
        reachedDestRef.current = false;
        setPendingPath(next);
      }
    },
    [pathname],
  );

  const notifyReady = useCallback((fromPath: string) => {
    const path = normalizeAppPath(fromPath);
    setPendingPath((current) => {
      if (current !== path) return current;
      reachedDestRef.current = false;
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pendingPath) {
      reachedDestRef.current = false;
      return;
    }
    if (pathname === pendingPath) {
      reachedDestRef.current = true;
      return;
    }
    if (reachedDestRef.current) {
      clearPending();
    }
  }, [pathname, pendingPath, clearPending]);

  useEffect(() => {
    if (!pendingPath) return;
    const timer = window.setTimeout(() => {
      clearPending();
    }, PENDING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [pendingPath, clearPending]);

  const value = useMemo<NavigationContextValue>(
    () => ({
      pathname,
      displayedPath: pendingPath ?? pathname,
      isPending: pendingPath !== null,
      markPending,
      notifyReady,
    }),
    [pathname, pendingPath, markPending, notifyReady],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return ctx;
}

export function usePageReady(ready: boolean) {
  const pathname = usePathname();
  const { notifyReady } = useNavigation();

  useEffect(() => {
    if (ready) notifyReady(pathname);
  }, [ready, pathname, notifyReady]);
}
