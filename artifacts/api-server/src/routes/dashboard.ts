import { Router } from "express";
import type { IRouter } from "express";
import { db, scanInTable, scanOutTable, scanItemsTable, materialsTable, usersTable, nonScanMasukTable, nonScanKeluarTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetDashboardSummaryResponse,
  GetMaterialStatsQueryParams,
  GetMaterialStatsResponse,
  GetRecentActivityQueryParams,
  GetRecentActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const allScanIns = await db.select().from(scanInTable).where(eq(scanInTable.status, "completed"));
  const allScanOuts = await db.select().from(scanOutTable);
  const allMaterials = await db.select().from(materialsTable);
  const allUsers = await db.select().from(usersTable);
  const allNonScanMasuk = await db.select().from(nonScanMasukTable);
  const allNonScanKeluar = await db.select().from(nonScanKeluarTable);

  let totalIn = 0;
  for (const si of allScanIns) {
    const items = await db.select().from(scanItemsTable).where(eq(scanItemsTable.scanInId, si.id));
    totalIn += items.length;
  }
  for (const nm of allNonScanMasuk) {
    totalIn += nm.jumlah;
  }

  let totalOut = 0;
  for (const so of allScanOuts) {
    const items = await db.select().from(scanItemsTable).where(eq(scanItemsTable.scanOutId, so.id));
    totalOut += items.length;
  }
  for (const nk of allNonScanKeluar) {
    totalOut += nk.jumlah;
  }

  res.json(GetDashboardSummaryResponse.parse({
    totalMaterialIn: totalIn,
    totalMaterialOut: totalOut,
    totalStock: totalIn - totalOut,
    totalMaterials: allMaterials.length,
    totalUsers: allUsers.length,
  }));
});

router.get("/dashboard/material-stats", async (req, res): Promise<void> => {
  const params = GetMaterialStatsQueryParams.safeParse(req.query);
  const filterMaterialId = params.success && params.data.materialId ? Number(params.data.materialId) : undefined;

  const materials = filterMaterialId
    ? await db.select().from(materialsTable).where(eq(materialsTable.id, filterMaterialId))
    : await db.select().from(materialsTable);

  const stats = [];
  for (const material of materials) {
    const scanIns = await db.select().from(scanInTable).where(eq(scanInTable.materialId, material.id));
    let totalIn = 0;
    for (const si of scanIns) {
      if (si.status === "completed") {
        const items = await db.select().from(scanItemsTable).where(eq(scanItemsTable.scanInId, si.id));
        totalIn += items.length;
      }
    }

    const nonScanMasukRows = await db.select().from(nonScanMasukTable).where(eq(nonScanMasukTable.materialId, material.id));
    for (const nm of nonScanMasukRows) {
      totalIn += nm.jumlah;
    }

    const scanInIds = scanIns.map((s) => s.id);
    let totalOut = 0;
    for (const siId of scanInIds) {
      const outItems = await db.select().from(scanItemsTable).where(eq(scanItemsTable.scanInId, siId));
      totalOut += outItems.filter((i) => i.scanOutId != null).length;
    }

    const nonScanKeluarRows = await db.select().from(nonScanKeluarTable).where(eq(nonScanKeluarTable.materialId, material.id));
    for (const nk of nonScanKeluarRows) {
      totalOut += nk.jumlah;
    }

    stats.push({
      materialId: material.id,
      materialName: material.name,
      totalIn,
      totalOut,
      currentStock: totalIn - totalOut,
    });
  }

  res.json(GetMaterialStatsResponse.parse(stats));
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const params = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = params.success && params.data.limit ? Number(params.data.limit) : 20;

  const activities: any[] = [];

  // Scan-in completions
  const recentScanIns = await db.select().from(scanInTable)
    .where(eq(scanInTable.status, "completed"))
    .orderBy(scanInTable.createdAt)
    .limit(limit);

  for (const si of recentScanIns) {
    const [material] = await db.select().from(materialsTable).where(eq(materialsTable.id, si.materialId));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, si.userId));
    const items = await db.select().from(scanItemsTable).where(eq(scanItemsTable.scanInId, si.id));

    activities.push({
      id: si.id,
      type: "in" as const,
      source: "scan" as const,
      materialName: material?.name ?? null,
      boxLabel: si.boxLabel,
      userName: user?.username ?? "Unknown",
      count: items.length,
      createdAt: si.createdAt.toISOString(),
    });
  }

  // Scan-outs
  const recentScanOuts = await db.select().from(scanOutTable)
    .orderBy(scanOutTable.createdAt)
    .limit(limit);

  for (const so of recentScanOuts) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, so.userId));
    const items = await db.select().from(scanItemsTable).where(eq(scanItemsTable.scanOutId, so.id));
    if (items.length === 0) continue;

    let materialName: string | null = null;
    let boxLabel: string | null = null;
    if (items[0].scanInId) {
      const [si] = await db.select().from(scanInTable).where(eq(scanInTable.id, items[0].scanInId));
      if (si) {
        boxLabel = si.boxLabel;
        const [mat] = await db.select().from(materialsTable).where(eq(materialsTable.id, si.materialId));
        materialName = mat?.name ?? null;
      }
    }

    activities.push({
      id: so.id,
      type: "out" as const,
      source: "scan" as const,
      materialName,
      boxLabel,
      userName: user?.username ?? "Unknown",
      count: items.length,
      createdAt: so.createdAt.toISOString(),
    });
  }

  // Non-scan masuk
  const nonScanMasukRows = await db.select().from(nonScanMasukTable)
    .orderBy(nonScanMasukTable.createdAt)
    .limit(limit);

  for (const nm of nonScanMasukRows) {
    const [material] = await db.select().from(materialsTable).where(eq(materialsTable.id, nm.materialId));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, nm.userId));

    activities.push({
      id: nm.id + 1000000,
      type: "in" as const,
      source: "non-scan" as const,
      materialName: material?.name ?? null,
      boxLabel: null,
      userName: user?.username ?? "Unknown",
      count: nm.jumlah,
      satuan: nm.satuan,
      createdAt: nm.createdAt.toISOString(),
    });
  }

  // Non-scan keluar
  const nonScanKeluarRows = await db.select().from(nonScanKeluarTable)
    .orderBy(nonScanKeluarTable.createdAt)
    .limit(limit);

  for (const nk of nonScanKeluarRows) {
    const [material] = await db.select().from(materialsTable).where(eq(materialsTable.id, nk.materialId));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, nk.userId));

    const masukRows = await db.select().from(nonScanMasukTable).where(eq(nonScanMasukTable.materialId, nk.materialId));
    const satuan = masukRows[masukRows.length - 1]?.satuan ?? "";

    activities.push({
      id: nk.id + 2000000,
      type: "out" as const,
      source: "non-scan" as const,
      materialName: material?.name ?? null,
      boxLabel: null,
      userName: user?.username ?? "Unknown",
      count: nk.jumlah,
      satuan,
      createdAt: nk.createdAt.toISOString(),
    });
  }

  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(GetRecentActivityResponse.parse(activities.slice(0, limit)));
});

export default router;
