import { cookies } from "next/headers";
import { db, shareLink, file, folder, user, eq } from "@filecloud/db";
import { Button, LayerCard, Text } from "@cloudflare/kumo";
import { FileIcon, FolderIcon } from "@phosphor-icons/react/dist/ssr";
import { ShareDownloadButton } from "@/components/files/share-download-button";
import { InvalidShareLink } from "@/components/files/invalid-share-link";
import { SharePasswordGate } from "@/components/files/share-password-gate";
import { UserAvatar } from "@/components/files/user-avatar";
import { shareUnlockCookieName, verifyShareUnlock } from "@/lib/share-unlock";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicSharePage({ params }: SharePageProps) {
  const { token } = await params;
  const cookieStoreForLocale = await cookies();
  const t = cookieStoreForLocale.get("filecloud-locale")?.value === "fr" ? fr.sharePage : en.sharePage;

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
    ownerId?: string | null;
    ownerName?: string | null;
  } | null = null;

  if (sRecord.fileId) {
    const [f] = await db.select().from(file).where(eq(file.id, sRecord.fileId)).limit(1);
    if (f) {
      const owner = f.createdBy
        ? (await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, f.createdBy)).limit(1))[0]
        : null;
      itemInfo = {
        name: f.name,
        type: "file",
        size: f.size,
        mimeType: f.mimeType,
        storageKey: f.storageKey,
        ownerId: owner?.id ?? f.createdBy,
        ownerName: owner?.name ?? null,
      };
    }
  } else if (sRecord.folderId) {
    const [fld] = await db.select().from(folder).where(eq(folder.id, sRecord.folderId)).limit(1);
    if (fld) {
      const owner = fld.createdBy
        ? (await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, fld.createdBy)).limit(1))[0]
        : null;
      itemInfo = {
        name: fld.name,
        type: "folder",
        ownerId: owner?.id ?? fld.createdBy,
        ownerName: owner?.name ?? null,
      };
    }
  }

  if (!itemInfo) {
    return <InvalidShareLink />;
  }

  if (sRecord.passwordHash) {
    const unlocked = verifyShareUnlock(token, cookieStoreForLocale.get(shareUnlockCookieName(token))?.value);
    if (!unlocked) {
      return <SharePasswordGate token={token} />;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-kumo-base p-6 text-kumo-default">
      <LayerCard className="w-full max-w-md px-8 py-7 flex flex-col items-center text-center gap-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-kumo-tint text-kumo-info">
          {itemInfo.type === "folder" ? <FolderIcon size={36} /> : <FileIcon size={36} />}
        </div>

        <div>
          <Text as="h1" variant="heading2" DANGEROUS_className="break-all">
            {itemInfo.name}
          </Text>
          <Text variant="secondary" DANGEROUS_className="mt-1">
            {itemInfo.type === "folder" ? t.sharedFolder : `${itemInfo.mimeType ?? t.genericFile} • ${Math.round((itemInfo.size ?? 0) / 1024)} KB`}
          </Text>
          {itemInfo.ownerName ? (
            <div className="mt-3 flex items-center justify-center gap-2">
              <UserAvatar userId={itemInfo.ownerId} name={itemInfo.ownerName} size={24} />
              <Text variant="secondary">{t.sharedBy.replace("{name}", itemInfo.ownerName)}</Text>
            </div>
          ) : null}
        </div>

        {itemInfo.type === "file" && itemInfo.storageKey ? (
          <ShareDownloadButton href={`/api/shares/download?token=${token}`} filename={itemInfo.name} />
        ) : (
          <Button variant="secondary" size="base" className="w-full" disabled>
            {t.sharedFolderPreview}
          </Button>
        )}
      </LayerCard>
    </div>
  );
}
