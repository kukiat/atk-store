import { pgSchema } from "drizzle-orm/pg-core";

const schemaName = process.env.DATABASE_SCHEMA || "auth";

console.log("schemaName", schemaName);

if (!schemaName) {
  throw new Error("DATABASE_SCHEMA is not set");
}

export default pgSchema(schemaName);
