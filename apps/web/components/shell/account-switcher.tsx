"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, DropdownMenu, Loader, Text, useKumoToastManager } from "@cloudflare/kumo";
import {
  UserIcon,
  GearIcon,
  SunIcon,
  MoonIcon,
  DesktopIcon,
  CheckIcon,
  BookOpenIcon,
  CommandIcon,
  PlusIcon,
  SignOutIcon,
  SparkleIcon,
  TranslateIcon,
  XIcon,
} from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { getInitials } from "@/lib/avatar";
import { SUPPORTED_LOCALES, useAppLocale } from "./locale-provider";
import { useTheme } from "./theme-provider";

const LOCALE_LABEL_KEYS = {
  en: "languageEnglish",
  fr: "languageFrench",
} as const;

type DeviceSession = {
  session: { token: string };
  user: { id: string; name: string; email: string; image?: string | null };
};

function AccountAvatar({ name, image, size = 36 }: { name: string; image?: string | null; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-kumo-info text-kumo-canvas"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}

export function AccountSwitcher() {
  const router = useRouter();
  const toasts = useKumoToastManager();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { mode, setMode } = useTheme();
  const { locale, setLocale } = useAppLocale();
  const tSettings = useTranslations("settings");

  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [switchingToken, setSwitchingToken] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  const loadDeviceSessions = useCallback(async () => {
    const { data } = await authClient.multiSession.listDeviceSessions();
    setDeviceSessions((data as DeviceSession[] | null | undefined) ?? []);
  }, []);

  useEffect(() => {
    loadDeviceSessions();
  }, [loadDeviceSessions]);

  async function handleSwitchAccount(sessionToken: string) {
    setSwitchingToken(sessionToken);
    try {
      const { error } = await authClient.multiSession.setActive({ sessionToken });
      if (error) throw new Error(error.message ?? "Erreur inconnue");
      router.refresh();
    } catch (err) {
      console.error("Switch account error:", err);
      toasts.add({ title: "Erreur", description: "Impossible de changer de compte." });
    } finally {
      setSwitchingToken(null);
    }
  }

  async function handleRemoveAccount(sessionToken: string) {
    setRevokingToken(sessionToken);
    try {
      const { error } = await authClient.multiSession.revoke({ sessionToken });
      if (error) throw new Error(error.message ?? "Erreur inconnue");
      if (sessionToken === session?.session?.token) {
        // Le compte actif a été retiré : Better Auth a promu une autre session
        // (ou aucune) côté serveur — on recharge pour resynchroniser le cookie.
        window.location.href = "/dashboard";
        return;
      }
      loadDeviceSessions();
    } catch (err) {
      console.error("Remove account error:", err);
      toasts.add({ title: "Erreur", description: "Impossible de retirer ce compte." });
    } finally {
      setRevokingToken(null);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  function notifyNotImplemented(feature: string) {
    toasts.add({
      title: "Bientôt disponible",
      description: `La fonctionnalité "${feature}" arrive très vite.`,
    });
  }

  const userName = session?.user?.name ?? "Développeur";
  const userEmail = session?.user?.email ?? "utilisateur@filecloud.io";
  const userImage = session?.user?.image ?? null;
  const activeWorkspaceLabel = activeOrg ? activeOrg.name : "Espace Personnel";

  const themeIcon = mode === "dark" ? MoonIcon : mode === "system" ? DesktopIcon : SunIcon;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>
        <Button variant="ghost" shape="circle" title={userName} aria-label={`Menu du compte, ${userName}`}>
          <span className="flex items-center gap-2">
            <AccountAvatar name={userName} image={userImage} />
          </span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {/* Header Utilisateur */}
        <DropdownMenu.Group>
          <div className="flex items-center gap-3 px-3 py-2">
            <AccountAvatar name={userName} image={userImage} size={42} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <Text as="span" bold truncate>{userName}</Text>
              <Text as="span" variant="secondary" truncate>{userEmail}</Text>
              <div className="mt-1 flex items-center gap-1 text-kumo-info">
                <SparkleIcon size={12} className="shrink-0" />
                <Text as="span" size="sm" DANGEROUS_className="text-kumo-info">
                  {activeWorkspaceLabel}
                </Text>
              </div>
            </div>
          </div>
        </DropdownMenu.Group>

        <DropdownMenu.Separator />

        {/* Section Comptes (multi-session) */}
        <DropdownMenu.Group>
          <DropdownMenu.Label>Comptes</DropdownMenu.Label>
          {deviceSessions
            .filter((ds) => ds.user.id !== session?.user?.id)
            .map((ds) => (
              <DropdownMenu.Item key={ds.session.token} onClick={() => handleSwitchAccount(ds.session.token)}>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <AccountAvatar name={ds.user.name} image={ds.user.image} size={20} />
                  <span className="flex min-w-0 flex-col">
                    <Text as="span" size="sm" truncate>{ds.user.name}</Text>
                  </span>
                </span>
                {switchingToken === ds.session.token ? (
                  <Loader size="sm" />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAccount(ds.session.token);
                    }}
                    aria-label={`Retirer ${ds.user.name}`}
                    className="border-0 bg-transparent p-1 text-kumo-subtle hover:text-kumo-danger"
                  >
                    {revokingToken === ds.session.token ? <Loader size="sm" /> : <XIcon size={14} />}
                  </button>
                )}
              </DropdownMenu.Item>
            ))}
          <DropdownMenu.LinkItem href="/login" icon={PlusIcon}>
            Ajouter un compte
          </DropdownMenu.LinkItem>
        </DropdownMenu.Group>

        <DropdownMenu.Separator />

        {/* Section Compte & Paramètres */}
        <DropdownMenu.Group>
          <DropdownMenu.Label>Compte</DropdownMenu.Label>
          <DropdownMenu.LinkItem href="/dashboard/profile" icon={UserIcon}>
            Mon profil
          </DropdownMenu.LinkItem>
          <DropdownMenu.LinkItem href="/dashboard/settings" icon={GearIcon}>
            Réglages applicatifs
          </DropdownMenu.LinkItem>
        </DropdownMenu.Group>

        <DropdownMenu.Separator />

        {/* Section Préférences (Sous-menu Kumo) */}
        <DropdownMenu.Group>
          <DropdownMenu.Label>Préférences</DropdownMenu.Label>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger icon={themeIcon}>
              Thème & Apparence
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              <DropdownMenu.Item icon={SunIcon} onClick={() => setMode("light")}>
                <span className="flex-1">Clair</span>
                {mode === "light" && <CheckIcon size={14} className="ml-2 text-kumo-info" />}
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={MoonIcon} onClick={() => setMode("dark")}>
                <span className="flex-1">Sombre</span>
                {mode === "dark" && <CheckIcon size={14} className="ml-2 text-kumo-info" />}
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={DesktopIcon} onClick={() => setMode("system")}>
                <span className="flex-1">Système</span>
                {mode === "system" && <CheckIcon size={14} className="ml-2 text-kumo-info" />}
              </DropdownMenu.Item>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger icon={TranslateIcon}>{tSettings("language")}</DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              {SUPPORTED_LOCALES.map((loc) => (
                <DropdownMenu.Item key={loc} onClick={() => setLocale(loc)}>
                  <span className="flex-1">{tSettings(LOCALE_LABEL_KEYS[loc])}</span>
                  {locale === loc && <CheckIcon size={14} className="ml-2 text-kumo-info" />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        </DropdownMenu.Group>

        <DropdownMenu.Separator />

        {/* Section Aide & Documentation */}
        <DropdownMenu.Group>
          <DropdownMenu.Label>Ressources</DropdownMenu.Label>
          <DropdownMenu.Item
            icon={BookOpenIcon}
            onClick={() => notifyNotImplemented("Documentation")}
          >
            Documentation API
          </DropdownMenu.Item>
          <DropdownMenu.Item
            icon={CommandIcon}
            onClick={() => notifyNotImplemented("Raccourcis Clavier")}
          >
            Raccourcis clavier
            <DropdownMenu.Shortcut>⌘K</DropdownMenu.Shortcut>
          </DropdownMenu.Item>
        </DropdownMenu.Group>

        <DropdownMenu.Separator />

        {/* Action Déconnexion */}
        <DropdownMenu.Item variant="danger" icon={SignOutIcon} onClick={handleSignOut}>
          Se déconnecter
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
