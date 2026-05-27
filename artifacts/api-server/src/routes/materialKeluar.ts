import { Router } from "express";
import type { IRouter } from "express";
import { db, nonScanMasukTable, nonScanKeluarTable, materialsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function validateCreateKeluarBody(body: any): { materialId: number; jumlah: number; userId: number } | null {
  const { materialId, jumlah, userId } = body ?? {};
  if (!Number.isInteger(materialId) || materialId <= 0) return null;
  if (!Number.isInteger(jumlah) || jumlah <= 0) return null;
  if (!Number.isInteger(userId) || userId <= 0) return null;
  return { materialId, jumlah, userId };
}

function keluarToJson(k: any, materialName?: string, userName?: string) {
  return {
    id: k.id,
    materialId: k.materialId,
    materialName: materialName ?? null,
    jumlah: k.jumlah,
    userId: k.userId,
    userName: userName ?? null,
    createdAt: k.createdAt.toISOString(),
  };
}

router.get("/material-keluar", async (req, res): Promise<void> => {
  const rows = await db.select().from(nonScanKeluarTable).orderBy(nonScanKeluarTable.createdAt);
  const results = await Promise.all(rows.map(async (r) => {
    const [mat] = await db.select().from(materialsTable).where(eq(materialsTable.id, r.materialId));
    const [usr] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId));
    return keluarToJson(r, mat?.name, usr?.username);
  }));
  res.json(results);
});

router.post("/material-keluar", async (req, res): Promise<void> => {
  const data = validateCreateKeluarBody(req.body);
  if (!data) {
    res.status(400).json({ error: "Data tidak valid. Pastikan materialId, jumlah, dan userId terisi dengan benar." });
    return;
  }

  const [material] = await db.select().from(materialsTable).where(eq(materialsTable.id, data.materialId));
  if (!material) {
    res.status(404).json({ error: "Material tidak ditemukan" });
    return;
  }

  const masukRows = await db.select().from(nonScanMasukTable).where(eq(nonScanMasukTable.materialId, data.materialId));
  const keluarRows = await db.select().from(nonScanKeluarTable).where(eq(nonScanKeluarTable.materialId, data.materialId));
  const totalMasuk = masukRows.reduce((acc, r) => acc + r.jumlah, 0);
  const totalKeluar = keluarRows.reduce((acc, r) => acc + r.jumlah, 0);
  const stock = totalMasuk - totalKeluar;

  if (data.jumlah > stock) {
    res.status(400).json({ error: `Stok tidak cukup. Stok tersedia: ${stock}` });
    return;
  }

  const [record] = await db.insert(nonScanKeluarTable).values({
    materialId: data.materialId,
    jumlah: data.jumlah,
    userId: data.userId,
  }).returning();

  const [usr] = await db.select().from(usersTable).where(eq(usersTable.id, record.userId));
  res.status(201).json(keluarToJson(record, material.name, usr?.username));
});

router.delete("/material-keluar/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }
  const [record] = await db.delete(nonScanKeluarTable).where(eq(nonScanKeluarTable.id, id)).returning();
  if (!record) { res.status(404).json({ error: "Data tidak ditemukan" }); return; }
  res.sendStatus(204);
});

export default router;
