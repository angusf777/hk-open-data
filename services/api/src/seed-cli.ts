import { Pool } from "pg";

import { buildSeedData } from "./seed-data.js";
import { seedDatabase } from "./seed.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: databaseUrl });
try {
  await seedDatabase(pool, buildSeedData(new Date().toISOString()));
} finally {
  await pool.end();
}
