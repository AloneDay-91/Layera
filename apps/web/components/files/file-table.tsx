"use client";

import { Table } from "@cloudflare/kumo";
import type { MockItem } from "@/lib/mock-files";
import { formatFileSize } from "@/lib/mock-files";
import { FilePreviewIcon } from "./file-preview";
import { FileRowMenu } from "./file-row-menu";

export function FileTable({
  items,
  selectedItemId,
  onOpenFolder,
  onSelectItem,
}: {
  items: MockItem[];
  selectedItemId: string | null;
  onOpenFolder: (folderId: string) => void;
  onSelectItem: (itemId: string | null) => void;
}) {
  function handleActivate(item: MockItem) {
    if (item.type === "folder") {
      onOpenFolder(item.id);
    } else {
      onSelectItem(selectedItemId === item.id ? null : item.id);
    }
  }

  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Nom</Table.Head>
          <Table.Head>Propriétaire</Table.Head>
          <Table.Head>Modifié</Table.Head>
          <Table.Head>Taille</Table.Head>
          <Table.Head></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.map((item) => (
          <Table.Row key={item.id} variant={selectedItemId === item.id ? "selected" : "default"}>
            <Table.Cell>
              <button
                type="button"
                onClick={() => handleActivate(item)}
                className="flex items-center gap-2 border-0 bg-transparent p-0 text-left font-inherit"
              >
                <FilePreviewIcon item={item} />
                {item.name}
              </button>
            </Table.Cell>
            <Table.Cell>{item.owner}</Table.Cell>
            <Table.Cell>{new Date(item.updatedAt).toLocaleDateString("fr-FR")}</Table.Cell>
            <Table.Cell>{formatFileSize(item.size)}</Table.Cell>
            <Table.Cell>
              <FileRowMenu item={item} />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
