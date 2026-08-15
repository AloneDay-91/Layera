"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader, Text, cn } from "@cloudflare/kumo";
import { CodeHighlighted } from "@cloudflare/kumo/code";
import type { FileItem } from "@/lib/file-item";
import {
  isPreviewableAudio,
  isPreviewableImage,
  isPreviewableMarkdown,
  isPreviewablePdf,
  isPreviewableText,
  isPreviewableVideo,
  getLangFromFilename,
} from "./file-preview";
import { MarkdownEditor } from "./markdown-editor";

function useSignedFileUrl(fileId: string) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    fetch(`/api/files/signed-url?id=${fileId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to sign");
        return res.json() as Promise<{ url?: string }>;
      })
      .then((data) => {
        if (!cancelled && typeof data.url === "string") setUrl(data.url);
      })
      .catch(() => {
        if (!cancelled) setUrl(`/api/files/content?id=${fileId}`);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  return url;
}

function TextPreview({ item, markdown }: { item: FileItem; markdown: boolean }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const t = useTranslations("filePreview");

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(false);
    fetch(`/api/files/content?id=${item.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  if (error) {
    return <Text variant="secondary">{t("cannotLoad")}</Text>;
  }

  if (content === null) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center">
        <Loader size="sm" /> {t("loadingPreview")}
      </div>
    );
  }

  if (markdown) {
    return <MarkdownEditor itemId={item.id} initialContent={content} />;
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto">
      <CodeHighlighted code={content} lang={getLangFromFilename(item.name)} showLineNumbers showCopyButton />
    </div>
  );
}

function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className="relative">
      {!loaded && (
        <div className="flex h-[70vh] w-full items-center justify-center rounded bg-kumo-tint" aria-hidden="true">
          <Loader />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={cn("max-h-[70vh] w-full rounded object-contain", !loaded && "hidden")}
      />
    </div>
  );
}

function PdfPreview({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className="relative h-[70vh] w-full">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center rounded bg-kumo-tint" aria-hidden="true">
          <Loader />
        </div>
      )}
      <iframe
        src={src}
        title={title}
        onLoad={() => setLoaded(true)}
        className={cn("h-full w-full rounded border-0", !loaded && "invisible")}
      />
    </div>
  );
}

function VideoPreview({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  const t = useTranslations("filePreview");

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className="relative">
      {!loaded && (
        <div className="flex h-[70vh] w-full items-center justify-center rounded bg-kumo-tint" aria-hidden="true">
          <Loader />
        </div>
      )}
      <video
        controls
        src={src}
        onLoadedData={() => setLoaded(true)}
        className={cn("max-h-[70vh] w-full rounded", !loaded && "hidden")}
      >
        {t("videoNotSupported")}
      </video>
    </div>
  );
}

export function FilePreviewContent({ item }: { item: FileItem }) {
  const t = useTranslations("filePreview");
  const signedUrl = useSignedFileUrl(item.id);

  if (isPreviewableImage(item) || isPreviewablePdf(item) || isPreviewableVideo(item) || isPreviewableAudio(item)) {
    if (!signedUrl) {
      return (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader size="sm" /> {t("loadingPreview")}
        </div>
      );
    }
    if (isPreviewableImage(item)) {
      return <ImagePreview src={signedUrl} alt={item.name} />;
    }
    if (isPreviewablePdf(item)) {
      return <PdfPreview src={signedUrl} title={item.name} />;
    }
    if (isPreviewableVideo(item)) {
      return <VideoPreview src={signedUrl} />;
    }
    return (
      <audio controls src={signedUrl} className="w-full">
        {t("audioNotSupported")}
      </audio>
    );
  }

  if (isPreviewableText(item)) {
    return <TextPreview item={item} markdown={isPreviewableMarkdown(item)} />;
  }

  return <Text variant="secondary">{t("noPreviewAvailable")}</Text>;
}
