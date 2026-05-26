import { Router } from "express";
import type { IRouter } from "express";
import { db, scanInTable, scanOutTable, scanItemsTable, materialsTable, usersTable } from "@workspace/db";
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

  // Count total serial numbers in (scan_in completed items)
  let totalIn = 0;
  for (const si of allScanIns) {
    const items = await db.select().from(scanItemsTable).where(eq(scanItemsTable.scanInId, si.id));
    totalIn += items.length;
  }

  // Count total serial numbers out
  let totalOut = 0;
  for (const so of allScanOuts) {
    const items = await db.select().from(scanItemsTable).where(eq(scanItemsTable.scanOutId, so.id));
    totalOut += items.length;
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

    // Count out for items that came from this material's scan-in sessions
    const scanInIds = scanIns.map((s) => s.id);
    let totalOut = 0;
    for (const siId of scanInIds) {
      const outItems = await db.select().from(scanItemsTable)
        .where(eq(scanItemsTable.scanInId, siId));
      totalOut += outItems.filter((i) => i.scanOutId != null).length;
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

  // Recent scan-in completions
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
      materialName: material?.name ?? null,
      boxLabel: si.boxLabel,
      userName: user?.username ?? "Unknown",
      count: items.length,
      createdAt: si.createdAt.toISOString(),
    });
  }

  // Recent scan-outs
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
      materialName,
      boxLabel,
      userName: user?.username ?? "Unknown",
      count: items.length,
      createdAt: so.createdAt.toISOString(),
    });
  }

  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(GetRecentActivityResponse.parse(activities.slice(0, limit)));
});

export default router;
