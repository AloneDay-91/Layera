import { LayerCard } from "@cloudflare/kumo";

export function AuthPageSkeleton() {
  return (
    <main className="h-full lg:grid lg:grid-cols-2">
      <aside className="hidden h-full overflow-y-auto border-r border-kumo-line bg-kumo-tint px-10 lg:flex">
        <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-8 py-8">
          <div className="h-5 w-28 rounded bg-kumo-fill" />
          <div className="grid gap-1.5">
            <div className="h-8 w-72 rounded bg-kumo-fill" />
            <div className="h-5 w-full rounded bg-kumo-fill" />
          </div>
          <div className="h-48 w-full rounded-lg bg-kumo-fill" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-12 rounded bg-kumo-fill" />
            <div className="h-12 rounded bg-kumo-fill" />
            <div className="h-12 rounded bg-kumo-fill" />
          </div>
        </div>
      </aside>
      <section className="flex h-full flex-col overflow-y-auto">
        <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="grid w-full max-w-md gap-6">
          <div className="grid gap-1.5">
            <div className="h-6 w-36 rounded bg-kumo-fill" />
            <div className="h-5 w-56 rounded bg-kumo-fill" />
          </div>
          <LayerCard className="px-5 py-4">
            <div className="grid gap-5">
              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 rounded bg-kumo-fill" />
                <div className="h-8 rounded bg-kumo-fill" />
              </div>
              <div className="h-16 w-full rounded bg-kumo-fill" />
              <div className="h-16 w-full rounded bg-kumo-fill" />
              <div className="h-8 w-full rounded bg-kumo-fill" />
            </div>
          </LayerCard>
        </div>
        </div>
      </section>
    </main>
  );
}
