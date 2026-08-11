import { cookies } from "next/headers";
import { db, shareLink, file, folder, eq } from "@filecloud/db";
import { Button, LayerCard, Text } from "@cloudflare/kumo";
import { FileIcon, FolderIcon } from "@phosphor-icons/react/dist/ssr";
import { ShareDownloadButton } from "@/components/files/share-download-button";
import { InvalidShareLink } from "@/components/files/invalid-share-link";
import { SharePasswordGate } from "@/components/files/share-password-gate";
import { shareUnlockCookieName, verifyShareUnlock } from "@/lib/share-unlock";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicSharePage({ params }: SharePageProps) {
  const { token } = await params;

  const [sRecord] = await db
    .select()
    .from(shareLink)
    .where(eq(shareLink.token, token))
    .limit(1);

  if (!sRecord || sRecord.revokedAt || (sRecord.expiresAt && sRecord.expiresAt < new Date())) {
    return <InvalidShareLink />;
  }

  let itemInfo: {
    name: string;
    type: "file" | "folder";
    size?: number | null;
    mimeType?: string | null;
    storageKey?: string;
  } | null = null;

  if (sRecord.fileId) {
    const [f] = await db.select().from(file).where(eq(file.id, sRecord.fileId)).limit(1);
    if (f) {
      itemInfo = {
        name: f.name,
        type: "file",
        size: f.size,
        mimeType: f.mimeType,
        storageKey: f.storageKey,
      };
    }
  } else if (sRecord.folderId) {
    const [fld] = await db.select().from(folder).where(eq(folder.id, sRecord.folderId)).limit(1);
    if (fld) {
      itemInfo = {
        name: fld.name,
        type: "folder",
      };
    }
  }

  if (!itemInfo) {
    return <InvalidShareLink />;
  }

  if (sRecord.passwordHash) {
    const cookieStore = await cookies();
    const unlocked = verifyShareUnlock(token, cookieStore.get(shareUnlockCookieName(token))?.value);
    if (!unlocked) {
      return <SharePasswordGate token={token} />;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-kumo-base p-6 text-kumo-default">
      <LayerCard className="w-full max-w-md px-8 py-7 flex flex-col items-center text-center gap-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-kumo-tint text-kumo-brand">
          {itemInfo.type === "folder" ? <FolderIcon size={36} /> : <FileIcon size={36} />}
        </div>

        <div>
          <Text as="h1" variant="heading2" DANGEROUS_className="break-all">
            {itemInfo.name}
          </Text>
          <Text variant="secondary" DANGEROUS_className="mt-1">
            {itemInfo.type === "folder" ? "Dossier partagé" : `${itemInfo.mimeType ?? "Fichier"} • ${Math.round((itemInfo.size ?? 0) / 1024)} KB`}
          </Text>
        </div>

        {itemInfo.type === "file" && itemInfo.storageKey ? (
          <ShareDownloadButton href={`/api/shares/download?token=${token}`} filename={itemInfo.name} />
        ) : (
          <Button variant="secondary" size="base" className="w-full" disabled>
            Aperçu du dossier partagé
          </Button>
        )}
      </LayerCard>
    </div>
  );
}
