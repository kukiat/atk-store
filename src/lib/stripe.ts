import "server-only";

import Stripe from "stripe";

export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigError";
  }
}

type StripeRuntimeConfig = {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  livemode: boolean;
};

let stripeClient: Stripe | null = null;
let stripeConfig: StripeRuntimeConfig | null = null;

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new StripeConfigError(`Missing required env var: ${name}`);
  return value;
}

function detectMode(key: string, name: string): boolean {
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return true;
  if (key.startsWith("pk_live_")) return true;
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return false;
  if (key.startsWith("pk_test_")) return false;
  throw new StripeConfigError(`${name} must be a Stripe test or live key`);
}

export function getStripeConfig(): StripeRuntimeConfig {
  if (stripeConfig) return stripeConfig;

  const secretKey = readRequiredEnv("STRIPE_SECRET_KEY");
  const publishableKey = readRequiredEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const webhookSecret = readRequiredEnv("STRIPE_WEBHOOK_SECRET");

  const secretLivemode = detectMode(secretKey, "STRIPE_SECRET_KEY");
  const publishableLivemode = detectMode(
    publishableKey,
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  );

  if (secretLivemode !== publishableLivemode) {
    throw new StripeConfigError(
      "Stripe publishable key and secret key must both be test or both be live",
    );
  }

  if (!webhookSecret.startsWith("whsec_")) {
    throw new StripeConfigError("STRIPE_WEBHOOK_SECRET must start with whsec_");
  }

  stripeConfig = {
    secretKey,
    publishableKey,
    webhookSecret,
    livemode: secretLivemode,
  };
  return stripeConfig;
}

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;

  const config = getStripeConfig();
  stripeClient = new Stripe(config.secretKey, {
    typescript: true,
  });
  return stripeClient;
}

export function getAppOrigin(): string {
  const authUrl = process.env.AUTH_URL?.trim() || "http://localhost:3000";

  try {
    return new URL(authUrl).origin;
  } catch {
    throw new StripeConfigError("AUTH_URL must be a valid absolute URL");
  }
}
