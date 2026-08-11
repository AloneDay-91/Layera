"use client";

import { useState } from "react";
import { Button, Empty, useKumoToastManager } from "@cloudflare/kumo";
import { UploadSimpleIcon } from "@phosphor-icons/react";

export function UploadDropzone() {
  const toasts = useKumoToastManager();
  const [isDragging, setIsDragging] = useState(false);

  function notifyNotImplemented() {
    toasts.add({
      title: "Bientôt disponible",
      description: "L'upload de fichiers n'est pas encore implémenté.",
    });
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        notifyNotImplemented();
      }}
      className={
        isDragging
          ? "rounded-lg border-2 border-dashed border-blue-500 bg-blue-50"
          : "rounded-lg border-2 border-dashed border-gray-300"
      }
    >
      <Empty
        icon={<UploadSimpleIcon size={40} />}
        title="Ce dossier est vide"
        description="Glissez des fichiers ici pour les ajouter, ou utilisez le bouton ci-dessous."
        contents={
          <Button variant="secondary" onClick={notifyNotImplemented}>
            Parcourir les fichiers
          </Button>
        }
      />
    </div>
  );
}
