"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { INSTALL_COMMANDS } from "@/lib/site";

export function InstallSnippet() {
  const [copied, setCopied] = useState(false);

  async function copyCommands() {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMANDS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="font-mono text-xs text-muted-foreground">install.sh</p>
        <button
          type="button"
          onClick={copyCommands}
          aria-label={copied ? "Copied" : "Copy install commands"}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? (
            <CheckIcon className="size-3.5" weight="regular" />
          ) : (
            <CopyIcon className="size-3.5" weight="regular" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-7 text-foreground">
        <code>{INSTALL_COMMANDS}</code>
      </pre>
    </div>
  );
}
