import { Router } from "express";
import type { IRouter } from "express";
import { db, scanInTable, scanOutTable, scanItemsTable, materialsTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  ListHistoryQueryParams,
  ListHistoryResponse,
  DeleteHistoryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/history", async (req, res): Promise<void> => {
  const params = ListHistoryQueryParams.safeParse(req.query);
  const filterType = params.success ? params.data.type : undefined;
  const filterMaterialId = params.success && params.data.materialId ? Number(params.data.materialId) : undefined;
  const filterUserId = params.success && params.data.userId ? Number(params.data.userId) : undefined;
  const filterFrom = params.success ? params.data.from : undefined;
  const filterTo = params.success ? params.data.to : undefined;

  const records: any[] = [];

  // Build scan-in history
  if (!filterType || filterType === "in") {
    let scanIns = await db.select().from(scanInTable).where(eq(scanInTable.status, "completed"));

    for (const si of scanIns) {
      if (filterMaterialId && si.materialId !== filterMaterialId) continue;
      if (filterUserId && si.userId !== filterUserId) continue;
      if (filterFrom && si.createdAt < new Date(filterFrom)) continue;
      if (filterTo && si.createdAt > new Date(filterTo)) continue;

      const [material] = await db.select().from(materialsTable).where(eq(materialsTable.id, si.materialId));
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, si.userId));
      const items = await db.select().from(scanItemsTable).where(eq(scanItemsTable.scanInId, si.id));

      records.push({
        id: si.id,
        type: "in",
        materialId: si.materialId,
        materialName: material?.name ?? "Unknown",
        boxLabel: si.boxLabel,
        userId: si.userId,
        userName: user?.username ?? "Unknown",
        serialNumbers: items.map((i) => i.serialNumber),
        createdAt: si.createdAt.toISOString(),
      });
    }
  }

  // Build scan-out history
  if (!filterType || filterType === "out") {
    const scanOuts = await db.select().from(scanOutTable);

    for (const so of scanOuts) {
      if (filterUserId && so.userId !== filterUserId) continue;
      if (filterFrom && so.createdAt < new Date(filterFrom)) continue;
      if (filterTo && so.createdAt > new Date(filterTo)) continue;

      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, so.userId));
      const items = await db.select().from(scanItemsTable).where(eq(scanItemsTable.scanOutId, so.id));

      if (items.length === 0) continue;

      // Get material from first item's scan-in
      let materialId: number | null = null;
      let materialName: string | null = null;
      let boxLabel: string | null = null;
      if (items[0].scanInId) {
        const [si] = await db.select().from(scanInTable).where(eq(scanInTable.id, items[0].scanInId));
        if (si) {
          materialId = si.materialId;
          boxLabel = si.boxLabel;
          const [material] = await db.select().from(materialsTable).where(eq(materialsTable.id, si.materialId));
          materialName = material?.name ?? null;
        }
      }

      if (filterMaterialId && materialId !== filterMaterialId) continue;

      records.push({
        id: so.id,
        type: "out",
        materialId,
        materialName,
        boxLabel,
        userId: so.userId,
        userName: user?.username ?? "Unknown",
        serialNumbers: items.map((i) => i.serialNumber),
        createdAt: so.createdAt.toISOString(),
      });
    }
  }

  // Sort by createdAt descending
  records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(ListHistoryResponse.parse(records));
});

router.delete("/history/:id", async (req, res): Promise<void> => {
  const params = DeleteHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Try to delete as scan-in first, then as scan-out
  const [siDeleted] = await db
    .delete(scanInTable)
    .where(eq(scanInTable.id, params.data.id))
    .returning();

  if (siDeleted) {
    // Also delete its items
    await db.delete(scanItemsTable).where(eq(scanItemsTable.scanInId, params.data.id));
    res.sendStatus(204);
    return;
  }

  const [soDeleted] = await db
    .delete(scanOutTable)
    .where(eq(scanOutTable.id, params.data.id))
    .returning();

  if (soDeleted) {
    // Unlink items
    await db.update(scanItemsTable).set({ scanOutId: null }).where(eq(scanItemsTable.scanOutId, params.data.id));
    res.sendStatus(204);
    return;
  }

  res.status(404).json({ error: "History record not found" });
});

export default router;
