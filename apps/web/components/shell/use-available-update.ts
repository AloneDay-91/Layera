"use client";

import { useEffect, useState } from "react";
import { DISMISSED_UPDATE_KEY, type AvailableUpdate, type UpdatesResponse } from "@/lib/updates";

export function useAvailableUpdate(enabled: boolean) {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/admin/updates")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: UpdatesResponse | null) => {
        if (cancelled || !data || data.upToDate) return;
        const dismissed = window.localStorage.getItem(DISMISSED_UPDATE_KEY);
        if (dismissed === data.tag) return;
        setUpdate(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  function dismiss() {
    if (!update) return;
    window.localStorage.setItem(DISMISSED_UPDATE_KEY, update.tag);
    setUpdate(null);
  }

  return { update, dismiss };
}
