"use client";

import type { ReactNode } from "react";
import { Tabs, Text, cn } from "@cloudflare/kumo";

export type PageHeaderTabItem = {
  label: string;
  value: string;
};

export interface PageHeaderProps {
  breadcrumbs?: ReactNode;
  title?: string;
  description?: string;
  tabs?: PageHeaderTabItem[];
  defaultTab?: string;
  activeTab?: string;
  onValueChange?: (value: string) => void;
  spacing?: "compact" | "base" | "relaxed";
  className?: string;
  children?: ReactNode;
}

const SPACING_CLASSES = {
  compact: "gap-2 py-2",
  base: "gap-4 py-4",
  relaxed: "gap-6 py-6",
};

export function PageHeader({
  breadcrumbs,
  title,
  description,
  tabs,
  defaultTab,
  activeTab,
  onValueChange,
  spacing = "base",
  className,
  children,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col border-b border-kumo-line px-6", SPACING_CLASSES[spacing], className)}>
      {breadcrumbs && <div className="min-w-0">{breadcrumbs}</div>}

      {(title || description || children) && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          {(title || description) && (
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {title && (
                <Text as="h1" variant="heading2">
                  {title}
                </Text>
              )}
              {description && (
                <Text variant="secondary">
                  {description}
                </Text>
              )}
            </div>
          )}

          {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
        </div>
      )}

      {tabs && tabs.length > 0 && (
        <div className="-mb-4 mt-2">
          <Tabs
            tabs={tabs}
            selectedValue={defaultTab}
            value={activeTab}
            onValueChange={onValueChange}
          />
        </div>
      )}
    </header>
  );
}
