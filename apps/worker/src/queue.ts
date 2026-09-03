import { db, job, eq, and, lte, inArray, type JobType } from "@filecloud/db";

const MAX_ATTEMPTS = 8;

// Sweeps are idempotent and re-scheduled on a timer, so a queued one is enough
// — without this they would pile up once per tick.
const DEDUPLICATED_TYPES: ReadonlySet<JobType> = new Set<JobType>([
  "purge-trash",
  "abort-uploads",
  "purge-rate-limits",
]);

export async function enqueueJob(type: JobType, payload: Record<string, unknown> = {}) {
  const [existing] = await db
    .select({ id: job.id })
    .from(job)
    .where(and(eq(job.type, type), inArray(job.status, ["pending", "running"])))
    .limit(1);
  if (existing && DEDUPLICATED_TYPES.has(type)) {
    return existing.id;
  }

  const [created] = await db
    .insert(job)
    .values({ type, payload, status: "pending" })
    .returning({ id: job.id });
  return created?.id ?? null;
}

export async function claimPendingJobs(limit = 5) {
  const pending = await db
    .select()
    .from(job)
    .where(and(eq(job.status, "pending"), lte(job.runAfter, new Date())))
    .orderBy(job.runAfter)
    .limit(limit);

  const claimed = [];
  for (const row of pending) {
    const [taken] = await db
      .update(job)
      .set({ status: "running", attempts: row.attempts + 1 })
      .where(and(eq(job.id, row.id), eq(job.status, "pending")))
      .returning();
    if (taken) claimed.push(taken);
  }
  return claimed;
}

export async function completeJob(id: string) {
  await db
    .update(job)
    .set({ status: "completed", completedAt: new Date(), lastError: null })
    .where(eq(job.id, id));
}

export async function failJob(id: string, attempts: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const failed = attempts >= MAX_ATTEMPTS;
  await db
    .update(job)
    .set({
      status: failed ? "failed" : "pending",
      lastError: message.slice(0, 2000),
      runAfter: new Date(Date.now() + 30_000),
    })
    .where(eq(job.id, id));
}
