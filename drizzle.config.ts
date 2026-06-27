import { defineConfig } from "drizzle-kit";

// drizzle-kit does not auto-load .env; use Node's built-in loader (Node >= 20.12).
process.loadEnvFile();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
  schemaFilter: process.env.DATABASE_SCHEMA!,
});
