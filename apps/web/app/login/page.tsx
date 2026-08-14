"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, Input, LayerCard, Link, Loader, Tabs, Text, useKumoToastManager } from "@cloudflare/kumo";
import {
  GithubLogoIcon,
  GoogleLogoIcon,
  EnvelopeSimpleIcon,
  KeyIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react";
import { AppLogo } from "@/components/shell/app-logo";

export default function LoginPage() {
  const router = useRouter();
  const toasts = useKumoToastManager();

  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");

  // State for Password login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // State for OTP login
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data, error: signInError } = await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message ?? "Échec de la connexion");
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      // La redirection vers /login/two-factor est gérée par onTwoFactorRedirect
      // dans le client Better Auth ; on n'ouvre pas de session ici.
      return;
    }
    toasts.add({ title: "Connexion réussie", description: "Bienvenue sur Layera." });
    router.push("/dashboard");
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setSendingOtp(true);
    setError(null);
    const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
      email: otpEmail,
      type: "sign-in",
    });
    setSendingOtp(false);
    if (otpError) {
      setError(otpError.message ?? "Impossible d'envoyer le code OTP");
      return;
    }
    setOtpSent(true);
    toasts.add({
      title: "Code envoyé",
      description: `Un code de vérification OTP a été envoyé à ${otpEmail}.`,
    });
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: verifyError } = await authClient.signIn.emailOtp({
      email: otpEmail,
      otp: otpCode,
    });
    setSubmitting(false);
    if (verifyError) {
      setError(verifyError.message ?? "Code OTP invalide ou expiré");
      return;
    }
    toasts.add({ title: "Validation OTP réussie", description: "Connexion autorisée." });
    router.push("/dashboard");
  }

  async function handleSocialSignIn(provider: "github" | "google") {
    toasts.add({
      title: "Redirection OAuth",
      description: `Connexion avec ${provider === "github" ? "GitHub" : "Google"} en cours…`,
    });
    await authClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <LayerCard className="w-full max-w-sm px-8 py-7">
        {/* En-tête marque */}
        <div className="mb-6 flex flex-col items-center gap-1">
          <div className="flex items-center justify-center gap-2 mb-1">
            <AppLogo size={36} />
            <Text as="h1" variant="heading1" DANGEROUS_className="font-logo">
              Layera
            </Text>
          </div>
          <Text variant="secondary">Connecte-toi à tes fichiers et espaces</Text>
        </div>

        {/* Boutons de connexion Sociale */}
        <div className="flex flex-col gap-2 mb-6">
          <Button
            variant="secondary"
            size="sm"
            icon={GithubLogoIcon}
            onClick={() => handleSocialSignIn("github")}
            className="w-full justify-center"
          >
            Continuer avec GitHub
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={GoogleLogoIcon}
            onClick={() => handleSocialSignIn("google")}
            className="w-full justify-center"
          >
            Continuer avec Google
          </Button>
        </div>

        {/* Séparateur */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-kumo-line" />
          <Text as="span" variant="secondary" DANGEROUS_className="absolute bg-kumo-base px-3">
            Ou email
          </Text>
        </div>

        {/* Choix de la méthode d'authentification */}
        <div className="mb-4">
          <Tabs
            listClassName="justify-center w-full "
            variant="underline"
            size="sm"
            tabs={[
              {
                value: "password",
                label: (
                  <span className="flex items-center justify-center gap-1.5 w-full">
                    <KeyIcon size={14} /> Mot de passe
                  </span>
                ),
                className: "w-full flex items-center justify-center text-center"
              },
              {
                value: "otp",
                label: (
                  <span className="flex items-center justify-center gap-1.5 w-full">
                    <EnvelopeSimpleIcon size={14} /> Code OTP Email
                  </span>
                ),
                className: "w-full flex items-center justify-center text-center"
              },
            ]}
            value={authMethod}
            onValueChange={(val) => {
              setAuthMethod(val as "password" | "otp");
              setError(null);
            }}
          />
        </div>

        {/* Formulaire Mot de Passe */}
        {authMethod === "password" && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <Input
              size="sm"
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="toi@exemple.com"
            />

            <Input
              size="sm"
              type="password"
              label="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              error={error ?? undefined}
            />

            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={submitting}
              icon={ArrowRightIcon}
              className="mt-2 w-full justify-center"
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader size="sm" /> Connexion en cours…
                </span>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>
        )}

        {/* Formulaire Code OTP */}
        {authMethod === "otp" && (
          <>
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                <Input
                  size="sm"
                  type="email"
                  label="Adresse email"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="toi@exemple.com"
                  error={error ?? undefined}
                />
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={sendingOtp}
                  icon={EnvelopeSimpleIcon}
                  className="mt-2 w-full justify-center"
                >
                  {sendingOtp ? (
                    <span className="flex items-center gap-1.5">
                      <Loader size="sm" /> Envoi du code…
                    </span>
                  ) : (
                    "Recevoir un code par email"
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                <Text variant="secondary">
                  Code à 6 chiffres envoyé à <strong className="text-kumo-strong">{otpEmail}</strong>.
                </Text>
                <Input
                  size="sm"
                  type="text"
                  label="Code de vérification OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required
                  placeholder="123456"
                  maxLength={6}
                  error={error ?? undefined}
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-1/3 justify-center"
                  >
                    Changer
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    disabled={submitting}
                    icon={ArrowRightIcon}
                    className="w-2/3 justify-center"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-1.5">
                        <Loader size="sm" /> Vérification…
                      </span>
                    ) : (
                      "Valider le code"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}

        {/* Footer redirection vers l'inscription */}
        <div className="mt-6 text-center">
          <Text variant="secondary">
            Pas encore de compte ?{" "}
            <Link href="/register">Créer un compte</Link>
          </Text>
        </div>
      </LayerCard>
    </main>
  );
}
