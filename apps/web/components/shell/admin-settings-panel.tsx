"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Input, InputGroup, Loader, Switch, Text, useKumoToastManager } from "@cloudflare/kumo";
import { SettingsItem, SettingsList } from "@/components/shell/settings-list";
import { useInstanceFeatures } from "@/components/shell/instance-features";
import type { InstanceSettings } from "@/lib/services/instance-settings";

const GIB = 1024 ** 3;

type SocialStatus = {
  githubConfigured: boolean;
  googleConfigured: boolean;
};

type SettingsResponse = {
  settings: InstanceSettings;
  social: SocialStatus;
};

function bytesToGbInput(bytes: number): string {
  const gb = bytes / GIB;
  if (Number.isInteger(gb)) return String(gb);
  return gb.toFixed(1);
}

function parseGbInput(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * GIB);
}

function parseDaysInput(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

export function AdminSettingsPanel() {
  const t = useTranslations("adminPage.settings");
  const tToasts = useTranslations("adminPage.toasts");
  const toasts = useKumoToastManager();
  const { setFeatures } = useInstanceFeatures();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [social, setSocial] = useState<SocialStatus>({ githubConfigured: false, googleConfigured: false });
  const [instanceName, setInstanceName] = useState("Layera");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [publicSharingEnabled, setPublicSharingEnabled] = useState(true);
  const [teamsEnabled, setTeamsEnabled] = useState(true);
  const [favoritesEnabled, setFavoritesEnabled] = useState(true);
  const [tagsEnabled, setTagsEnabled] = useState(true);
  const [archiveEnabled, setArchiveEnabled] = useState(true);
  const [quotaGb, setQuotaGb] = useState("10");
  const [uploadGb, setUploadGb] = useState("5");
  const [trashDays, setTrashDays] = useState("30");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/settings");
        if (!res.ok) {
          toasts.add({ title: tToasts("genericError"), description: tToasts("loadSettingsError") });
          return;
        }
        const data = (await res.json()) as SettingsResponse;
        if (cancelled) return;
        applySettings(data.settings);
        setSocial(data.social);
      } catch {
        if (!cancelled) {
          toasts.add({ title: tToasts("genericError"), description: tToasts("loadSettingsError") });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // Load once when the settings tab mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applySettings(settings: InstanceSettings) {
    setInstanceName(settings.instanceName);
    setRegistrationEnabled(settings.registrationEnabled);
    setPublicSharingEnabled(settings.publicSharingEnabled);
    setTeamsEnabled(settings.teamsEnabled);
    setFavoritesEnabled(settings.favoritesEnabled);
    setTagsEnabled(settings.tagsEnabled);
    setArchiveEnabled(settings.archiveEnabled);
    setQuotaGb(bytesToGbInput(settings.defaultQuotaBytes));
    setUploadGb(bytesToGbInput(settings.maxUploadBytes));
    setTrashDays(String(settings.trashRetentionDays));
  }

  const payload = useMemo(() => {
    const defaultQuotaBytes = parseGbInput(quotaGb);
    const maxUploadBytes = parseGbInput(uploadGb);
    const trashRetentionDays = parseDaysInput(trashDays);
    return {
      instanceName,
      registrationEnabled,
      publicSharingEnabled,
      teamsEnabled,
      favoritesEnabled,
      tagsEnabled,
      archiveEnabled,
      defaultQuotaBytes,
      maxUploadBytes,
      trashRetentionDays,
    };
  }, [
    archiveEnabled,
    favoritesEnabled,
    instanceName,
    publicSharingEnabled,
    quotaGb,
    registrationEnabled,
    tagsEnabled,
    teamsEnabled,
    trashDays,
    uploadGb,
  ]);

  async function handleSave() {
    if (
      payload.defaultQuotaBytes === null ||
      payload.maxUploadBytes === null ||
      payload.trashRetentionDays === null
    ) {
      toasts.add({ title: tToasts("genericError"), description: tToasts("invalidSettings") });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toasts.add({
          title: tToasts("genericError"),
          description: data.error ?? tToasts("saveSettingsError"),
        });
        return;
      }
      const saved = data.settings as InstanceSettings;
      applySettings(saved);
      setFeatures({
        publicSharingEnabled: saved.publicSharingEnabled,
        teamsEnabled: saved.teamsEnabled,
        favoritesEnabled: saved.favoritesEnabled,
        tagsEnabled: saved.tagsEnabled,
        archiveEnabled: saved.archiveEnabled,
      });
      toasts.add({ title: tToasts("settingsSavedTitle"), description: tToasts("settingsSavedDescription") });
    } catch {
      toasts.add({ title: tToasts("genericError"), description: tToasts("saveSettingsError") });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-1.5">
          <Text as="h2" variant="heading3">
            {t("serverTitle")}
          </Text>
          <Text variant="secondary">{t("serverDescription")}</Text>
        </div>
        <SettingsList>
          <SettingsItem label={t("instanceName")} description={t("instanceNameDescription")}>
            <div className="h-8 w-48 animate-pulse rounded-md bg-kumo-tint" />
          </SettingsItem>
        </SettingsList>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <Text as="h2" variant="heading3">
            {t("serverTitle")}
          </Text>
          <Text variant="secondary">{t("serverDescription")}</Text>
        </div>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? (
            <span className="flex items-center gap-1.5">
              <Loader size="sm" /> {t("saving")}
            </span>
          ) : (
            t("save")
          )}
        </Button>
      </div>

      <SettingsList>
        <SettingsItem label={t("instanceName")} description={t("instanceNameDescription")}>
          <Input
            size="sm"
            className="w-56"
            value={instanceName}
            onChange={(event) => setInstanceName(event.target.value)}
            aria-label={t("instanceName")}
          />
        </SettingsItem>
        <SettingsItem label={t("registration")} description={t("registrationDescription")}>
          <Switch
            checked={registrationEnabled}
            onCheckedChange={(checked) => setRegistrationEnabled(checked === true)}
            aria-label={t("registration")}
          />
        </SettingsItem>
        <SettingsItem label={t("quota")} description={t("quotaDescription")}>
          <InputGroup className="w-40">
            <InputGroup.Input
              type="number"
              min={0.1}
              step={0.1}
              value={quotaGb}
              onChange={(event) => setQuotaGb(event.target.value)}
              aria-label={t("quota")}
            />
            <InputGroup.Suffix>{t("unitGb")}</InputGroup.Suffix>
          </InputGroup>
        </SettingsItem>
        <SettingsItem label={t("maxUpload")} description={t("maxUploadDescription")}>
          <InputGroup className="w-40">
            <InputGroup.Input
              type="number"
              min={0.1}
              step={0.1}
              value={uploadGb}
              onChange={(event) => setUploadGb(event.target.value)}
              aria-label={t("maxUpload")}
            />
            <InputGroup.Suffix>{t("unitGb")}</InputGroup.Suffix>
          </InputGroup>
        </SettingsItem>
        <SettingsItem label={t("trashRetention")} description={t("trashRetentionDescription")}>
          <InputGroup className="w-40">
            <InputGroup.Input
              type="number"
              min={1}
              max={365}
              step={1}
              value={trashDays}
              onChange={(event) => setTrashDays(event.target.value)}
              aria-label={t("trashRetention")}
            />
            <InputGroup.Suffix>{t("unitDays")}</InputGroup.Suffix>
          </InputGroup>
        </SettingsItem>
        <SettingsItem label={t("githubLogin")} description={t("oauthDescription")}>
          <Badge variant={social.githubConfigured ? "success" : "neutral"}>
            {social.githubConfigured ? t("configured") : t("notConfigured")}
          </Badge>
        </SettingsItem>
        <SettingsItem label={t("googleLogin")} description={t("oauthDescription")}>
          <Badge variant={social.googleConfigured ? "success" : "neutral"}>
            {social.googleConfigured ? t("configured") : t("notConfigured")}
          </Badge>
        </SettingsItem>
      </SettingsList>

      <div className="grid gap-1.5">
        <Text as="h2" variant="heading3">
          {t("featuresTitle")}
        </Text>
        <Text variant="secondary">{t("featuresDescription")}</Text>
      </div>

      <SettingsList>
        <SettingsItem label={t("publicSharing")} description={t("publicSharingDescription")}>
          <Switch
            checked={publicSharingEnabled}
            onCheckedChange={(checked) => setPublicSharingEnabled(checked === true)}
            aria-label={t("publicSharing")}
          />
        </SettingsItem>
        <SettingsItem label={t("teams")} description={t("teamsDescription")}>
          <Switch checked={teamsEnabled} onCheckedChange={(checked) => setTeamsEnabled(checked === true)} aria-label={t("teams")} />
        </SettingsItem>
        <SettingsItem label={t("favorites")} description={t("favoritesDescription")}>
          <Switch
            checked={favoritesEnabled}
            onCheckedChange={(checked) => setFavoritesEnabled(checked === true)}
            aria-label={t("favorites")}
          />
        </SettingsItem>
        <SettingsItem label={t("tags")} description={t("tagsDescription")}>
          <Switch checked={tagsEnabled} onCheckedChange={(checked) => setTagsEnabled(checked === true)} aria-label={t("tags")} />
        </SettingsItem>
        <SettingsItem label={t("archive")} description={t("archiveDescription")}>
          <Switch checked={archiveEnabled} onCheckedChange={(checked) => setArchiveEnabled(checked === true)} aria-label={t("archive")} />
        </SettingsItem>
      </SettingsList>
    </div>
  );
}
