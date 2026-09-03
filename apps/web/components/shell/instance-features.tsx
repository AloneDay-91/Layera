"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type InstanceFeatures = {
  publicSharingEnabled: boolean;
  teamsEnabled: boolean;
  favoritesEnabled: boolean;
  tagsEnabled: boolean;
  archiveEnabled: boolean;
};

const DEFAULT_FEATURES: InstanceFeatures = {
  publicSharingEnabled: true,
  teamsEnabled: true,
  favoritesEnabled: true,
  tagsEnabled: true,
  archiveEnabled: true,
};

const InstanceFeaturesContext = createContext<{
  features: InstanceFeatures;
  setFeatures: (next: Partial<InstanceFeatures>) => void;
}>({
  features: DEFAULT_FEATURES,
  setFeatures: () => undefined,
});

export function InstanceFeaturesProvider({
  initial,
  children,
}: {
  initial: InstanceFeatures;
  children: ReactNode;
}) {
  const [features, setFeaturesState] = useState(initial);
  const setFeatures = useCallback((next: Partial<InstanceFeatures>) => {
    setFeaturesState((prev) => ({ ...prev, ...next }));
  }, []);
  const value = useMemo(() => ({ features, setFeatures }), [features, setFeatures]);
  return <InstanceFeaturesContext.Provider value={value}>{children}</InstanceFeaturesContext.Provider>;
}

export function useInstanceFeatures() {
  return useContext(InstanceFeaturesContext);
}
