"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Button, Empty } from "@cloudflare/kumo";
import { UploadSimpleIcon } from "@phosphor-icons/react";

type UploadDropzoneProps = {
  onFilesSelected: (files: FileList) => void;
};

export function UploadDropzone({ onFilesSelected }: UploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("uploadDropzone");

  return (
    <div className="rounded-lg border-2 border-dashed border-kumo-line p-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFilesSelected(e.target.files);
          }
          e.target.value = "";
        }}
      />
      <Empty
        size="sm"
        icon={<UploadSimpleIcon size={40} />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        contents={
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            {t("browse")}
          </Button>
        }
      />
    </div>
  );
}
