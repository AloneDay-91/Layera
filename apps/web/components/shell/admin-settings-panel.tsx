"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, InputGroup, Loader, SensitiveInput, Switch, Text, useKumoToastManager } from "@cloudflare/kumo";
import { SettingsItem, SettingsList } from "@/components/shell/settings-list";
import { VersionCheck } from "@/components/shell/version-check";
import { useInstanceFeatures } from "@/components/shell/instance-features";
import type { InstanceSettings } from "@/lib/services/instance-settings";
import type { SocialProvidersPublic } from "@/lib/services/social-providers";

const GIB = 1024 ** 3;

type SettingsResponse = {
  settings: InstanceSettings;
  social: SocialProvidersPublic;
  version: string;
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
  const [version, setVersion] = useState("");
  const [callbackOrigin, setCallbackOrigin] = useState("");
  const [githubEnabled, setGithubEnabled] = useState(false);
  const [githubClientId, setGithubClientId] = useState("");
  const [githubClientSecret, setGithubClientSecret] = useState("");
  const [githubSecretSet, setGithubSecretSet] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleSecretSet, setGoogleSecretSet] = useState(false);
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
        applySocial(data.social);
        setVersion(data.version);
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

  function applySocial(social: SocialProvidersPublic) {
    setCallbackOrigin(social.callbackOrigin);
    setGithubEnabled(social.github.enabled);
    setGithubClientId(social.github.clientId);
    setGithubClientSecret("");
    setGithubSecretSet(social.github.secretSet);
    setGoogleEnabled(social.google.enabled);
    setGoogleClientId(social.google.clientId);
    setGoogleClientSecret("");
    setGoogleSecretSet(social.google.secretSet);
  }

  function callbackHint(provider: "github" | "google") {
    const path = `/api/auth/callback/${provider}`;
    return callbackOrigin ? t("callbackUrl", { url: `${callbackOrigin}${path}` }) : t("callbackPath", { path });
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
      githubEnabled,
      githubClientId,
      githubClientSecret,
      googleEnabled,
      googleClientId,
      googleClientSecret,
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
    githubEnabled,
    githubClientId,
    githubClientSecret,
    googleEnabled,
    googleClientId,
    googleClientSecret,
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
        body: JSON.stringify({
          ...payload,
          githubClientSecret: payload.githubClientSecret.trim() || undefined,
          googleClientSecret: payload.googleClientSecret.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toasts.add({
          title: tToasts("genericError"),
          description: data.error ?? tToasts("saveSettingsError"),
        });
        return;
      }
      const saved = data as SettingsResponse;
      applySettings(saved.settings);
      applySocial(saved.social);
      setVersion(saved.version);
      setFeatures({
        publicSharingEnabled: saved.settings.publicSharingEnabled,
        teamsEnabled: saved.settings.teamsEnabled,
        favoritesEnabled: saved.settings.favoritesEnabled,
        tagsEnabled: saved.settings.tagsEnabled,
        archiveEnabled: saved.settings.archiveEnabled,
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
        <SettingsItem label={t("appVersion")} description={t("appVersionDescription")}>
          <VersionCheck version={version} />
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

      <div className="grid gap-1.5">
        <Text as="h2" variant="heading3">
          {t("oauthTitle")}
        </Text>
        <Text variant="secondary">{t("oauthDescription")}</Text>
      </div>

      <SettingsList>
        <SettingsItem label={t("githubLogin")} description={t("githubLoginDescription")}>
          <Switch
            checked={githubEnabled}
            onCheckedChange={(checked) => setGithubEnabled(checked === true)}
            aria-label={t("githubLogin")}
          />
        </SettingsItem>
        <SettingsItem label={t("githubClientId")} description={callbackHint("github")}>
          <Input
            size="sm"
            className="w-56"
            value={githubClientId}
            onChange={(event) => setGithubClientId(event.target.value)}
            autoComplete="off"
            aria-label={t("githubClientId")}
          />
        </SettingsItem>
        <SettingsItem
          label={t("githubClientSecret")}
          description={githubSecretSet ? t("secretKept") : t("secretRequired")}
        >
          <SensitiveInput
            size="sm"
            className="w-56"
            value={githubClientSecret}
            onValueChange={setGithubClientSecret}
            autoComplete="new-password"
            aria-label={t("githubClientSecret")}
          />
        </SettingsItem>
        <SettingsItem label={t("googleLogin")} description={t("googleLoginDescription")}>
          <Switch
            checked={googleEnabled}
            onCheckedChange={(checked) => setGoogleEnabled(checked === true)}
            aria-label={t("googleLogin")}
          />
        </SettingsItem>
        <SettingsItem label={t("googleClientId")} description={callbackHint("google")}>
          <Input
            size="sm"
            className="w-56"
            value={googleClientId}
            onChange={(event) => setGoogleClientId(event.target.value)}
            autoComplete="off"
            aria-label={t("googleClientId")}
          />
        </SettingsItem>
        <SettingsItem
          label={t("googleClientSecret")}
          description={googleSecretSet ? t("secretKept") : t("secretRequired")}
        >
          <SensitiveInput
            size="sm"
            className="w-56"
            value={googleClientSecret}
            onValueChange={setGoogleClientSecret}
            autoComplete="new-password"
            aria-label={t("googleClientSecret")}
          />
        </SettingsItem>
      </SettingsList>
    </div>
  );
}
