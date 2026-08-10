"use client";

import { useState } from "react";
import {
  Button,
  Input,
  DropdownMenu,
  Tooltip,
  TooltipProvider,
  Table,
  SkeletonLine,
  Toasty,
  useKumoToastManager,
  Breadcrumbs,
  Tabs,
  Meter,
  Dialog,
} from "@cloudflare/kumo";

function ToastDemo() {
  const toasts = useKumoToastManager();

  return (
    <Button
      onClick={() =>
        toasts.add({
          title: "Upload complete",
          description: "report.pdf was uploaded successfully.",
        })
      }
    >
      Show toast
    </Button>
  );
}

function DesignSystemContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("grid");

  return (
    <main style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
      <h1>FileCloud Design System</h1>

      <section>
        <h2>Buttons</h2>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Button variant="secondary">Secondary</Button>
        </div>
      </section>

      <section>
        <h2>Inputs</h2>
        <Input placeholder="Search files…" aria-label="Search files" />
      </section>

      <section>
        <h2>Menu / Dropdown</h2>
        <DropdownMenu>
          <DropdownMenu.Trigger>
            <Button>Actions</Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Rename</DropdownMenu.Item>
            <DropdownMenu.Item>Move</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item variant="danger">Delete</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </section>

      <section>
        <h2>Tooltip</h2>
        <Tooltip content="Download this file" render={<Button />}>
          Download
        </Tooltip>
      </section>

      <section>
        <h2>Table</h2>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Name</Table.Head>
              <Table.Head>Size</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell>report.pdf</Table.Cell>
              <Table.Cell>1.2 MB</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>avatar.png</Table.Cell>
              <Table.Cell>84 KB</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      </section>

      <section>
        <h2>Skeleton</h2>
        <SkeletonLine blockHeight={20} minWidth={120} maxWidth={200} />
      </section>

      <section>
        <h2>Toast</h2>
        <ToastDemo />
      </section>

      <section>
        <h2>Breadcrumbs</h2>
        <Breadcrumbs>
          <Breadcrumbs.Link href="/dashboard">My files</Breadcrumbs.Link>
          <Breadcrumbs.Separator />
          <Breadcrumbs.Current>Photos</Breadcrumbs.Current>
        </Breadcrumbs>
      </section>

      <section>
        <h2>Tabs</h2>
        <Tabs
          tabs={[
            { value: "grid", label: "Grid" },
            { value: "list", label: "List" },
          ]}
          value={activeTab}
          onValueChange={setActiveTab}
        />
      </section>

      <section>
        <h2>Progress</h2>
        <Meter label="Storage used" value={62} />
      </section>

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog>
          <Dialog.Title>Kumo dialog</Dialog.Title>
          <Dialog.Description>This is a Kumo dialog.</Dialog.Description>
          <Dialog.Close render={<Button>Close</Button>} />
        </Dialog>
      </Dialog.Root>
    </main>
  );
}

export default function DesignSystemPage() {
  return (
    <Toasty>
      <TooltipProvider>
        <DesignSystemContent />
      </TooltipProvider>
    </Toasty>
  );
}
