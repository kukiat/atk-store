import { pgSchema } from "drizzle-orm/pg-core";

const schemaName = process.env.DATABASE_SCHEMA;

if (!schemaName) {
  throw new Error("DATABASE_SCHEMA is not set");
}

export default pgSchema(schemaName);
