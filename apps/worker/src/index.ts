import { enqueueJob, claimPendingJobs, completeJob, failJob } from "./queue";
import { generateThumbnail } from "./thumbnail";
import { abortExpiredUploads, purgeExpiredTrash } from "./maintenance";
import type { JobType } from "@filecloud/db";

const TICK_MS = 5_000;
const MAINTENANCE_MS = 60_000;

async function processJob(type: JobType, payload: Record<string, unknown>) {
  switch (type) {
    case "thumbnail": {
      const fileId = typeof payload.fileId === "string" ? payload.fileId : null;
      if (!fileId) throw new Error("thumbnail job missing fileId");
      await generateThumbnail(fileId);
      return;
    }
    case "purge-trash":
      await purgeExpiredTrash();
      return;
    case "abort-uploads":
      await abortExpiredUploads();
      return;
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown job type: ${String(_exhaustive)}`);
    }
  }
}

async function tick() {
  const claimed = await claimPendingJobs();
  for (const row of claimed) {
    try {
      await processJob(row.type, row.payload);
      await completeJob(row.id);
    } catch (error) {
      console.error("[worker] job failed", row.type, row.id, error);
      await failJob(row.id, row.attempts, error);
    }
  }
}

async function scheduleMaintenance() {
  await enqueueJob("purge-trash");
  await enqueueJob("abort-uploads");
}

async function main() {
  console.log("[worker] started");
  await scheduleMaintenance();
  await tick();
  setInterval(() => {
    void tick();
  }, TICK_MS);
  setInterval(() => {
    void scheduleMaintenance();
  }, MAINTENANCE_MS);
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
