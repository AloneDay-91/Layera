"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Surface } from "@cloudflare/kumo/components/surface";
import { Text } from "@cloudflare/kumo/components/text";
import { Link } from "@cloudflare/kumo/components/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message ?? "Échec de la connexion");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Surface className="w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col gap-1">
          <Text variant="heading-1">Connexion</Text>
          <Text variant="secondary">
            Accède à tes fichiers et espaces de travail
          </Text>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="toi@exemple.com"
          />

          <Input
            type="password"
            label="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            error={error ?? undefined}
          />

          <Button variant="primary" type="submit" disabled={submitting} className="mt-2 w-full">
            {submitting ? "Connexion…" : "Se connecter"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Text variant="secondary">
            Pas encore de compte ?{" "}
            <Link href="/register">Créer un compte</Link>
          </Text>
        </div>
      </Surface>
    </main>
  );
}
