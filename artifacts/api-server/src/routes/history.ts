import { Router } from "express";
import type { IRouter } from "express";
import { db, scanInTable, scanOutTable, scanItemsTable, materialsTable, usersTable, nonScanMasukTable, nonScanKeluarTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

  // Scan-in history
  if (!filterType || filterType === "in") {
    const scanIns = await db.select().from(scanInTable).where(eq(scanInTable.status, "completed"));

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
        source: "scan",
        materialId: si.materialId,
        materialName: material?.name ?? "Unknown",
        boxLabel: si.boxLabel,
        userId: si.userId,
        userName: user?.username ?? "Unknown",
        serialNumbers: items.map((i) => i.serialNumber),
        count: items.length,
        createdAt: si.createdAt.toISOString(),
      });
    }
  }

  // Scan-out history
  if (!filterType || filterType === "out") {
    const scanOuts = await db.select().from(scanOutTable);

    for (const so of scanOuts) {
      if (filterUserId && so.userId !== filterUserId) continue;
      if (filterFrom && so.createdAt < new Date(filterFrom)) continue;
      if (filterTo && so.createdAt > new Date(filterTo)) continue;

      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, so.userId));
      const items = await db.select().from(scanItemsTable).where(eq(scanItemsTable.scanOutId, so.id));

      if (items.length === 0) continue;

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
        source: "scan",
        materialId,
        materialName,
        boxLabel,
        userId: so.userId,
        userName: user?.username ?? "Unknown",
        serialNumbers: items.map((i) => i.serialNumber),
        count: items.length,
        createdAt: so.createdAt.toISOString(),
      });
    }
  }

  // Non-scan masuk
  if (!filterType || filterType === "in") {
    const nonScanMasukRows = await db.select().from(nonScanMasukTable);

    for (const nm of nonScanMasukRows) {
      if (filterMaterialId && nm.materialId !== filterMaterialId) continue;
      if (filterUserId && nm.userId !== filterUserId) continue;
      if (filterFrom && nm.createdAt < new Date(filterFrom)) continue;
      if (filterTo && nm.createdAt > new Date(filterTo)) continue;

      const [material] = await db.select().from(materialsTable).where(eq(materialsTable.id, nm.materialId));
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, nm.userId));

      records.push({
        id: nm.id + 1000000,
        type: "in",
        source: "non-scan",
        materialId: nm.materialId,
        materialName: material?.name ?? "Unknown",
        boxLabel: null,
        userId: nm.userId,
        userName: user?.username ?? "Unknown",
        serialNumbers: [],
        count: nm.jumlah,
        satuan: nm.satuan,
        createdAt: nm.createdAt.toISOString(),
      });
    }
  }

  // Non-scan keluar
  if (!filterType || filterType === "out") {
    const nonScanKeluarRows = await db.select().from(nonScanKeluarTable);

    for (const nk of nonScanKeluarRows) {
      if (filterUserId && nk.userId !== filterUserId) continue;
      if (filterFrom && nk.createdAt < new Date(filterFrom)) continue;
      if (filterTo && nk.createdAt > new Date(filterTo)) continue;
      if (filterMaterialId && nk.materialId !== filterMaterialId) continue;

      const [material] = await db.select().from(materialsTable).where(eq(materialsTable.id, nk.materialId));
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, nk.userId));

      const masukRows = await db.select().from(nonScanMasukTable).where(eq(nonScanMasukTable.materialId, nk.materialId));
      const satuan = masukRows[masukRows.length - 1]?.satuan ?? "";

      records.push({
        id: nk.id + 2000000,
        type: "out",
        source: "non-scan",
        materialId: nk.materialId,
        materialName: material?.name ?? "Unknown",
        boxLabel: null,
        userId: nk.userId,
        userName: user?.username ?? "Unknown",
        serialNumbers: [],
        count: nk.jumlah,
        satuan,
        createdAt: nk.createdAt.toISOString(),
      });
    }
  }

  records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(ListHistoryResponse.parse(records));
});

router.delete("/history/:id", async (req, res): Promise<void> => {
  const params = DeleteHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const id = params.data.id;

  // Non-scan keluar (id offset 2000000)
  if (id > 2000000) {
    const realId = id - 2000000;
    const [deleted] = await db.delete(nonScanKeluarTable).where(eq(nonScanKeluarTable.id, realId)).returning();
    if (deleted) { res.sendStatus(204); return; }
  }

  // Non-scan masuk (id offset 1000000)
  if (id > 1000000) {
    const realId = id - 1000000;
    const [deleted] = await db.delete(nonScanMasukTable).where(eq(nonScanMasukTable.id, realId)).returning();
    if (deleted) { res.sendStatus(204); return; }
  }

  // Scan-in
  const [siRecord] = await db.select().from(scanInTable).where(eq(scanInTable.id, id));
  if (siRecord) {
    await db.delete(scanItemsTable).where(eq(scanItemsTable.scanInId, id));
    await db.delete(scanInTable).where(eq(scanInTable.id, id));
    res.sendStatus(204);
    return;
  }

  // Scan-out
  const [soDeleted] = await db
    .delete(scanOutTable)
    .where(eq(scanOutTable.id, id))
    .returning();

  if (soDeleted) {
    await db.update(scanItemsTable).set({ scanOutId: null }).where(eq(scanItemsTable.scanOutId, id));
    res.sendStatus(204);
    return;
  }

  res.status(404).json({ error: "History record not found" });
});

export default router;
