import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { argv, env, stdin, stdout } from "node:process";

const REGISTRY = "armdocker123";
const DEFAULT_ENV_FILE = ".env";
const PUBLIC_BUILD_ARG_NAMES = [
  "NEXT_PUBLIC_AWS_LIVENESS_REGION",
  "NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
] as const;

type ImageBuild = {
  name: string;
  tag: string;
  dockerfile?: string;
  buildArgs?: Record<string, string>;
};

type CliOptions = {
  appTag?: string;
  mqttTag?: string;
  envFile: string;
};

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

function readEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};

  const values: Record<string, string> = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separator = normalized.indexOf("=");
    if (separator <= 0) continue;

    const key = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function getPublicBuildArgs(envFile: string): Record<string, string> {
  const fileValues = readEnvFile(envFile);
  const buildArgs: Record<string, string> = {};

  for (const name of PUBLIC_BUILD_ARG_NAMES) {
    const value = env[name] ?? fileValues[name];
    if (value) buildArgs[name] = value;
  }

  return buildArgs;
}

function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = { envFile: DEFAULT_ENV_FILE };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const [flag, inlineValue] = arg.split("=", 2);
    const nextValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${flag} requires a value`);
      }
      index += 1;
      return value;
    };

    if (flag === "--app-tag") {
      options.appTag = nextValue().trim();
      continue;
    }
    if (flag === "--mqtt-tag") {
      options.mqttTag = nextValue().trim();
      continue;
    }
    if (flag === "--env-file") {
      options.envFile = nextValue().trim();
      continue;
    }
    if (flag === "--help" || flag === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  npm run docker:images
  npm run docker:images -- --app-tag v1.0.20 --env-file .env.prod
  npm run docker:images -- --app-tag v1.0.20 --mqtt-tag v1.0.20

Only NEXT_PUBLIC_* values are forwarded as Docker build args.`);
}

async function buildAndPush(input: ImageBuild) {
  const image = `${REGISTRY}/${input.name}:${input.tag}`;
  const dockerBuildArgs = Object.entries(input.buildArgs ?? {}).flatMap(
    ([key, value]) => ["--build-arg", `${key}=${value}`],
  );
  const buildArgs = [
    "buildx",
    "build",
    "--platform",
    "linux/amd64",
    ...(input.dockerfile ? ["-f", input.dockerfile] : []),
    ...dockerBuildArgs,
    "-t",
    image,
    ".",
  ];

  console.log(`\nBuilding ${image}`);
  if (dockerBuildArgs.length > 0) {
    console.log(
      `Forwarding public build args: ${Object.keys(input.buildArgs ?? {}).join(
        ", ",
      )}`,
    );
  }
  await run("docker", buildArgs);
  await run("docker", ["push", image]);
}

async function main() {
  const options = parseCliArgs(argv.slice(2));
  let appTag = options.appTag ?? "";
  let mqttTag = options.mqttTag ?? "";

  if (!appTag && !mqttTag) {
    const prompt = createInterface({ input: stdin, output: stdout });
    try {
      appTag = (await prompt.question("ATK app tag (Enter to skip): ")).trim();
      mqttTag = (
        await prompt.question("MQTT worker tag (Enter to skip): ")
      ).trim();
    } finally {
      prompt.close();
    }
  }

  const publicBuildArgs = getPublicBuildArgs(options.envFile);
  const images: ImageBuild[] = [
    ...(appTag
      ? [{ name: "atk-store", tag: appTag, buildArgs: publicBuildArgs }]
      : []),
    ...(mqttTag
      ? [{ name: "atk-store-mqtt", tag: mqttTag, dockerfile: "Dockerfile.mqtt" }]
      : []),
  ];

  if (images.length === 0) {
    console.log("No images selected.");
    return;
  }

  for (const image of images) {
    await buildAndPush(image);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
