import { db, client } from "./index";
import {
  evidence,
  recruiterActions,
  candidates,
  jobRoles,
  events,
} from "@/services/recruiter/schema";

async function main() {
  console.log("🗑️  Resetting database...\n");

  // Delete in cascade order (children first)
  const tables = [
    { name: "evidence", table: evidence },
    { name: "recruiterActions", table: recruiterActions },
    { name: "candidates", table: candidates },
    { name: "jobRoles", table: jobRoles },
    { name: "events", table: events },
  ] as const;

  for (const { name, table } of tables) {
    const deleted = await db.delete(table).returning();
    console.log(`  ✓ ${name}: ${deleted.length} rows deleted`);
  }

  console.log("\n🌱 Re-seeding...\n");

  // Dynamically import seed — it runs on import
  await import("./seed");
}

main().catch((err) => {
  console.error("❌ Reset failed:", err);
  client.end();
  process.exit(1);
});
