"use client";

import { Button } from "@cloudflare/kumo";
import { DownloadSimpleIcon } from "@phosphor-icons/react";

export function ShareDownloadButton({ href, filename }: { href: string; filename: string }) {
  return (
    <a href={href} download={filename} className="w-full">
      <Button variant="primary" size="base" className="w-full" icon={DownloadSimpleIcon}>
        Télécharger le fichier
      </Button>
    </a>
  );
}
