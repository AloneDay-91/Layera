"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Breadcrumbs,
  Button,
  DatePicker,
  Dialog,
  Input,
  LayerCard,
  Loader,
  Popover,
  SkeletonLine,
  Table,
  Text,
  useKumoToastManager,
} from "@cloudflare/kumo";
import { LinkIcon, CopyIcon, XCircleIcon, PencilSimpleIcon, XIcon, LockIcon, ClockIcon, CalendarIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { ClientOnly } from "@/components/shell/client-only";

type ShareLinkItem = {
  id: string;
  token: string;
  itemName: string;
  itemType: "file" | "folder";
  createdAt: string;
  expiresAt: string | null;
  hasPassword: boolean;
};

// A share expires at the end (23:59:59) of the selected local day.
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export default function LinksPage() {
  const toasts = useKumoToastManager();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [shares, setShares] = useState<ShareLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [editShare, setEditShare] = useState<ShareLinkItem | null>(null);
  const [editExpiresDate, setEditExpiresDate] = useState<Date | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function fetchShares() {
    setLoading(true);
    try {
      const res = await fetch("/api/shares");
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares ?? []);
      }
    } catch (err) {
      console.error("Erreur chargement des liens de partage :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchShares();
  }, [activeOrg?.id]);

  function shareUrl(token: string) {
    return `${window.location.origin}/share/${token}`;
  }

  async function handleCopy(token: string) {
    await navigator.clipboard.writeText(shareUrl(token));
    toasts.add({ title: "Lien copié", description: "Le lien de partage a été copié dans le presse-papiers." });
  }

  async function handleRevoke(share: ShareLinkItem) {
    setRevokingId(share.id);
    try {
      const res = await fetch(`/api/shares?id=${share.id}`, { method: "DELETE" });
      if (res.ok) {
        toasts.add({
          title: "Lien révoqué",
          description: `Le lien de partage pour "${share.itemName}" a été révoqué.`,
        });
        fetchShares();
      }
    } catch (err) {
      console.error("Revoke error:", err);
    } finally {
      setRevokingId(null);
    }
  }

  function openEdit(share: ShareLinkItem) {
    setEditShare(share);
    setEditExpiresDate(share.expiresAt ? new Date(share.expiresAt) : undefined);
    setEditPassword("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editShare) return;

    setSavingEdit(true);
    try {
      const res = await fetch("/api/shares", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editShare.id,
          expiresAt: editExpiresDate ? endOfDay(editExpiresDate).toISOString() : null,
          password: editPassword ? editPassword : undefined,
        }),
      });

      if (res.ok) {
        toasts.add({ title: "Lien mis à jour", description: `Les paramètres de "${editShare.itemName}" ont été enregistrés.` });
        setEditShare(null);
        fetchShares();
      } else {
        toasts.add({ title: "Erreur", description: "Impossible de mettre à jour le lien." });
      }
    } catch (err) {
      console.error("Edit error:", err);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleRemovePassword() {
    if (!editShare) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/shares", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editShare.id, password: null }),
      });
      if (res.ok) {
        setEditShare({ ...editShare, hasPassword: false });
        setEditPassword("");
        toasts.add({ title: "Mot de passe retiré", description: "Le lien n'est plus protégé par mot de passe." });
        fetchShares();
      }
    } catch (err) {
      console.error("Remove password error:", err);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">Mes fichiers</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>Liens de partage</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title="Liens de partage"
        description="Gérez les liens de partage publics créés depuis vos fichiers et dossiers."
      />

      <div className="flex flex-1 flex-col gap-6 max-w-5xl pt-6">

      {loading ? (
        <ClientOnly
          fallback={
            <div className="flex flex-col gap-3 p-4 bg-kumo-base border border-kumo-line rounded-lg animate-pulse min-h-55" />
          }
        >
          <div className="flex flex-col gap-3 p-4 bg-kumo-base border border-kumo-line rounded-lg">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-kumo-line/40">
                <SkeletonLine minWidth={40} maxWidth={60} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                <SkeletonLine minWidth={20} maxWidth={20} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
              </div>
            ))}
          </div>
        </ClientOnly>
      ) : shares.length === 0 ? (
        <LayerCard className="flex flex-col items-center justify-center p-12 text-center">
          <LinkIcon size={48} className="text-kumo-subtle mb-3" />
          <Text as="p" variant="heading3" DANGEROUS_className="mb-1">
            Aucun lien de partage actif
          </Text>
          <Text variant="secondary">
            Partagez un fichier ou un dossier depuis l&apos;explorateur pour créer un lien.
          </Text>
        </LayerCard>
      ) : (
        <LayerCard className="p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Nom</Table.Head>
                <Table.Head>Type</Table.Head>
                <Table.Head>Créé le</Table.Head>
                <Table.Head>Expiration</Table.Head>
                <Table.Head>Protection</Table.Head>
                <Table.Head className="text-right">Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {shares.map((share) => (
                <Table.Row key={share.id}>
                  <Table.Cell>
                    <Text as="span" bold>{share.itemName}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="neutral">{share.itemType === "folder" ? "Dossier" : "Fichier"}</Badge>
                  </Table.Cell>
                  <Table.Cell>{new Date(share.createdAt).toLocaleDateString("fr-FR")}</Table.Cell>
                  <Table.Cell>
                    {share.expiresAt ? (
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon size={14} />
                        {new Date(share.expiresAt).toLocaleString("fr-FR")}
                      </span>
                    ) : (
                      <Text variant="secondary">Aucune</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {share.hasPassword ? (
                      <span className="inline-flex items-center gap-1">
                        <LockIcon size={14} /> Protégé
                      </span>
                    ) : (
                      <Text variant="secondary">Aucune</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" icon={PencilSimpleIcon} onClick={() => openEdit(share)}>
                        Modifier
                      </Button>
                      <Button variant="secondary" size="sm" icon={CopyIcon} onClick={() => handleCopy(share.token)}>
                        Copier
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={revokingId === share.id}
                        icon={XCircleIcon}
                        onClick={() => handleRevoke(share)}
                      >
                        Révoquer
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      )}
      </div>

      {/* Modale d'édition d'un lien de partage */}
      <Dialog.Root open={editShare !== null} onOpenChange={(open) => !open && setEditShare(null)}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">
              Modifier &quot;{editShare?.itemName}&quot;
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />
              )}
            />
          </div>

          <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Text as="span" size="sm" bold>Date d&apos;expiration</Text>
              <div className="flex items-center gap-2">
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <Popover.Trigger
                    render={
                      <Button variant="secondary" size="sm" icon={CalendarIcon}>
                        {editExpiresDate ? editExpiresDate.toLocaleDateString("fr-FR") : "Aucune expiration"}
                      </Button>
                    }
                  />
                  <Popover.Content className="p-2">
                    <DatePicker
                      mode="single"
                      selected={editExpiresDate}
                      onChange={(date) => {
                        setEditExpiresDate(date);
                        setIsDatePickerOpen(false);
                      }}
                      disabled={{ before: new Date() }}
                    />
                  </Popover.Content>
                </Popover>
                {editExpiresDate && (
                  <Button variant="ghost" size="sm" type="button" onClick={() => setEditExpiresDate(undefined)}>
                    Effacer
                  </Button>
                )}
              </div>
              <Text as="span" size="sm" variant="secondary">
                Le lien expire à 23:59 le jour sélectionné. Laissez vide pour un lien sans expiration.
              </Text>
            </div>

            <div className="flex flex-col gap-1.5">
              <Input
                size="sm"
                type="password"
                label={editShare?.hasPassword ? "Nouveau mot de passe" : "Mot de passe"}
                description={
                  editShare?.hasPassword
                    ? "Laissez vide pour conserver le mot de passe actuel."
                    : "Laissez vide pour ne pas protéger ce lien."
                }
                placeholder="••••••••"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
              {editShare?.hasPassword && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={savingEdit}
                  onClick={handleRemovePassword}
                  className="self-start"
                >
                  Retirer le mot de passe
                </Button>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setEditShare(null)}>
                Annuler
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={savingEdit}>
                {savingEdit ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> Enregistrement…
                  </span>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
