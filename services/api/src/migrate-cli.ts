import { Pool } from "pg";

import { applyMigrations } from "./migrations.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: databaseUrl });
try {
  await applyMigrations(pool);
} finally {
  await pool.end();
}
