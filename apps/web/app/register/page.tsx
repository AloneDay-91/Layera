"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, Input, LayerCard, Link, Loader, Text, useKumoToastManager } from "@cloudflare/kumo";
import {
  GithubLogoIcon,
  GoogleLogoIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import { AppLogo } from "@/components/shell/app-logo";

export default function RegisterPage() {
  const router = useRouter();
  const toasts = useKumoToastManager();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setSubmitting(true);
    const { error: signUpError } = await authClient.signUp.email({ name, email, password });
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message ?? "Échec de la création du compte");
      return;
    }

    toasts.add({
      title: "Compte créé avec succès",
      description: "Votre espace de travail personnel a été configuré.",
    });
    router.push("/dashboard");
  }

  async function handleSocialSignUp(provider: "github" | "google") {
    toasts.add({
      title: "Inscription via OAuth",
      description: `Connexion avec ${provider === "github" ? "GitHub" : "Google"}…`,
    });
    await authClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <LayerCard className="w-full max-w-sm px-8 py-7">
        {/* En-tête de marque */}
        <div className="mb-6 flex flex-col gap-1 justify-center items-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <AppLogo size={36} />
            <Text as="h1" variant="heading1" DANGEROUS_className="font-logo">
              Layera
            </Text>
          </div>
          <Text variant="secondary">Configure ton espace de travail personnel</Text>
        </div>

        {/* Inscription Sociale */}
        <div className="flex flex-col gap-2 mb-6">
          <Button
            variant="secondary"
            size="sm"
            icon={GithubLogoIcon}
            onClick={() => handleSocialSignUp("github")}
            className="w-full justify-center"
          >
            Continuer avec GitHub
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={GoogleLogoIcon}
            onClick={() => handleSocialSignUp("google")}
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

        {/* Formulaire classique */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            size="sm"
            label="Nom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Ton nom"
          />

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
            minLength={8}
            required
            autoComplete="new-password"
            placeholder="••••••••"
          />

          <Input
            size="sm"
            type="password"
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            error={error ?? undefined}
          />

          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={submitting}
            icon={UserPlusIcon}
            className="mt-2 w-full justify-center"
          >
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <Loader size="sm" /> Création…
              </span>
            ) : (
              "Créer le compte"
            )}
          </Button>
        </form>

        {/* Footer Redirection Login */}
        <div className="mt-6 text-center">
          <Text variant="secondary">
            Déjà un compte ?{" "}
            <Link href="/login">Se connecter</Link>
          </Text>
        </div>
      </LayerCard>
    </main>
  );
}
