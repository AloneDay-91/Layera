"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Loader, Text, useKumoToastManager } from "@cloudflare/kumo";
import { CodeIcon, LinkIcon, ListBulletsIcon } from "@phosphor-icons/react";
import { marked } from "marked";
import DOMPurify from "dompurify";

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after = before) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end) || "texte";
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  const cursor = start + before.length + selected.length + after.length;
  return { next, cursor };
}

export function MarkdownEditor({ itemId, initialContent }: { itemId: string; initialContent: string }) {
  const t = useTranslations("markdownEditor");
  const tToasts = useTranslations("markdownEditor.toasts");
  const toasts = useKumoToastManager();
  const [value, setValue] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialContent);
  }, [initialContent, itemId]);

  function applyWrap(before: string, after = before) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { next, cursor } = wrapSelection(textarea, before, after);
    setValue(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/files/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, content: value }),
      });
      if (!res.ok) throw new Error("save failed");
      toasts.add({ title: tToasts("savedTitle"), description: tToasts("savedDescription") });
    } catch {
      toasts.add({ title: tToasts("errorTitle"), description: tToasts("errorDescription") });
    } finally {
      setSaving(false);
    }
  }

  const html = DOMPurify.sanitize(marked.parse(value, { async: false }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" aria-label={t("bold")} onClick={() => applyWrap("**")}>
          B
        </Button>
        <Button variant="ghost" size="sm" aria-label={t("italic")} onClick={() => applyWrap("*")}>
          I
        </Button>
        <Button variant="ghost" size="sm" aria-label={t("heading")} onClick={() => applyWrap("## ", "")}>
          H
        </Button>
        <Button variant="ghost" size="sm" icon={ListBulletsIcon} aria-label={t("list")} onClick={() => applyWrap("- ", "")} />
        <Button variant="ghost" size="sm" icon={LinkIcon} aria-label={t("link")} onClick={() => applyWrap("[", "](url)")} />
        <Button variant="ghost" size="sm" icon={CodeIcon} aria-label={t("code")} onClick={() => applyWrap("`")} />
        <div className="ml-auto">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Loader size="sm" /> {t("saving")}
              </span>
            ) : (
              t("save")
            )}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          className="min-h-[50vh] w-full resize-y rounded-lg border border-kumo-line bg-kumo-base p-3 font-mono text-sm text-kumo-default"
        />
        <div className="min-h-[50vh] overflow-y-auto rounded-lg border border-kumo-line bg-kumo-base p-3">
          {value.trim() ? (
            <div
              className="prose prose-sm max-w-none text-kumo-default"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <Text variant="secondary">{t("emptyPreview")}</Text>
          )}
        </div>
      </div>
    </div>
  );
}
