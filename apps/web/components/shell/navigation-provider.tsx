"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type NavigationContextValue = {
  pathname: string;
  displayedPath: string;
  isPending: boolean;
  markPending: (href: string) => void;
  notifyReady: (fromPath: string) => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);
const PENDING_TIMEOUT_MS = 4000;

export function normalizeAppPath(href: string) {
  const path = href.split("#")[0]?.split("?")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

function navigationTarget(href: string) {
  return href.split("#")[0] || href;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const intendedPathRef = useRef<string | null>(null);
  const inflightRef = useRef(false);
  const lastCorrectionRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  pathnameRef.current = pathname;
  routerRef.current = router;

  const markPending = useCallback(
    (href: string) => {
      const next = normalizeAppPath(href);
      if (!next.startsWith("/dashboard")) return;

      const wasInflight = inflightRef.current;
      const previousIntended = intendedPathRef.current;

      intendedPathRef.current = next;
      inflightRef.current = true;
      lastCorrectionRef.current = null;

      if (next === pathname) {
        if (wasInflight && previousIntended && previousIntended !== next) {
          setPendingPath(next);
          router.push(navigationTarget(href));
          return;
        }
        inflightRef.current = false;
        setPendingPath(null);
        return;
      }

      setPendingPath(next);
      router.push(navigationTarget(href));
    },
    [pathname, router],
  );

  const notifyReady = useCallback((fromPath: string) => {
    const path = normalizeAppPath(fromPath);
    if (intendedPathRef.current !== path) return;
    inflightRef.current = false;
    lastCorrectionRef.current = null;
    setPendingPath((current) => (current === path ? null : current));
  }, []);

  useLayoutEffect(() => {
    const intended = intendedPathRef.current;
    if (!inflightRef.current || !intended) return;

    if (pathname === intended) {
      inflightRef.current = false;
      lastCorrectionRef.current = null;
      setPendingPath(null);
      return;
    }

    if (!pathname.startsWith("/dashboard")) return;

    const key = `${pathname}->${intended}`;
    if (lastCorrectionRef.current === key) return;
    lastCorrectionRef.current = key;
    setPendingPath(intended);
    routerRef.current.push(intended);
  }, [pathname]);

  useEffect(() => {
    if (!pendingPath) return;
    const timer = window.setTimeout(() => {
      inflightRef.current = false;
      intendedPathRef.current = pathnameRef.current;
      lastCorrectionRef.current = null;
      setPendingPath(null);
    }, PENDING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [pendingPath]);

  useEffect(() => {
    function onPopState() {
      inflightRef.current = false;
      intendedPathRef.current = null;
      lastCorrectionRef.current = null;
      setPendingPath(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
