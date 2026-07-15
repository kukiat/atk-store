export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { checkRedisHealthOnStartup } = await import("./lib/redis-health");
  await checkRedisHealthOnStartup();
}
