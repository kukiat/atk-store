import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const REGISTRY = "armdocker123";

type ImageBuild = {
  name: string;
  tag: string;
  dockerfile?: string;
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

async function buildAndPush(input: ImageBuild) {
  const image = `${REGISTRY}/${input.name}:${input.tag}`;
  const buildArgs = [
    "buildx",
    "build",
    "--platform",
    "linux/amd64",
    ...(input.dockerfile ? ["-f", input.dockerfile] : []),
    "-t",
    image,
    ".",
  ];

  console.log(`\nBuilding ${image}`);
  await run("docker", buildArgs);
  await run("docker", ["push", image]);
}

async function main() {
  const prompt = createInterface({ input: stdin, output: stdout });
  let appTag = "";
  let mqttTag = "";

  try {
    appTag = (await prompt.question("ATK app tag (Enter to skip): ")).trim();
    mqttTag = (await prompt.question("MQTT worker tag (Enter to skip): ")).trim();
  } finally {
    prompt.close();
  }

  const images: ImageBuild[] = [
    ...(appTag ? [{ name: "atk-store", tag: appTag }] : []),
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
