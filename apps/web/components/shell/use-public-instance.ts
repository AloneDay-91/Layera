"use client";

import { useEffect, useState } from "react";

export type PublicInstance = {
  instanceName: string;
  registrationEnabled: boolean;
  loaded: boolean;
};

const DEFAULT_NAME = "Layera";

export function usePublicInstance(): PublicInstance {
  const [state, setState] = useState<PublicInstance>({
    instanceName: DEFAULT_NAME,
    registrationEnabled: true,
    loaded: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/instance")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) {
          if (!cancelled) setState((prev) => ({ ...prev, loaded: true }));
          return;
        }
        const name = typeof data.instanceName === "string" ? data.instanceName.trim() : "";
        setState({
          instanceName: name || DEFAULT_NAME,
          registrationEnabled: data.registrationEnabled !== false,
          loaded: true,
        });
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ ...prev, loaded: true }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
