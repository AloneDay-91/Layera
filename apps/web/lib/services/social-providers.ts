import { db, instanceSettings, INSTANCE_SETTINGS_ID, eq } from "@filecloud/db";

export type SocialProviderId = "github" | "google";

export type ResolvedSocialProvider = {
  enabled: boolean;
  configured: boolean;
  clientId: string;
  clientSecret: string;
  secretSet: boolean;
};

export type SocialProviderPublic = {
  enabled: boolean;
  configured: boolean;
  clientId: string;
  secretSet: boolean;
};

export type SocialProvidersPublic = {
  github: SocialProviderPublic;
  google: SocialProviderPublic;
  callbackOrigin: string;
};

type StoredSocial = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
};

type EnvSocial = {
  clientId: string;
  clientSecret: string;
};

const EMPTY_STORED: StoredSocial = { enabled: true, clientId: "", clientSecret: "" };

let socialCache: { github: ResolvedSocialProvider; google: ResolvedSocialProvider } | null = null;

export function envSocial(id: SocialProviderId): EnvSocial {
  if (id === "github") {
    return {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    };
  }
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  };
}

export function resolveSocialProvider(stored: StoredSocial, env: EnvSocial): ResolvedSocialProvider {
  const dbId = stored.clientId.trim();
  const dbSecret = stored.clientSecret.trim();
  const envId = env.clientId.trim();
  const envSecret = env.clientSecret.trim();
  const clientId = dbId || envId;
  const clientSecret = dbSecret || envSecret;
  const configured = Boolean(clientId && clientSecret);
  return {
    enabled: configured && stored.enabled,
    configured,
    clientId,
    clientSecret,
    secretSet: Boolean(dbSecret || envSecret),
  };
}

function toPublic(resolved: ResolvedSocialProvider): SocialProviderPublic {
  return {
    enabled: resolved.enabled,
    configured: resolved.configured,
    clientId: resolved.clientId,
    secretSet: resolved.secretSet,
  };
}

export function callbackOrigin() {
  return (process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "").replace(/\/$/, "");
}

export function peekSocialProvider(id: SocialProviderId): ResolvedSocialProvider {
  return socialCache?.[id] ?? resolveSocialProvider(EMPTY_STORED, envSocial(id));
}

export function invalidateSocialProviderCache() {
  socialCache = null;
}

async function loadStoredSocial(): Promise<{ github: StoredSocial; google: StoredSocial }> {
  try {
    const [row] = await db
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

    if (!row) {
      return { github: EMPTY_STORED, google: EMPTY_STORED };
    }

    return {
      github: {
        enabled: row.githubEnabled,
        clientId: row.githubClientId ?? "",
        clientSecret: row.githubClientSecret ?? "",
      },
      google: {
        enabled: row.googleEnabled,
        clientId: row.googleClientId ?? "",
        clientSecret: row.googleClientSecret ?? "",
      },
    };
  } catch (error) {
    console.error("[social-providers] Failed to load OAuth settings:", error);
    return { github: EMPTY_STORED, google: EMPTY_STORED };
  }
}

export async function warmSocialProviderCache() {
  const stored = await loadStoredSocial();
  socialCache = {
    github: resolveSocialProvider(stored.github, envSocial("github")),
    google: resolveSocialProvider(stored.google, envSocial("google")),
  };
  return socialCache;
}

export async function getSocialProvidersPublic(): Promise<SocialProvidersPublic> {
  const resolved = await warmSocialProviderCache();
  return {
    github: toPublic(resolved.github),
    google: toPublic(resolved.google),
    callbackOrigin: callbackOrigin(),
  };
}

export async function assertSocialSignInAllowed(provider: SocialProviderId) {
  const resolved = await warmSocialProviderCache();
  if (!resolved[provider].enabled) {
    const error = new Error("This sign-in method is disabled");
    error.name = "SocialDisabledError";
    throw error;
  }
}

export function isSocialProviderId(value: string | null | undefined): value is SocialProviderId {
  return value === "github" || value === "google";
}
