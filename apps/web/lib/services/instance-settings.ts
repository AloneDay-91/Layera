import { db, instanceSettings, INSTANCE_SETTINGS_ID, user, eq, sql } from "@filecloud/db";
import { getAppVersion } from "@/lib/app-version";
import { ServiceError } from "./errors";
import { getSocialProvidersPublic, invalidateSocialProviderCache } from "./social-providers";

const GIB = 1024 ** 3;
const MIN_QUOTA_BYTES = Math.round(0.1 * GIB);
const MAX_QUOTA_BYTES = 1024 * GIB;
const MIN_UPLOAD_BYTES = 1024 * 1024;
const MIN_TRASH_DAYS = 1;
const MAX_TRASH_DAYS = 365;
const CACHE_MS = 10_000;

export const DEFAULT_INSTANCE_NAME = "Layera";

export const DEFAULT_INSTANCE_SETTINGS: InstanceSettings = {
  instanceName: DEFAULT_INSTANCE_NAME,
  registrationEnabled: true,
  publicSharingEnabled: true,
  teamsEnabled: true,
  favoritesEnabled: true,
  tagsEnabled: true,
  archiveEnabled: true,
  defaultQuotaBytes: Number(process.env.MAX_WORKSPACE_BYTES ?? 10 * GIB),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 5 * GIB),
  trashRetentionDays: 30,
};

export type InstanceSettings = {
  instanceName: string;
  registrationEnabled: boolean;
  publicSharingEnabled: boolean;
  teamsEnabled: boolean;
  favoritesEnabled: boolean;
  tagsEnabled: boolean;
  archiveEnabled: boolean;
  defaultQuotaBytes: number;
  maxUploadBytes: number;
  trashRetentionDays: number;
};

export type InstanceFeature = keyof Pick<
  InstanceSettings,
  "publicSharingEnabled" | "teamsEnabled" | "favoritesEnabled" | "tagsEnabled" | "archiveEnabled"
>;

export type PublicInstanceSettings = {
  instanceName: string;
  registrationEnabled: boolean;
  version: string;
  githubEnabled: boolean;
  googleEnabled: boolean;
};

export type InstanceSettingsPatch = Partial<InstanceSettings> & {
  githubEnabled?: boolean;
  githubClientId?: string;
  githubClientSecret?: string;
  googleEnabled?: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
};

type CacheEntry = { at: number; value: InstanceSettings };

let settingsCache: CacheEntry | null = null;

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return 0;
}

function rowToSettings(row: typeof instanceSettings.$inferSelect): InstanceSettings {
  return {
    instanceName: row.instanceName.trim() || DEFAULT_INSTANCE_NAME,
    registrationEnabled: row.registrationEnabled,
    publicSharingEnabled: row.publicSharingEnabled,
    teamsEnabled: row.teamsEnabled,
    favoritesEnabled: row.favoritesEnabled,
    tagsEnabled: row.tagsEnabled,
    archiveEnabled: row.archiveEnabled,
    defaultQuotaBytes: asNumber(row.defaultQuotaBytes),
    maxUploadBytes: asNumber(row.maxUploadBytes),
    trashRetentionDays: row.trashRetentionDays,
  };
}

export function invalidateInstanceSettingsCache() {
  settingsCache = null;
}

export async function getInstanceSettings(): Promise<InstanceSettings> {
  const now = Date.now();
  if (settingsCache && now - settingsCache.at < CACHE_MS) {
    return settingsCache.value;
  }

  try {
    const [row] = await db
      .select()
      .from(instanceSettings)
      .where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID))
      .limit(1);

    const value = row ? rowToSettings(row) : DEFAULT_INSTANCE_SETTINGS;
    settingsCache = { at: now, value };
    return value;
  } catch (error) {
    console.error("[instance-settings] Failed to load settings, using defaults:", error);
    // Fail closed on the one default that grants access: a transient read
    // error must not reopen sign-ups on an instance that closed them. The
    // first-user bootstrap in assertRegistrationAllowed still works.
    return { ...DEFAULT_INSTANCE_SETTINGS, registrationEnabled: false };
  }
}

export async function getPublicInstanceSettings(): Promise<PublicInstanceSettings> {
  const [settings, social] = await Promise.all([getInstanceSettings(), getSocialProvidersPublic()]);
  return {
    instanceName: settings.instanceName,
    registrationEnabled: settings.registrationEnabled,
    version: getAppVersion(),
    githubEnabled: social.github.enabled,
    googleEnabled: social.google.enabled,
  };
}

export async function getQuotaLimits() {
  const settings = await getInstanceSettings();
  return {
    maxUploadBytes: settings.maxUploadBytes,
    quotaBytes: settings.defaultQuotaBytes,
  };
}

export async function getTrashRetentionDays() {
  const settings = await getInstanceSettings();
  return settings.trashRetentionDays;
}

export async function assertFeatureEnabled(feature: InstanceFeature) {
  const settings = await getInstanceSettings();
  if (!settings[feature]) {
    throw new ServiceError(403, "This feature is disabled");
  }
}

export async function assertRegistrationAllowed() {
  const settings = await getInstanceSettings();
  if (settings.registrationEnabled) return;

  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(user);
    if (asNumber(row?.count) === 0) return;
  } catch (error) {
    console.error("[instance-settings] Failed to count users:", error);
  }

  throw new ServiceError(403, "Registration is disabled");
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseInstanceName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 64) {
    throw new ServiceError(400, "Instance name must be between 1 and 64 characters");
  }
  return trimmed;
}

function parseByteSize(value: unknown, fallback: number, min: number, max: number, label: string): number {
  const parsed = typeof value === "number" ? value : fallback;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ServiceError(400, `${label} is out of range`);
  }
  return Math.round(parsed);
}

function parseDays(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : fallback;
  if (!Number.isInteger(parsed) || parsed < MIN_TRASH_DAYS || parsed > MAX_TRASH_DAYS) {
    throw new ServiceError(400, "Trash retention must be between 1 and 365 days");
  }
  return parsed;
}

function parseOptionalText(value: unknown, fallback: string, { allowEmpty }: { allowEmpty: boolean }): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return allowEmpty ? "" : fallback;
  if (trimmed.length > 256) {
    throw new ServiceError(400, "OAuth credential is too long");
  }
  return trimmed;
}

export async function updateInstanceSettings(
  patch: InstanceSettingsPatch,
  actorId: string,
): Promise<InstanceSettings> {
  const current = await getInstanceSettings();
  const next: InstanceSettings = {
    instanceName: parseInstanceName(patch.instanceName, current.instanceName),
    registrationEnabled: parseBoolean(patch.registrationEnabled, current.registrationEnabled),
    publicSharingEnabled: parseBoolean(patch.publicSharingEnabled, current.publicSharingEnabled),
    teamsEnabled: parseBoolean(patch.teamsEnabled, current.teamsEnabled),
    favoritesEnabled: parseBoolean(patch.favoritesEnabled, current.favoritesEnabled),
    tagsEnabled: parseBoolean(patch.tagsEnabled, current.tagsEnabled),
    archiveEnabled: parseBoolean(patch.archiveEnabled, current.archiveEnabled),
    defaultQuotaBytes: parseByteSize(
      patch.defaultQuotaBytes,
      current.defaultQuotaBytes,
      MIN_QUOTA_BYTES,
      MAX_QUOTA_BYTES,
      "Workspace quota",
    ),
    maxUploadBytes: parseByteSize(
      patch.maxUploadBytes,
      current.maxUploadBytes,
      MIN_UPLOAD_BYTES,
      MAX_QUOTA_BYTES,
      "Upload size",
    ),
    trashRetentionDays: parseDays(patch.trashRetentionDays, current.trashRetentionDays),
  };

  if (next.maxUploadBytes > next.defaultQuotaBytes) {
    throw new ServiceError(400, "Max upload size cannot exceed the workspace quota");
  }

  const [stored] = await db
    .select({
      githubEnabled: instanceSettings.githubEnabled,
      githubClientId: instanceSettings.githubClientId,
      githubClientSecret: instanceSettings.githubClientSecret,
      googleEnabled: instanceSettings.googleEnabled,
      googleClientId: instanceSettings.googleClientId,
      googleClientSecret: instanceSettings.googleClientSecret,
    })
    .from(instanceSettings)
    .where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID))
    .limit(1);

  const githubClientId = parseOptionalText(patch.githubClientId, stored?.githubClientId ?? "", { allowEmpty: true });
  const googleClientId = parseOptionalText(patch.googleClientId, stored?.googleClientId ?? "", { allowEmpty: true });
  const githubClientSecret = parseOptionalText(patch.githubClientSecret, stored?.githubClientSecret ?? "", {
    allowEmpty: false,
  });
  const googleClientSecret = parseOptionalText(patch.googleClientSecret, stored?.googleClientSecret ?? "", {
    allowEmpty: false,
  });
  const githubReady = Boolean(
    (githubClientId && githubClientSecret) || (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  );
  const googleReady = Boolean(
    (googleClientId && googleClientSecret) || (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  );
  if (patch.githubEnabled === true && !githubReady) {
    throw new ServiceError(400, "GitHub sign-in needs a client ID and secret");
  }
  if (patch.googleEnabled === true && !googleReady) {
    throw new ServiceError(400, "Google sign-in needs a client ID and secret");
  }
  const githubEnabled = githubReady && parseBoolean(patch.githubEnabled, stored?.githubEnabled ?? true);
  const googleEnabled = googleReady && parseBoolean(patch.googleEnabled, stored?.googleEnabled ?? true);

  const values = {
    id: INSTANCE_SETTINGS_ID,
    instanceName: next.instanceName,
    registrationEnabled: next.registrationEnabled,
    publicSharingEnabled: next.publicSharingEnabled,
    teamsEnabled: next.teamsEnabled,
    favoritesEnabled: next.favoritesEnabled,
    tagsEnabled: next.tagsEnabled,
    archiveEnabled: next.archiveEnabled,
    defaultQuotaBytes: next.defaultQuotaBytes,
    maxUploadBytes: next.maxUploadBytes,
    trashRetentionDays: next.trashRetentionDays,
    githubEnabled,
    githubClientId: githubClientId || null,
    githubClientSecret: githubClientSecret || null,
    googleEnabled,
    googleClientId: googleClientId || null,
    googleClientSecret: googleClientSecret || null,
    updatedAt: new Date(),
    updatedBy: actorId,
  };

  await db
    .insert(instanceSettings)
    .values(values)
    .onConflictDoUpdate({
      target: instanceSettings.id,
      set: {
        instanceName: values.instanceName,
        registrationEnabled: values.registrationEnabled,
        publicSharingEnabled: values.publicSharingEnabled,
        teamsEnabled: values.teamsEnabled,
        favoritesEnabled: values.favoritesEnabled,
        tagsEnabled: values.tagsEnabled,
        archiveEnabled: values.archiveEnabled,
        defaultQuotaBytes: values.defaultQuotaBytes,
        maxUploadBytes: values.maxUploadBytes,
        trashRetentionDays: values.trashRetentionDays,
        githubEnabled: values.githubEnabled,
        githubClientId: values.githubClientId,
        githubClientSecret: values.githubClientSecret,
        googleEnabled: values.googleEnabled,
        googleClientId: values.googleClientId,
        googleClientSecret: values.googleClientSecret,
        updatedAt: values.updatedAt,
        updatedBy: values.updatedBy,
      },
    });

  invalidateInstanceSettingsCache();
  invalidateSocialProviderCache();
  return next;
}
