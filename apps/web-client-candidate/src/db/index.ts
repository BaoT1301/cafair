import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

config({ path: ".env" });

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL in environment");
}

export const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });