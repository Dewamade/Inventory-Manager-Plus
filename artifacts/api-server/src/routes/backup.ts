import { Router, type IRouter } from "express";
import { db, usersTable, materialsTable, scanInTable, scanItemsTable, scanOutTable } from "@workspace/db";
import { parseToken } from "../lib/auth";

const router: IRouter = Router();

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
      await db.insert(usersTable).values(users);
      insertedUsers = users.length;
    }
    if (materials.length > 0) {
      await db.insert(materialsTable).values(materials);
      insertedMaterials = materials.length;
    }
    if (scanIns.length > 0) {
      await db.insert(scanInTable).values(scanIns);
      insertedScanIns = scanIns.length;
    }
    if (scanItems.length > 0) {
      await db.insert(scanItemsTable).values(scanItems);
      insertedScanItems = scanItems.length;
    }
    if (scanOuts.length > 0) {
      await db.insert(scanOutTable).values(scanOuts);
      insertedScanOuts = scanOuts.length;
    }

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
