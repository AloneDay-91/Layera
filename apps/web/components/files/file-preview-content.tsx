"use client";

import { useEffect, useState } from "react";
import { Loader, Text, cn } from "@cloudflare/kumo";
import { CodeHighlighted } from "@cloudflare/kumo/code";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { MockItem } from "@/lib/mock-files";
import {
  isPreviewableAudio,
  isPreviewableImage,
  isPreviewableMarkdown,
  isPreviewablePdf,
  isPreviewableText,
  isPreviewableVideo,
  getLangFromFilename,
} from "./file-preview";

function TextPreview({ item, markdown }: { item: MockItem; markdown: boolean }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

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
    return <Text variant="secondary">Impossible de charger l&apos;aperçu de ce fichier.</Text>;
  }

  if (content === null) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center">
        <Loader size="sm" /> Chargement de l&apos;aperçu…
      </div>
    );
  }

  if (markdown) {
    const html = DOMPurify.sanitize(marked.parse(content, { async: false }));
    return (
      <div
        className="prose prose-sm max-w-none text-kumo-default max-h-[70vh] overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
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
        Votre navigateur ne prend pas en charge la lecture vidéo.
      </video>
    </div>
  );
}

export function FilePreviewContent({ item }: { item: MockItem }) {
  const contentUrl = `/api/files/content?id=${item.id}`;

  if (isPreviewableImage(item)) {
    return <ImagePreview src={contentUrl} alt={item.name} />;
  }

  if (isPreviewablePdf(item)) {
    return <PdfPreview src={contentUrl} title={item.name} />;
  }

  if (isPreviewableVideo(item)) {
    return <VideoPreview src={contentUrl} />;
  }

  if (isPreviewableAudio(item)) {
    return (
      <audio controls src={contentUrl} className="w-full">
        Votre navigateur ne prend pas en charge la lecture audio.
      </audio>
    );
  }

  if (isPreviewableText(item)) {
    return <TextPreview item={item} markdown={isPreviewableMarkdown(item)} />;
  }

  return <Text variant="secondary">Aucun aperçu disponible pour ce type de fichier.</Text>;
}
