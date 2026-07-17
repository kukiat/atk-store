import net from "node:net";
import tls from "node:tls";

type RedisHealthConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  useTls: boolean;
  rejectUnauthorized: boolean;
};

function getRedisHealthConfig(): RedisHealthConfig {
  return {
    host: process.env.REDIS_HOST?.trim() || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || "6379"),
    username: process.env.REDIS_USERNAME?.trim() || undefined,
    password: process.env.REDIS_PASSWORD?.trim() || undefined,
    database: process.env.REDIS_DB?.trim(),
    useTls: process.env.REDIS_TLS === "true",
    rejectUnauthorized:
      process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false",
  };
}

function encodeRedisCommand(parts: string[]): string {
  return [
    `*${parts.length}`,
    ...parts.flatMap((part) => [`$${Buffer.byteLength(part)}`, part]),
    "",
  ].join("\r\n");
}

function buildHealthCommands(config: RedisHealthConfig): string[][] {
  const commands: string[][] = [];

  if (config.password) {
    commands.push(
      config.username
        ? ["AUTH", config.username, config.password]
        : ["AUTH", config.password],
    );
  }
  if (config.database && config.database !== "0") {
    commands.push(["SELECT", config.database]);
  }
  commands.push(["PING"]);

  return commands;
}

async function pingRedis(config: RedisHealthConfig): Promise<void> {
  const client = config.useTls
    ? tls.connect({
        host: config.host,
        port: config.port,
        servername: config.host,
        rejectUnauthorized: config.rejectUnauthorized,
      })
    : net.createConnection({ host: config.host, port: config.port });
  const commands = buildHealthCommands(config);

  client.setTimeout(1_200);

  return new Promise((resolve, reject) => {
    let buffer = "";

    client.on("connect", () => {
      client.write(commands.map(encodeRedisCommand).join(""));
    });
    client.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (buffer.includes("+PONG")) client.end();
      if (buffer.includes("-")) client.destroy(new Error(buffer.trim()));
    });
    client.on("timeout", () => {
      client.destroy(new Error("Redis health check timed out"));
    });
    client.on("error", reject);
    client.on("close", () => {
      if (buffer.includes("+PONG")) {
        resolve();
      } else {
        reject(new Error(buffer.trim() || "Redis closed before PING response"));
      }
    });
  });
}

export async function checkRedisHealthOnStartup(): Promise<void> {
  const config = getRedisHealthConfig();
  const target = `${config.host}:${config.port}`;

  try {
    await pingRedis(config);
    console.log(`✅ Redis OK (${target})`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`❌ Redis Failed (${target})`, reason);
  }
}
