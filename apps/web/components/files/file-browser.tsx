"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Dialog, Input, Loader, Pagination, Tabs, Text, useKumoToastManager } from "@cloudflare/kumo";
import {
  GridFourIcon,
  ListBulletsIcon,
  FolderPlusIcon,
  UploadSimpleIcon,
  XIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  FileZipIcon,
} from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { DashboardPageSkeleton } from "@/components/shell/dashboard-page-skeleton";
import { usePageReady } from "@/components/shell/navigation-provider";
import { FileItem } from "@/lib/file-item";
import { notifyStorageUpdated } from "@/lib/storage-events";
import { uploadFileDirect } from "@/lib/upload-file";
import type { TagColorValue, WorkspaceTag } from "@/lib/tags";
import type { FolderColorValue } from "@/lib/folder-colors";
import { FileBreadcrumbs } from "./file-breadcrumbs";
import { FileTable, type TypeFilterValue } from "./file-table";
import { FileGrid } from "./file-grid";
import { FileDetailsPanel } from "./file-details-panel";
import { UploadDropzone } from "./upload-dropzone";
import { ItemShareDialog } from "./item-share-dialog";
import { TransferDialog } from "./transfer-dialog";
import { ManageTagsDialog } from "./manage-tags-dialog";
import { FolderColorDialog } from "./folder-color-dialog";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

type ViewMode = "table" | "grid";

export function FileBrowser() {
  const t = useTranslations("fileBrowser");
  const tToasts = useTranslations("fileBrowser.toasts");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchQuery = searchParams.get("search");

  const pageParam = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSizeParam = parseInt(searchParams.get("pageSize") ?? "", 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam) ? pageSizeParam : DEFAULT_PAGE_SIZE;

  function updateQueryParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const { data: activeOrg } = authClient.useActiveOrganization();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [breadcrumbsPath, setBreadcrumbsPath] = useState<Array<{ id: string | null; name: string }>>([]);
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  // État modale création dossier
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // État modale renommage
  const [renameItem, setRenameItem] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // État modale partage / transfert
  const [shareItem, setShareItem] = useState<FileItem | null>(null);
  const [transferItem, setTransferItem] = useState<FileItem | null>(null);

  // État modale d'upload
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<
    Array<{ name: string; status: "uploading" | "success" | "error"; progress: number }>
  >([]);

  // État modale de gestion des tags
  const [workspaceTags, setWorkspaceTags] = useState<WorkspaceTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [manageTagsItem, setManageTagsItem] = useState<FileItem | null>(null);

  // État modale de couleur de dossier
  const [colorItem, setColorItem] = useState<FileItem | null>(null);
  const [canManage, setCanManage] = useState(false);

  // État de sélection multiple et suppression groupée
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // État des filtres
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>("all");
  const [tagFilterIds, setTagFilterIds] = useState<Set<string>>(new Set());

  // État de la dropzone plein cadre (glisser-déposer de fichiers depuis le système)
  const [isDraggingFileOver, setIsDraggingFileOver] = useState(false);
  const dragCounter = useRef(0);
  usePageReady(!loading);

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
  async function fetchFiles(folderId: string | null, search?: string | null, opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
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
      if (!opts?.silent) setLoading(false);
    }
  }

  function refreshFiles() {
    return fetchFiles(currentFolderId, searchQuery, { silent: true });
  }

  useEffect(() => {
    fetchFiles(currentFolderId, searchQuery);
  }, [currentFolderId, searchQuery, activeOrg?.id]);

  async function fetchTags() {
    setLoadingTags(true);
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const data = await res.json();
        setWorkspaceTags(data.tags ?? []);
      }
    } catch (err) {
      console.error("Erreur de chargement des tags :", err);
    } finally {
      setLoadingTags(false);
    }
  }

  useEffect(() => {
    fetchTags();
    fetch("/api/workspace/members")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCanManage(Boolean(data?.canManage)))
      .catch(() => setCanManage(false));
  }, [activeOrg?.id]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter === "folder" && item.type !== "folder") return false;
      if (typeFilter === "file" && item.type !== "file") return false;
      if (tagFilterIds.size > 0) {
        const itemTagIds = new Set((item.tags ?? []).map((t) => t.id));
        const hasMatch = [...tagFilterIds].some((id) => itemTagIds.has(id));
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [items, typeFilter, tagFilterIds]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Ramène à la page 1 dès que le dossier, la recherche ou les filtres changent
  // (ignore le tout premier rendu pour ne pas écraser un ?page= présent dans l'URL initiale)
  const isFirstFilterRender = useRef(true);
  useEffect(() => {
    if (isFirstFilterRender.current) {
      isFirstFilterRender.current = false;
      return;
    }
    updateQueryParams({ page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, searchQuery, typeFilter, tagFilterIds]);

  // Corrige l'URL si la page demandée dépasse le nombre de pages disponibles
  // (seulement une fois les données chargées, pour ne pas écraser un ?page= valide pendant le chargement)
  useEffect(() => {
    if (!loading && page > pageCount) {
      updateQueryParams({ page: pageCount > 1 ? String(pageCount) : null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, page, pageCount]);

  const allVisibleSelected = paginatedItems.length > 0 && paginatedItems.every((i) => selectedIds.has(i.id));
  const someVisibleSelected = paginatedItems.some((i) => selectedIds.has(i.id));

  function handleOpenFolder(folderId: string) {
    setCurrentFolderId(folderId);
    setSelectedItemId(null);
    setSelectedIds(new Set());
  }

  function handleNavigate(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSelectedItemId(null);
    setSelectedIds(new Set());
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        paginatedItems.forEach((i) => next.delete(i.id));
        return next;
      }
      const next = new Set(prev);
      paginatedItems.forEach((i) => next.add(i.id));
      return next;
    });
  }

  function toggleSelectItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTagFilter(tagId: string) {
    setTagFilterIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  async function handleBulkDeleteConfirm() {
    const targets = items.filter((i) => selectedIds.has(i.id));
    if (targets.length === 0) return;

    setBulkDeleting(true);
    try {
      const res = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: targets.map((item) => ({ id: item.id, type: item.type })),
        }),
      });
      if (!res.ok) throw new Error("bulk delete failed");

      toasts.add({
        title: tToasts("itemsDeletedTitle"),
        description: tToasts("itemsDeletedDescription", { count: targets.length }),
      });

      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      refreshFiles();
      notifyStorageUpdated();
    } catch (err) {
      console.error("Bulk delete error:", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("bulkDeleteErrorDescription") });
    } finally {
      setBulkDeleting(false);
    }
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
          title: tToasts("folderCreatedTitle"),
          description: tToasts("folderCreatedDescription", { name: newFolderName }),
        });
        setNewFolderName("");
        setIsFolderModalOpen(false);
        refreshFiles();
      } else {
        toasts.add({
          title: tToasts("genericError"),
          description: tToasts("folderCreateErrorDescription"),
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
          title: tToasts("itemRenamedTitle"),
          description: tToasts("itemRenamedDescription", { name: renameValue.trim() }),
        });
        setRenameItem(null);
        refreshFiles();
      } else {
        const data = await res.json().catch(() => null);
        toasts.add({
          title: tToasts("genericError"),
          description:
            res.status === 409 ? tToasts("renameConflictDescription") : (data?.error ?? tToasts("renameErrorDescription")),
        });
      }
    } catch (err) {
      console.error("Rename error:", err);
    } finally {
      setRenaming(false);
    }
  }

  async function handleDeleteItem(item: FileItem) {
    try {
      const res = await fetch(`/api/files?id=${item.id}&type=${item.type}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toasts.add({
          title: tToasts("itemDeletedTitle"),
          description: tToasts("itemDeletedDescription", { name: item.name }),
        });
        refreshFiles();
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
        const targetName = targetObj ? `"${targetObj.name}"` : tToasts("rootLocationLabel");
        toasts.add({
          title: tToasts("itemMovedTitle"),
          description: tToasts("itemMovedDescription", { name: dragged.name, target: targetName }),
        });
        refreshFiles();
      }
    } catch (err) {
      console.error("Move error:", err);
    }
  }

  async function handleUploadFiles(files: FileList) {
    if (files.length === 0) return;

    const fileArray = Array.from(files);
    setUploadQueue(fileArray.map((f) => ({ name: f.name, status: "uploading", progress: 0 })));
    setIsUploadDialogOpen(true);

    let successCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const fileToUpload = fileArray[i]!;

      try {
        await uploadFileDirect(fileToUpload, currentFolderId, (progress) => {
          setUploadQueue((prev) => prev.map((item, idx) => (idx === i ? { ...item, progress } : item)));
        });
        successCount++;
        setUploadQueue((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: "success", progress: 100 } : item)),
        );
      } catch (err) {
        console.error("Upload error:", err);
        setUploadQueue((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "error" } : item)));
      }
    }

    if (successCount > 0) {
      refreshFiles();
      notifyStorageUpdated();
    }
  }

  function handleShareItem(item: FileItem) {
    setShareItem(item);
  }

  async function handleArchiveItem(item: FileItem) {
    try {
      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, type: item.type }),
      });
      if (!res.ok) throw new Error("archive failed");
      toasts.add({
        title: tToasts("itemArchivedTitle"),
        description: tToasts("itemArchivedDescription", { name: item.name }),
      });
      if (selectedItemId === item.id) setSelectedItemId(null);
      refreshFiles();
    } catch (err) {
      console.error("Archive error:", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("archiveErrorDescription") });
    }
  }

  async function handleToggleFavorite(item: FileItem) {
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
        title: nextFavorite ? tToasts("favoriteAddedTitle") : tToasts("favoriteRemovedTitle"),
        description: nextFavorite
          ? tToasts("favoriteAddedDescription", { name: item.name })
          : tToasts("favoriteRemovedDescription", { name: item.name }),
      });
    } catch (err) {
      console.error("Toggle favorite error:", err);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isFavorite: item.isFavorite } : i)));
      toasts.add({ title: tToasts("genericError"), description: tToasts("favoriteErrorDescription") });
    }
  }

  function handleDetailAction(action: string) {
    toasts.add({
      title: tToasts("fileActionTitle"),
      description: tToasts("fileActionDescription", { action }),
    });
  }

  async function handleChangeFolderColor(item: FileItem, color: FolderColorValue) {
    const previousColor = item.color;
    const nextColor = color === "default" ? null : color;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, color: nextColor } : i)));
    setColorItem(null);

    try {
      const res = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, type: item.type, color }),
      });
      if (!res.ok) throw new Error("Failed to update folder color");
    } catch (err) {
      console.error("Change folder color error:", err);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, color: previousColor } : i)));
      toasts.add({ title: tToasts("genericError"), description: tToasts("colorErrorDescription") });
    }
  }

  function triggerDownload(url: string) {
    const link = document.createElement("a");
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function handleDownloadZip(item: FileItem) {
    triggerDownload(`/api/files/zip?items=${item.id}:${item.type}`);
  }

  function handleDownloadSelectedZip() {
    const targets = items.filter((i) => selectedIds.has(i.id));
    if (targets.length === 0) return;
    const query = targets.map((i) => `${i.id}:${i.type}`).join(",");
    triggerDownload(`/api/files/zip?items=${encodeURIComponent(query)}`);
  }

  async function handleExtractZip(item: FileItem) {
    toasts.add({ title: tToasts("extractingTitle"), description: tToasts("extractingDescription", { name: item.name }) });
    try {
      const res = await fetch("/api/files/unzip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to extract archive");

      toasts.add({
        title: tToasts("extractedTitle"),
        description: tToasts("extractedDescription", {
          name: item.name,
          folder: data.folder.name,
          count: data.extractedCount,
        }),
      });
      refreshFiles();
      notifyStorageUpdated();
    } catch (err) {
      console.error("Extract zip error:", err);
      const message = err instanceof Error ? err.message : tToasts("extractErrorFallback");
      toasts.add({ title: tToasts("genericError"), description: message });
    }
  }

  async function handleToggleTag(tag: WorkspaceTag) {
    const item = manageTagsItem;
    if (!item) return;
    const isAssigned = (item.tags ?? []).some((t) => t.id === tag.id);
    const nextTags = isAssigned
      ? (item.tags ?? []).filter((t) => t.id !== tag.id)
      : [...(item.tags ?? []), tag];

    setManageTagsItem({ ...item, tags: nextTags });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, tags: nextTags } : i)));

    try {
      const res = isAssigned
        ? await fetch(`/api/tags/assign?tagId=${tag.id}&itemId=${item.id}`, { method: "DELETE" })
        : await fetch("/api/tags/assign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagId: tag.id, itemId: item.id, itemType: item.type }),
          });
      if (!res.ok) throw new Error("Failed to toggle tag");
    } catch (err) {
      console.error("Toggle tag error:", err);
      setManageTagsItem(item);
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      toasts.add({ title: tToasts("genericError"), description: tToasts("tagErrorDescription") });
    }
  }

  async function handleCreateTag(name: string, color: TagColorValue) {
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        const data = await res.json();
        setWorkspaceTags((prev) => [...prev, data.tag].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const data = await res.json().catch(() => null);
        toasts.add({ title: tToasts("genericError"), description: data?.error ?? tToasts("tagCreateErrorDescription") });
      }
    } catch (err) {
      console.error("Create tag error:", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("tagCreateErrorDescription") });
    }
  }

  async function handleDeleteTag(tag: WorkspaceTag) {
    if (!confirm(t("deleteTagConfirm", { name: tag.name }))) return;
    try {
      const res = await fetch(`/api/tags?id=${tag.id}`, { method: "DELETE" });
      if (res.ok) {
        setWorkspaceTags((prev) => prev.filter((t) => t.id !== tag.id));
        setItems((prev) => prev.map((i) => ({ ...i, tags: (i.tags ?? []).filter((t) => t.id !== tag.id) })));
        setManageTagsItem((prev) => (prev ? { ...prev, tags: (prev.tags ?? []).filter((t) => t.id !== tag.id) } : prev));
        toasts.add({ title: tToasts("tagDeletedTitle"), description: tToasts("tagDeletedDescription", { name: tag.name }) });
      }
    } catch (err) {
      console.error("Delete tag error:", err);
      toasts.add({ title: tToasts("genericError"), description: tToasts("tagDeleteErrorDescription") });
    }
  }

  return (
    <div className="flex h-full min-h-0 gap-6">
      <div
        className="relative flex min-h-0 flex-1 flex-col gap-4"
        onDragEnter={handleBrowserDragEnter}
        onDragOver={handleBrowserDragOver}
        onDragLeave={handleBrowserDragLeave}
        onDrop={handleBrowserDrop}
      >
        {isDraggingFileOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-kumo-info bg-kumo-tint/90">
            <UploadSimpleIcon size={40} className="text-kumo-info" />
            <span className="text-sm font-medium text-kumo-info">{t("dropOverlay")}</span>
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
              {t("newFolder")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={UploadSimpleIcon}
              onClick={() => document.getElementById("toolbar-file-upload")?.click()}
            >
              {t("upload")}
            </Button>
            <Tabs
              variant="segmented"
              size="sm"
              tabs={[
                {
                  value: "table",
                  label: (
                    <span className="flex items-center gap-1">
                      <ListBulletsIcon size={16} /> {t("viewList")}
                    </span>
                  ),
                },
                {
                  value: "grid",
                  label: (
                    <span className="flex items-center gap-1">
                      <GridFourIcon size={16} /> {t("viewGrid")}
                    </span>
                  ),
                },
              ]}
              value={viewMode}
              onValueChange={(value) => setViewMode(value as ViewMode)}
            />
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-kumo-tint px-3 py-2">
            <Text variant="secondary">{t("selectedCount", { count: selectedIds.size })}</Text>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                {t("deselectAll")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={FileZipIcon}
                onClick={handleDownloadSelectedZip}
              >
                {t("compress")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                icon={TrashIcon}
                onClick={() => setBulkDeleteOpen(true)}
              >
                {t("delete")}
              </Button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <DashboardPageSkeleton path="/dashboard" contentOnly />
        ) : items.length === 0 ? (
          <UploadDropzone onFilesSelected={handleUploadFiles} />
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-kumo-line bg-kumo-base p-10">
            <Text variant="secondary">{t("noItemsMatchFilters")}</Text>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setTypeFilter("all");
                setTagFilterIds(new Set());
              }}
            >
              {t("resetFilters")}
            </Button>
          </div>
        ) : viewMode === "table" ? (
          <FileTable
            items={paginatedItems}
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
            onManageTags={setManageTagsItem}
            onChangeColor={setColorItem}
            onDownloadZip={handleDownloadZip}
            onExtractZip={handleExtractZip}
            onArchive={handleArchiveItem}
            onTransfer={canManage ? setTransferItem : undefined}
            onMoveItem={handleMoveItem}
            selectedIds={selectedIds}
            onToggleSelectItem={toggleSelectItem}
            allSelected={allVisibleSelected}
            someSelected={someVisibleSelected}
            onToggleSelectAll={toggleSelectAll}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            workspaceTags={workspaceTags}
            tagFilterIds={tagFilterIds}
            onToggleTagFilter={toggleTagFilter}
            onClearTagFilter={() => setTagFilterIds(new Set())}
          />
        ) : (
          <FileGrid
            items={paginatedItems}
            selectedItemId={selectedItemId}
            onOpenFolder={handleOpenFolder}
            onSelectItem={setSelectedItemId}
            onToggleFavorite={handleToggleFavorite}
            onMoveItem={handleMoveItem}
          />
        )}
        </div>

        {!loading && filteredItems.length > 0 && (
          <Pagination
            page={currentPage}
            setPage={(nextPage) => updateQueryParams({ page: nextPage > 1 ? String(nextPage) : null })}
            perPage={pageSize}
            totalCount={filteredItems.length}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <Pagination.Info />
            <div className="flex items-center gap-3">
              <Pagination.PageSize
                value={pageSize}
                onChange={(size) => updateQueryParams({ pageSize: size === DEFAULT_PAGE_SIZE ? null : String(size), page: null })}
                options={PAGE_SIZE_OPTIONS}
                label={t("perPage")}
              />
              <Pagination.Controls pageSelector="input" />
            </div>
          </Pagination>
        )}
      </div>

      {selectedItem && (
        <FileDetailsPanel
          item={selectedItem}
          onClose={() => setSelectedItemId(null)}
          onAction={handleDetailAction}
          onShare={handleShareItem}
          onToggleFavorite={handleToggleFavorite}
          onManageTags={setManageTagsItem}
        />
      )}

      <ManageTagsDialog
        item={manageTagsItem}
        workspaceTags={workspaceTags}
        loading={loadingTags}
        onClose={() => setManageTagsItem(null)}
        onToggleTag={handleToggleTag}
        onCreateTag={handleCreateTag}
        onDeleteTag={handleDeleteTag}
      />

      <FolderColorDialog
        item={colorItem}
        onClose={() => setColorItem(null)}
        onSelectColor={handleChangeFolderColor}
      />

      {/* Modale de création de dossier */}
      <Dialog.Root open={isFolderModalOpen} onOpenChange={setIsFolderModalOpen}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">{t("createFolderTitle")}</Dialog.Title>
            <Dialog.Close
              aria-label={t("close")}
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={t("close")} />
              )}
            />
          </div>

          <form onSubmit={handleCreateFolder} className="flex flex-col gap-4">
            <Input
              size="sm"
              label={t("folderName")}
              placeholder={t("folderNamePlaceholder")}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              required
              autoFocus
            />

            <div className="flex justify-end gap-2 mt-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setIsFolderModalOpen(false)}>
                {t("cancel")}
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={creatingFolder}>
                {creatingFolder ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> {t("creating")}
                  </span>
                ) : (
                  t("createFolder")
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
              {t("renameTitle", { name: renameItem?.name ?? "" })}
            </Dialog.Title>
            <Dialog.Close
              aria-label={t("close")}
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={t("close")} />
              )}
            />
          </div>

          <form onSubmit={handleRenameSubmit} className="flex flex-col gap-4">
            <Input
              size="sm"
              label={t("newName")}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              required
              autoFocus
            />

            <div className="flex justify-end gap-2 mt-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setRenameItem(null)}>
                {t("cancel")}
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={renaming}>
                {renaming ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> {t("renaming")}
                  </span>
                ) : (
                  t("rename")
                )}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>

      <ItemShareDialog item={shareItem} onClose={() => setShareItem(null)} />
      <TransferDialog
        item={transferItem}
        onClose={() => setTransferItem(null)}
        onTransferred={() => refreshFiles()}
      />

      {/* Modale de progression d'upload */}
      <Dialog.Root open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">{t("uploadTitle")}</Dialog.Title>
            <Dialog.Close
              aria-label={t("close")}
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={t("close")} />
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
                  {item.status === "uploading"
                    ? t("uploadStatusProgress", { percent: item.progress })
                    : item.status === "success"
                      ? t("uploadStatusSuccess")
                      : t("uploadStatusError")}
                </span>
              </div>
            ))}
          </div>

          {uploadQueue.length > 0 && uploadQueue.every((item) => item.status !== "uploading") && (
            <div className="flex justify-end mt-4">
              <Button variant="secondary" size="sm" onClick={() => setIsUploadDialogOpen(false)}>
                {t("close")}
              </Button>
            </div>
          )}
        </Dialog>
      </Dialog.Root>

      {/* Modale de confirmation de suppression groupée */}
      <Dialog.Root open={bulkDeleteOpen} onOpenChange={(open) => !bulkDeleting && setBulkDeleteOpen(open)}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">
              {t("deleteConfirmTitle", { count: selectedIds.size })}
            </Dialog.Title>
            <Dialog.Close
              aria-label={t("close")}
              render={(props) => (
                <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={t("close")} disabled={bulkDeleting} />
              )}
            />
          </div>

          <Text variant="secondary">{t("deleteConfirmBody")}</Text>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDeleteConfirm} disabled={bulkDeleting}>
              {bulkDeleting ? (
                <span className="flex items-center gap-1.5">
                  <Loader size="sm" /> {t("deleting")}
                </span>
              ) : (
                t("delete")
              )}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
