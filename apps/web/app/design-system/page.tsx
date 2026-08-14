"use client";

import { useState } from "react";
import {
  HouseIcon,
  FolderIcon,
  ShareNetworkIcon,
  TrashIcon,
  GearIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  InfoIcon,
  WarningIcon,
  WarningCircleIcon,
  PackageIcon,
  CodeIcon,
  GlobeIcon,
  TextBolderIcon,
  TextItalicIcon,
  FunnelSimpleIcon,
  GearSixIcon,
  XIcon,
} from "@phosphor-icons/react";

// Imports granulaires — un sous-chemin par composant
import { Autocomplete } from "@cloudflare/kumo/components/autocomplete";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { Breadcrumbs } from "@cloudflare/kumo/components/breadcrumbs";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { ClipboardText } from "@cloudflare/kumo/components/clipboard-text";
import { CloudflareLogo } from "@cloudflare/kumo/components/cloudflare-logo";
import { Code } from "@cloudflare/kumo/components/code";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import { Combobox } from "@cloudflare/kumo/components/combobox";
import { CommandPalette } from "@cloudflare/kumo/components/command-palette";
import { DatePicker } from "@cloudflare/kumo/components/date-picker";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Field } from "@cloudflare/kumo/components/field";
import { Grid, GridItem } from "@cloudflare/kumo/components/grid";
import { Input } from "@cloudflare/kumo/components/input";
import { InputArea } from "@cloudflare/kumo";
import { InputGroup } from "@cloudflare/kumo/components/input-group";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Link } from "@cloudflare/kumo/components/link";
import { Loader } from "@cloudflare/kumo/components/loader";
import { MenuBar } from "@cloudflare/kumo/components/menubar";
import { Meter } from "@cloudflare/kumo/components/meter";
import { Pagination } from "@cloudflare/kumo/components/pagination";
import { Popover } from "@cloudflare/kumo/components/popover";
import { Radio } from "@cloudflare/kumo/components/radio";
import { Select } from "@cloudflare/kumo/components/select";
import { SensitiveInput } from "@cloudflare/kumo/components/sensitive-input";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Table } from "@cloudflare/kumo/components/table";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { Text } from "@cloudflare/kumo/components/text";
import { Toasty, useKumoToastManager } from "@cloudflare/kumo/components/toast";
import { Toolbar } from "@cloudflare/kumo/components/toolbar";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { ShikiProvider,CodeHighlighted } from "@cloudflare/kumo/code";

function ToastDemo() {
  const toasts = useKumoToastManager();

  return (
    <Button
      onClick={() =>
        toasts.add({
          title: "Upload terminé",
          description: "report.pdf a été uploadé avec succès.",
        })
      }
    >
      Afficher un toast
    </Button>
  );
}

function DesignSystemContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("grid");
  const [checked, setChecked] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [radioValue, setRadioValue] = useState("email");
  const [selectValue, setSelectValue] = useState("apple");
  const [comboboxValue, setComboboxValue] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [menuActive, setMenuActive] = useState<string | undefined>(undefined);
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [inputGroupValue, setInputGroupValue] = useState("");

  const fileRows = [
    { id: 1, name: "rapport-annuel.pdf", type: "PDF", size: "2.4 MB" },
    { id: 2, name: "avatar.png", type: "Image", size: "84 KB" },
    { id: 3, name: "backup.zip", type: "Archive", size: "500 MB" },
  ];

  const paletteGroups = [
    {
      label: "Actions",
      items: [
        { title: "Nouveau dossier" },
        { title: "Uploader un fichier" },
        { title: "Créer un lien de partage" },
      ],
    },
    {
      label: "Navigation",
      items: [
        { title: "Aller à Mes fichiers" },
        { title: "Aller à Partagés" },
        { title: "Aller à Corbeille" },
      ],
    },
  ];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 p-8">
      <header>
        <Text variant="heading1" as="h1">
          Layera Design System
        </Text>
        <Text variant="secondary">
          Composants Kumo UI v2.9 — imports granulaires
        </Text>
      </header>

      {/* ══════════════ ACTIONS ══════════════ */}
      <section className="flex flex-col gap-6">
        <Text variant="heading2" as="h2">
          Actions
        </Text>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="secondary-destructive">Sec. Destructive</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button
            variant="secondary"
            shape="square"
            icon={<PlusIcon />}
            aria-label="Ajouter"
          />
        </div>

        <DropdownMenu>
          <DropdownMenu.Trigger
            render={<Button variant="outline">Actions du fichier</Button>}
          />
          <DropdownMenu.Content>
            <DropdownMenu.Item>Renommer</DropdownMenu.Item>
            <DropdownMenu.Item>Déplacer</DropdownMenu.Item>
            <DropdownMenu.Item>Télécharger</DropdownMenu.Item>
            <DropdownMenu.Item>Partager</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item variant="danger">Supprimer</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </section>

      {/* ══════════════ FORMULAIRES ══════════════ */}
      <section className="flex flex-col gap-6">
        <Text variant="heading2" as="h2">
          Formulaires
        </Text>

        <div className="grid max-w-md gap-4">
          <Input
            label="Email"
            placeholder="toi@exemple.com"
            description="On ne partagera jamais ton email"
          />
          <Input placeholder="Recherche sans label…" aria-label="Recherche" />
        </div>

        <Field
          label="Description"
          description="Décris le contenu de ce fichier"
        >
          <InputArea placeholder="Décris ce fichier…" />
        </Field>

        <InputGroup className="max-w-xs">
          <InputGroup.Input
            placeholder="mon-bucket"
            value={inputGroupValue}
            onChange={(e) => setInputGroupValue(e.target.value)}
          />
          <InputGroup.Suffix>.files.app</InputGroup.Suffix>
        </InputGroup>

        <Select
          label="Type de fichier"
          className="max-w-xs"
          value={selectValue}
          onValueChange={(v) => setSelectValue(v ?? "apple")}
          items={{
            all: "Tous les fichiers",
            images: "Images",
            documents: "Documents",
            videos: "Vidéos",
          }}
        />

        <div className="flex flex-col gap-3">
          <Checkbox
            label="Sélectionner ce fichier"
            checked={checked}
            onCheckedChange={setChecked}
          />
          <Checkbox label="Option désactivée" disabled />
          <Checkbox label="Option invalide" variant="error" />
        </div>

        <Checkbox.Group
          legend="Préférences email"
          description="Choisis les notifications à recevoir"
        >
          <Checkbox label="Uploads terminés" />
          <Checkbox label="Liens consultés" />
        </Checkbox.Group>

        <Switch
          label="Notifications activées"
          checked={switchOn}
          onCheckedChange={setSwitchOn}
        />

        <Radio.Group
          legend="Visibilité du lien"
          value={radioValue}
          onValueChange={setRadioValue}
        >
          <Radio.Item label="Privé" value="private" />
          <Radio.Item label="Partagé" value="shared" />
          <Radio.Item label="Public" value="public" />
        </Radio.Group>

        <Autocomplete
          items={["Alice Martin", "Bob Dupont", "Claire Bernard"]}
          label="Destinataire"
          description="Commence à taper pour filtrer"
        >
          <Autocomplete.InputGroup placeholder="Rechercher un utilisateur…" />
          <Autocomplete.Content>
            <Autocomplete.List>
              {(item: string) => (
                <Autocomplete.Item key={item} value={item}>
                  {item}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Content>
        </Autocomplete>

        <Combobox
          items={["Nom", "Date de modification", "Taille"]}
          value={comboboxValue}
          onValueChange={(v) => setComboboxValue(v as string | null)}
        >
          <Combobox.TriggerInput placeholder="Trier par…" />
          <Combobox.Content>
            <Combobox.Empty>Aucun résultat.</Combobox.Empty>
            <Combobox.List>
              {(item: string) => (
                <Combobox.Item key={item} value={item}>
                  {item}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Content>
        </Combobox>

        <div className="flex flex-col gap-2">
          <DatePicker
            mode="single"
            selected={date}
            onChange={(d) => {
              if (d) setDate(d);
            }}
          />
          <Text variant="secondary">
            Sélectionné : {date ? date.toLocaleDateString("fr-FR") : "aucune"}
          </Text>
        </div>

        <SensitiveInput
          label="Clé API"
          defaultValue="sk_live_abc123xyz789"
          className="max-w-sm"
        />
      </section>

      {/* ══════════════ AFFICHAGE DE DONNÉES ══════════════ */}
      <section className="flex flex-col gap-6">
        <Text variant="heading2" as="h2">
          Affichage de données
        </Text>

        <LayerCard className="p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Nom</Table.Head>
                <Table.Head>Type</Table.Head>
                <Table.Head>Taille</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {fileRows.map((row) => (
                <Table.Row key={row.id}>
                  <Table.Cell>{row.name}</Table.Cell>
                  <Table.Cell>{row.type}</Table.Cell>
                  <Table.Cell>{row.size}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>

        <div className="flex flex-wrap gap-2">
          <Badge variant="primary">Primary</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="beta">Beta</Badge>
        </div>

        <div className="flex flex-col gap-3">
          <Banner
            icon={<InfoIcon weight="fill" />}
            title="Upload en cours"
            description="5 fichiers sont en cours d'upload en arrière-plan."
          />
          <Banner
            icon={<WarningIcon weight="fill" />}
            variant="alert"
            title="Stockage presque plein"
            description="Ton espace de stockage est utilisé à 92%."
          />
          <Banner
            icon={<WarningCircleIcon weight="fill" />}
            variant="error"
            title="Échec de synchronisation"
            description="Impossible de contacter le serveur MinIO."
          />
        </div>

        <TooltipProvider>
          <Tooltip
            content="Télécharger ce fichier"
            render={<Button variant="outline">Télécharger</Button>}
          />
        </TooltipProvider>

        <ShikiProvider
          engine="javascript"
          languages={["tsx", "typescript", "bash", "json"]}
        >
          <CodeHighlighted
            lang="ts"
            code={`const url = await minio.presignedPutObject(bucket, key, 900);`}
          />
        </ShikiProvider>

        <ClipboardText text="https://files.example.com/s/abc123" />

        <CloudflareLogo />
      </section>

      {/* ══════════════ FEEDBACK ══════════════ */}
      <section className="flex flex-col gap-6">
        <Text variant="heading2" as="h2">
          Feedback
        </Text>

        <div className="flex flex-wrap gap-3">
          <ToastDemo />
          <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
            <Dialog.Trigger
              render={<Button variant="primary">Ouvrir le dialog</Button>}
            />
            <Dialog className="p-8">
              <div className="mb-4 flex items-start justify-between gap-4">
                <Dialog.Title className="text-2xl font-semibold">
                  Partager le fichier
                </Dialog.Title>
                <Dialog.Close
                  aria-label="Fermer"
                  render={(props) => (
                    <Button
                      {...props}
                      variant="secondary"
                      shape="square"
                      icon={<XIcon />}
                      aria-label="Fermer"
                    />
                  )}
                />
              </div>
              <Dialog.Description>
                Crée un lien public pour partager ce fichier avec d&apos;autres
                personnes.
              </Dialog.Description>
              <div className="mt-4">
                <Input
                  label="Email du destinataire"
                  placeholder="ami@exemple.com"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="primary">Créer le lien</Button>
              </div>
            </Dialog>
          </Dialog.Root>
        </div>

        <Meter label="Stockage utilisé" value={62} />

        <Loader />

        <Empty
          icon={<PackageIcon size={48} />}
          title="Aucun fichier"
          description="Ce dossier est vide. Uploade ton premier fichier pour commencer."
          contents={
            <div className="flex items-center gap-2">
              <Button icon={<CodeIcon />} variant="secondary">
                Voir la doc API
              </Button>
              <Button icon={<GlobeIcon />} variant="primary">
                Uploader un fichier
              </Button>
            </div>
          }
        />
      </section>

      {/* ══════════════ LAYOUT ══════════════ */}
      <section className="flex flex-col gap-6">
        <Text variant="heading2" as="h2">
          Layout
        </Text>

        <LayerCard className="max-w-md p-6">
          <Text bold>Contenu dans une LayerCard</Text>
          <Text variant="secondary">
            Fond, bordure et ombre cohérents avec le design system.
          </Text>
        </LayerCard>

        <Grid variant="2up" gap="base">
          <GridItem>
            <LayerCard className="p-4">
              <Text bold>Documents</Text>
              <Text variant="secondary">128 fichiers</Text>
            </LayerCard>
          </GridItem>
          <GridItem>
            <LayerCard className="p-4">
              <Text bold>Images</Text>
              <Text variant="secondary">342 fichiers</Text>
            </LayerCard>
          </GridItem>
        </Grid>

        <LayerCard>
          <LayerCard.Secondary className="flex items-center justify-between">
            <div>Prochaines étapes</div>
            <Button variant="ghost" size="sm" shape="square" aria-label="Voir">
              →
            </Button>
          </LayerCard.Secondary>
          <LayerCard.Primary>Configurer ton premier bucket</LayerCard.Primary>
        </LayerCard>

        <Tabs
          variant="segmented"
          tabs={[
            { value: "grid", label: "Grille" },
            { value: "list", label: "Liste" },
          ]}
          selectedValue={activeTab}
          onValueChange={setActiveTab}
        />

        <Collapsible.Root
          open={collapsibleOpen}
          onOpenChange={setCollapsibleOpen}
        >
          <Collapsible.DefaultTrigger>
            Détails techniques
          </Collapsible.DefaultTrigger>
          <Collapsible.DefaultPanel>
            <Text>
              Clé S3 : workspaces/abc123/files/xyz789 · MIME : application/pdf
            </Text>
          </Collapsible.DefaultPanel>
        </Collapsible.Root>
      </section>

      {/* ══════════════ NAVIGATION ══════════════ */}
      <section className="flex flex-col gap-6">
        <Text variant="heading2" as="h2">
          Navigation
        </Text>

        <Breadcrumbs>
          <Breadcrumbs.Link href="#">Mes fichiers</Breadcrumbs.Link>
          <Breadcrumbs.Separator />
          <Breadcrumbs.Link href="#">Documents</Breadcrumbs.Link>
          <Breadcrumbs.Separator />
          <Breadcrumbs.Current>Rapports 2026</Breadcrumbs.Current>
        </Breadcrumbs>

        <Pagination page={page} setPage={setPage} perPage={10} totalCount={100} />

        <MenuBar
          isActive={menuActive}
          optionIds
          options={[
            {
              icon: <TextBolderIcon />,
              id: "bold",
              tooltip: "Gras",
              onClick: () =>
                setMenuActive(menuActive === "bold" ? undefined : "bold"),
            },
            {
              icon: <TextItalicIcon />,
              id: "italic",
              tooltip: "Italique",
              onClick: () =>
                setMenuActive(menuActive === "italic" ? undefined : "italic"),
            },
          ]}
        />

        <Toolbar className="w-full max-w-md">
          <Toolbar.InputGroup
            aria-label="Rechercher des fichiers"
            className="flex-1"
          >
            <InputGroup.Addon>
              <MagnifyingGlassIcon />
            </InputGroup.Addon>
            <InputGroup.Input placeholder="Rechercher des fichiers" />
          </Toolbar.InputGroup>
          <Toolbar.Button icon={<FunnelSimpleIcon />} aria-label="Filtrer" />
          <Toolbar.Button icon={<GearSixIcon />} aria-label="Paramètres" />
        </Toolbar>

        <Popover>
          <Popover.Trigger
            render={<Button variant="outline">Options de tri</Button>}
          />
          <Popover.Content>
            <Popover.Title>Trier par</Popover.Title>
            <Popover.Description>
              Choisis l&apos;ordre d&apos;affichage des fichiers.
            </Popover.Description>
          </Popover.Content>
        </Popover>

        <Button variant="outline" onClick={() => setPaletteOpen(true)}>
          Ouvrir la palette (⌘K)
        </Button>

        <Text>
          Lien stylé : <Link href="#">retour au dashboard</Link>
        </Text>
      </section>

      {/* ══════════════ SIDEBAR ══════════════ */}
      <section className="flex flex-col gap-6">
        <Text variant="heading2" as="h2">
          Sidebar
        </Text>

        <div className="h-64 overflow-hidden rounded-lg border border-kumo-hairline">
          <Sidebar.Provider contained defaultOpen className="h-full min-h-0!">
            <Sidebar>
              <Sidebar.Content>
                <Sidebar.Group>
                  <Sidebar.GroupLabel>Fichiers</Sidebar.GroupLabel>
                  <Sidebar.Menu>
                    <Sidebar.MenuButton icon={<HouseIcon />} active>
                      Accueil
                    </Sidebar.MenuButton>
                    <Sidebar.MenuButton icon={<FolderIcon />}>
                      Mes fichiers
                    </Sidebar.MenuButton>
                    <Sidebar.MenuButton icon={<ShareNetworkIcon />}>
                      Partagés
                    </Sidebar.MenuButton>
                    <Sidebar.MenuButton icon={<TrashIcon />}>
                      Corbeille
                    </Sidebar.MenuButton>
                  </Sidebar.Menu>
                </Sidebar.Group>
                <Sidebar.Group>
                  <Sidebar.GroupLabel>Configuration</Sidebar.GroupLabel>
                  <Sidebar.Menu>
                    <Sidebar.MenuButton icon={<GearIcon />}>
                      Paramètres
                    </Sidebar.MenuButton>
                  </Sidebar.Menu>
                </Sidebar.Group>
              </Sidebar.Content>
            </Sidebar>
          </Sidebar.Provider>
        </div>
      </section>
    </main>
  );
}

export default function DesignSystemPage() {
  return (
    <Toasty>
      <DesignSystemContent />
    </Toasty>
  );
}
