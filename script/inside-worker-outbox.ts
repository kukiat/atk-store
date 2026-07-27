import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile();
}

const intervalMs = Number(process.env.INSIDE_WORKER_OUTBOX_INTERVAL_MS ?? 2000);
if (!Number.isFinite(intervalMs) || intervalMs < 250) {
  throw new Error("INSIDE_WORKER_OUTBOX_INTERVAL_MS must be at least 250");
}

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

async function main() {
  const { insideWorkerOutboxService } = await import(
    "@/services/inside-worker-outbox.service"
  );
  while (!stopping) {
    try {
      await insideWorkerOutboxService.drain();
    } catch (error) {
      console.error("[inside-worker-outbox] drain failed", error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().catch((error) => {
  console.error("[inside-worker-outbox] fatal error", error);
  process.exitCode = 1;
});
