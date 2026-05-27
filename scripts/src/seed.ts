/**
 * Seed script — insert default users and materials if they don't exist.
 * Safe to run multiple times (uses ON CONFLICT DO NOTHING).
 *
 * Usage:
 *   DATABASE_URL=<connection_string> pnpm --filter @workspace/scripts run seed
 */

import crypto from "crypto";
import { db, pool, usersTable, materialsTable } from "@workspace/db";

function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + "gudang_salt_2024")
    .digest("hex");
}

async function seed() {
  console.log("Seeding database...\n");

  const users = [
    { username: "admin", password: "admin123", role: "master" },
    { username: "operator1", password: "user123", role: "user" },
  ];

  for (const u of users) {
    await db
      .insert(usersTable)
      .values({ username: u.username, passwordHash: hashPassword(u.password), role: u.role })
      .onConflictDoNothing({ target: usersTable.username });
    console.log(`  [user]     ${u.username}  (${u.role})`);
  }

  const materials = [
    { name: "MCB 4A",       code: "MCB4A",    description: "Miniature Circuit Breaker 4 Ampere" },
    { name: "MCB 6A",       code: "MCB6A",    description: "Miniature Circuit Breaker 6 Ampere" },
    { name: "Kabel NYM 2.5", code: "KBLNYM25", description: "Kabel NYM 3x2.5mm" },
  ];

  for (const m of materials) {
    await db
      .insert(materialsTable)
      .values(m)
      .onConflictDoNothing({ target: materialsTable.code });
    console.log(`  [material] ${m.code}  —  ${m.name}`);
  }

  console.log("\nSeeding complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
