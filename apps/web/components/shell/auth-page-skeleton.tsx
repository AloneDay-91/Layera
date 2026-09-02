export function AuthPageSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-kumo-line bg-kumo-base px-8 py-7">
        <div className="mx-auto h-9 w-32 rounded bg-kumo-fill" />
        <div className="mx-auto h-4 w-48 rounded bg-kumo-fill" />
        <div className="mt-2 h-8 w-full rounded bg-kumo-fill" />
        <div className="h-8 w-full rounded bg-kumo-fill" />
        <div className="mt-2 h-16 w-full rounded bg-kumo-fill" />
        <div className="h-16 w-full rounded bg-kumo-fill" />
        <div className="mt-2 h-8 w-full rounded bg-kumo-fill" />
      </div>
    </main>
  );
}
