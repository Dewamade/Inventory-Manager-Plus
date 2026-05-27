import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, usersTable, materialsTable, scanInTable, scanItemsTable, scanOutTable } from "@workspace/db";
import { parseToken } from "../lib/auth";

const router: IRouter = Router();

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function requireMaster(req: any, res: any): boolean {
  const auth = req.headers.authorization as string | undefined;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const parsed = parseToken(auth.slice(7));
  if (!parsed) {
    res.status(401).json({ error: "Invalid token" });
    return false;
  }
  return true;
}

router.get("/backup", async (req, res): Promise<void> => {
  if (!requireMaster(req, res)) return;

  try {
    const [users, materials, scanIns, scanItems, scanOuts] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(materialsTable),
      db.select().from(scanInTable),
      db.select().from(scanItemsTable),
      db.select().from(scanOutTable),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: 1,
      data: { users, materials, scanIns, scanItems, scanOuts },
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="backup_${Date.now()}.json"`);
    res.json(backup);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Backup failed" });
  }
});

router.post("/restore", async (req, res): Promise<void> => {
  if (!requireMaster(req, res)) return;

  try {
    const { data } = req.body;
    if (!data) {
      res.status(400).json({ error: "Invalid backup file: missing data field" });
      return;
    }

    const { users = [], materials = [], scanIns = [], scanItems = [], scanOuts = [] } = data;

    await db.delete(scanItemsTable);
    await db.delete(scanOutTable);
    await db.delete(scanInTable);
    await db.delete(materialsTable);
    await db.delete(usersTable);

    let insertedUsers = 0;
    let insertedMaterials = 0;
    let insertedScanIns = 0;
    let insertedScanItems = 0;
    let insertedScanOuts = 0;

    if (users.length > 0) {
      const rows = users.map((u: any) => ({ ...u, createdAt: toDate(u.createdAt) }));
      await db.insert(usersTable).values(rows);
      insertedUsers = rows.length;
    }

    if (materials.length > 0) {
      const rows = materials.map((m: any) => ({ ...m, createdAt: toDate(m.createdAt) }));
      await db.insert(materialsTable).values(rows);
      insertedMaterials = rows.length;
    }

    if (scanIns.length > 0) {
      const rows = scanIns.map((s: any) => ({
        ...s,
        createdAt: toDate(s.createdAt),
        completedAt: toDate(s.completedAt),
      }));
      await db.insert(scanInTable).values(rows);
      insertedScanIns = rows.length;
    }

    if (scanItems.length > 0) {
      const rows = scanItems.map((i: any) => ({ ...i, createdAt: toDate(i.createdAt) }));
      await db.insert(scanItemsTable).values(rows);
      insertedScanItems = rows.length;
    }

    if (scanOuts.length > 0) {
      const rows = scanOuts.map((o: any) => ({ ...o, createdAt: toDate(o.createdAt) }));
      await db.insert(scanOutTable).values(rows);
      insertedScanOuts = rows.length;
    }

    await db.execute(sql`SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false)`);
    await db.execute(sql`SELECT setval('materials_id_seq', COALESCE((SELECT MAX(id) FROM materials), 0) + 1, false)`);
    await db.execute(sql`SELECT setval('scan_in_id_seq', COALESCE((SELECT MAX(id) FROM scan_in), 0) + 1, false)`);
    await db.execute(sql`SELECT setval('scan_items_id_seq', COALESCE((SELECT MAX(id) FROM scan_items), 0) + 1, false)`);
    await db.execute(sql`SELECT setval('scan_out_id_seq', COALESCE((SELECT MAX(id) FROM scan_out), 0) + 1, false)`);

    res.json({
      success: true,
      restored: {
        users: insertedUsers,
        materials: insertedMaterials,
        scanIns: insertedScanIns,
        scanItems: insertedScanItems,
        scanOuts: insertedScanOuts,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Restore failed" });
  }
});

export default router;
