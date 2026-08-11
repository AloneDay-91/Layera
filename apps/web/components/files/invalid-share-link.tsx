import Link from "next/link";
import { Button, LayerCard, Text } from "@cloudflare/kumo";
import { LinkBreakIcon } from "@phosphor-icons/react/dist/ssr";

export function InvalidShareLink() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-kumo-base p-6 text-kumo-default">
      <LayerCard className="w-full max-w-md px-8 py-7 flex flex-col items-center text-center gap-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-kumo-tint text-kumo-danger">
          <LinkBreakIcon size={36} />
        </div>

        <div>
          <Text as="h1" variant="heading2">
            Ce lien n&apos;est plus valide
          </Text>
          <Text variant="secondary" DANGEROUS_className="mt-1">
            Il a peut-être expiré, été révoqué par son propriétaire, ou l&apos;élément partagé a été supprimé.
          </Text>
        </div>

        <Link href="/" className="w-full">
          <Button variant="secondary" size="base" className="w-full">
            Retour à l&apos;accueil
          </Button>
        </Link>
      </LayerCard>
    </div>
  );
}
