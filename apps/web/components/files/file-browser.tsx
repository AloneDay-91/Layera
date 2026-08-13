"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, Input, Loader, SkeletonLine, Tabs, useKumoToastManager } from "@cloudflare/kumo";
import {
  GridFourIcon,
  ListBulletsIcon,
  FolderPlusIcon,
  UploadSimpleIcon,
  XIcon,
  CopyIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { ClientOnly } from "@/components/shell/client-only";
import { MockItem } from "@/lib/mock-files";
import { FileBreadcrumbs } from "./file-breadcrumbs";
import { FileTable } from "./file-table";
import { FileGrid } from "./file-grid";
import { FileDetailsPanel } from "./file-details-panel";
import { UploadDropzone } from "./upload-dropzone";

type ViewMode = "table" | "grid";

export function FileBrowser() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("search");
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [breadcrumbsPath, setBreadcrumbsPath] = useState<Array<{ id: string | null; name: string }>>([]);
  const [items, setItems] = useState<MockItem[]>([]);
  const [loading, setLoading] = useState(true);

  // État modale création dossier
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // État modale renommage
  const [renameItem, setRenameItem] = useState<MockItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // État modale partage
  const [shareItem, setShareItem] = useState<MockItem | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // État modale d'upload
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<
    Array<{ name: string; status: "uploading" | "success" | "error" }>
  >([]);

  // État de la dropzone plein cadre (glisser-déposer de fichiers depuis le système)
  const [isDraggingFileOver, setIsDraggingFileOver] = useState(false);
  const dragCounter = useRef(0);

  const toasts = useKumoToastManager();

  function isOsFileDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes("Files");
  }

  function handleBrowserDragEnter(e: React.DragEvent) {
    if (!isOsFileDrag(e)) return;
    e.preventDefault();
    dragCounter.current += 1;
    setIsDraggingFileOver(true);
  }

  function handleBrowserDragOver(e: React.DragEvent) {
    if (!isOsFileDrag(e)) return;
    e.preventDefault();
  }

  function handleBrowserDragLeave(e: React.DragEvent) {
    if (!isOsFileDrag(e)) return;
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingFileOver(false);
    }
  }

  function handleBrowserDrop(e: React.DragEvent) {
    if (!isOsFileDrag(e)) return;
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingFileOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  }

  // Charger les vrais fichiers & dossiers depuis l'API PostgreSQL
  async function fetchFiles(folderId: string | null, search?: string | null) {
    setLoading(true);
    try {
      let url = "/api/files";
      const params = new URLSearchParams();
      if (folderId) params.set("parentId", folderId);
      if (search) params.set("search", search);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setBreadcrumbsPath(data.breadcrumbs ?? []);
      }
    } catch (err) {
      console.error("Erreur de chargement des fichiers :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFiles(currentFolderId, searchQuery);
  }, [currentFolderId, searchQuery, activeOrg?.id]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  function handleOpenFolder(folderId: string) {
    setCurrentFolderId(folderId);
    setSelectedItemId(null);
  }

  function handleNavigate(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSelectedItemId(null);
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: currentFolderId,
          type: "folder",
        }),
      });

      if (res.ok) {
        toasts.add({
          title: "Dossier créé",
          description: `Le dossier "${newFolderName}" a été créé avec succès dans PostgreSQL.`,
        });
        setNewFolderName("");
        setIsFolderModalOpen(false);
        fetchFiles(currentFolderId, searchQuery);
      } else {
        toasts.add({
          title: "Erreur",
          description: "Impossible de créer le dossier dans la base de données.",
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renameItem || !renameValue.trim()) return;

    setRenaming(true);
    try {
      const res = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: renameItem.id,
          type: renameItem.type,
          name: renameValue.trim(),
        }),
      });

      if (res.ok) {
        toasts.add({
          title: "Élément renommé",
          description: `Renommé en "${renameValue.trim()}" avec succès.`,
        });
        setRenameItem(null);
        fetchFiles(currentFolderId, searchQuery);
      } else {
        toasts.add({
          title: "Erreur",
          description: "Impossible de renommer cet élément.",
        });
      }
    } catch (err) {
      console.error("Rename error:", err);
    } finally {
      setRenaming(false);
    }
  }

  async function handleDeleteItem(item: MockItem) {
    try {
      const res = await fetch(`/api/files?id=${item.id}&type=${item.type}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toasts.add({
          title: "Élément supprimé",
          description: `"${item.name}" a été supprimé.`,
        });
        fetchFiles(currentFolderId, searchQuery);
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  async function handleMoveItem(
    dragged: { id: string; type: "file" | "folder"; name: string },
    targetFolderId: string | null,
  ) {
    try {
      const res = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: dragged.id,
          type: dragged.type,
          targetFolderId,
        }),
      });

      if (res.ok) {
        const targetObj = targetFolderId ? items.find((i) => i.id === targetFolderId) : null;
        const targetName = targetObj ? `"${targetObj.name}"` : "la racine (Mes fichiers)";
        toasts.add({
          title: "Élément déplacé par glisser-déposer",
          description: `"${dragged.name}" a été déplacé dans ${targetName}.`,
        });
        fetchFiles(currentFolderId, searchQuery);
      }
    } catch (err) {
      console.error("Move error:", err);
    }
  }

  async function handleUploadFiles(files: FileList) {
    if (files.length === 0) return;

    const fileArray = Array.from(files);
    setUploadQueue(fileArray.map((f) => ({ name: f.name, status: "uploading" })));
    setIsUploadDialogOpen(true);

    let successCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const fileToUpload = fileArray[i]!;
      const formData = new FormData();
      formData.append("file", fileToUpload);
      if (currentFolderId) formData.append("folderId", currentFolderId);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const status = res.ok ? "success" : "error";
        if (res.ok) successCount++;
        setUploadQueue((prev) => prev.map((item, idx) => (idx === i ? { ...item, status } : item)));
      } catch (err) {
        console.error("Upload error:", err);
        setUploadQueue((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "error" } : item)));
      }
    }

    if (successCount > 0) {
      fetchFiles(currentFolderId, searchQuery);
    }
  }

  async function handleShareItem(item: MockItem) {
    setShareItem(item);
    setShareUrl(null);
    setSharing(true);
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, itemType: item.type }),
      });
      if (res.ok) {
        const data = await res.json();
        setShareUrl(`${window.location.origin}${data.share.url}`);
      } else {
        toasts.add({
          title: "Erreur",
          description: "Impossible de créer le lien de partage.",
        });
        setShareItem(null);
      }
    } catch (err) {
      console.error("Share error:", err);
      setShareItem(null);
    } finally {
      setSharing(false);
    }
  }

  async function handleCopyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toasts.add({ title: "Lien copié", description: "Le lien de partage a été copié dans le presse-papiers." });
  }

  async function handleToggleFavorite(item: MockItem) {
    const nextFavorite = !item.isFavorite;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isFavorite: nextFavorite } : i)));
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, type: item.type }),
      });
      if (!res.ok) throw new Error("Failed to toggle favorite");
      toasts.add({
        title: nextFavorite ? "Ajouté aux favoris" : "Retiré des favoris",
        description: `"${item.name}" ${nextFavorite ? "a été ajouté à" : "a été retiré de"} vos favoris.`,
      });
    } catch (err) {
      console.error("Toggle favorite error:", err);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isFavorite: item.isFavorite } : i)));
      toasts.add({ title: "Erreur", description: "Impossible de mettre à jour les favoris." });
    }
  }

  function handleDetailAction(action: string) {
    toasts.add({
      title: "Action sur le fichier",
      description: `Action "${action}" exécutée sur le fichier.`,
    });
  }

  return (
    <div className="flex flex-1 gap-6">
      <div
        className="relative flex flex-1 flex-col gap-4"
        onDragEnter={handleBrowserDragEnter}
        onDragOver={handleBrowserDragOver}
        onDragLeave={handleBrowserDragLeave}
        onDrop={handleBrowserDrop}
      >
        {isDraggingFileOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-kumo-brand bg-kumo-tint/90">
            <UploadSimpleIcon size={40} className="text-kumo-brand" />
            <span className="text-sm font-medium text-kumo-brand">Déposez vos fichiers ici pour les téléverser</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <FileBreadcrumbs
            path={breadcrumbsPath}
            onNavigate={handleNavigate}
            onMoveItem={handleMoveItem}
          />
          <div className="flex items-center gap-2">
            <input
              id="toolbar-file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUploadFiles(e.target.files);
                }
                e.target.value = "";
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={FolderPlusIcon}
              onClick={() => setIsFolderModalOpen(true)}
            >
              Nouveau dossier
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={UploadSimpleIcon}
              onClick={() => document.getElementById("toolbar-file-upload")?.click()}
            >
              Téléverser
            </Button>
            <Tabs
              variant="segmented"
              size="sm"
              tabs={[
                {
                  value: "table",
                  label: (
                    <span className="flex items-center gap-1">
                      <ListBulletsIcon size={16} /> Liste
                    </span>
                  ),
                },
                {
                  value: "grid",
                  label: (
                    <span className="flex items-center gap-1">
                      <GridFourIcon size={16} /> Grille
                    </span>
                  ),
                },
              ]}
              value={viewMode}
              onValueChange={(value) => setViewMode(value as ViewMode)}
            />
          </div>
        </div>

        {loading ? (
          <ClientOnly
            fallback={
              <div className="flex flex-col gap-3 p-4 bg-kumo-base border border-kumo-line rounded-lg animate-pulse min-h-55" />
            }
          >
            <div className="flex flex-col gap-3 p-4 bg-kumo-base border border-kumo-line rounded-lg">
              <div className="flex items-center justify-between py-2 border-b border-kumo-line">
                <SkeletonLine minWidth={30} maxWidth={30} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                <SkeletonLine minWidth={20} maxWidth={20} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                <SkeletonLine minWidth={15} maxWidth={15} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
              </div>
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between py-3 border-b border-kumo-line/40">
                  <div className="flex items-center gap-3 flex-1">
                    <SkeletonLine minWidth={10} maxWidth={10} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-5 w-5" />
                    <SkeletonLine minWidth={50} maxWidth={50} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                  </div>
                  <SkeletonLine minWidth={25} maxWidth={25} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                  <SkeletonLine minWidth={20} maxWidth={20} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                </div>
              ))}
            </div>
          </ClientOnly>
        ) : items.length === 0 ? (
          <UploadDropzone onFilesSelected={handleUploadFiles} />
        ) : viewMode === "table" ? (
          <FileTable
            items={items}
            selectedItemId={selectedItemId}
            onOpenFolder={handleOpenFolder}
            onSelectItem={setSelectedItemId}
            onRenameItem={(item) => {
              setRenameItem(item);
              setRenameValue(item.name);
            }}
            onShareItem={handleShareItem}
            onDeleteItem={handleDeleteItem}
            onToggleFavorite={handleToggleFavorite}
            onMoveItem={handleMoveItem}
          />
        ) : (
          <FileGrid
            items={items}
            selectedItemId={selectedItemId}
            onOpenFolder={handleOpenFolder}
            onSelectItem={setSelectedItemId}
            onToggleFavorite={handleToggleFavorite}
            onMoveItem={handleMoveItem}
          />
        )}
      </div>

      {selectedItem && (
        <FileDetailsPanel
          item={selectedItem}
          onClose={() => setSelectedItemId(null)}
          onAction={handleDetailAction}
          onShare={handleShareItem}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* Modale de création de dossier */}
      <Dialog.Root open={isFolderModalOpen} onOpenChange={setIsFolderModalOpen}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">Créer un nouveau dossier</Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />
              )}
            />
          </div>

          <form onSubmit={handleCreateFolder} className="flex flex-col gap-4">
            <Input
              size="sm"
              label="Nom du dossier"
              placeholder="ex: Rapports 2026"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              required
              autoFocus
            />

            <div className="flex justify-end gap-2 mt-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setIsFolderModalOpen(false)}>
                Annuler
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={creatingFolder}>
                {creatingFolder ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> Création…
                  </span>
                ) : (
                  "Créer le dossier"
                )}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>

      {/* Modale de renommage d'un fichier / dossier */}
      <Dialog.Root open={renameItem !== null} onOpenChange={(open) => !open && setRenameItem(null)}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">
              Renommer &quot;{renameItem?.name}&quot;
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />
              )}
            />
          </div>

          <form onSubmit={handleRenameSubmit} className="flex flex-col gap-4">
            <Input
              size="sm"
              label="Nouveau nom"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              required
              autoFocus
            />

            <div className="flex justify-end gap-2 mt-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setRenameItem(null)}>
                Annuler
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={renaming}>
                {renaming ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> Renommage…
                  </span>
                ) : (
                  "Renommer"
                )}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>

      {/* Modale de partage d'un fichier / dossier */}
      <Dialog.Root open={shareItem !== null} onOpenChange={(open) => !open && setShareItem(null)}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">
              Partager &quot;{shareItem?.name}&quot;
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />
              )}
            />
          </div>

          {sharing ? (
            <div className="flex items-center gap-2 py-4">
              <Loader size="sm" /> Création du lien…
            </div>
          ) : shareUrl ? (
            <div className="flex flex-col gap-4">
              <Input size="sm" label="Lien de partage public" value={shareUrl} readOnly onFocus={(e) => e.target.select()} />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" type="button" onClick={() => setShareItem(null)}>
                  Fermer
                </Button>
                <Button variant="primary" size="sm" icon={CopyIcon} onClick={handleCopyShareUrl}>
                  Copier le lien
                </Button>
              </div>
            </div>
          ) : null}
        </Dialog>
      </Dialog.Root>

      {/* Modale de progression d'upload */}
      <Dialog.Root open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">Téléversement</Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label="Fermer" />
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            {uploadQueue.map((item, idx) => (
              <div key={`${item.name}-${idx}`} className="flex items-center gap-2 py-1.5 text-sm">
                {item.status === "uploading" && <Loader size="sm" />}
                {item.status === "success" && <CheckCircleIcon size={18} className="text-kumo-success" />}
                {item.status === "error" && <XCircleIcon size={18} className="text-kumo-danger" />}
                <span className="flex-1 truncate">{item.name}</span>
                <span className="text-kumo-subtle">
                  {item.status === "uploading" ? "Envoi…" : item.status === "success" ? "Terminé" : "Échec"}
                </span>
              </div>
            ))}
          </div>

          {uploadQueue.length > 0 && uploadQueue.every((item) => item.status !== "uploading") && (
            <div className="flex justify-end mt-4">
              <Button variant="secondary" size="sm" onClick={() => setIsUploadDialogOpen(false)}>
                Fermer
              </Button>
            </div>
          )}
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
