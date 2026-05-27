import { Router } from "express";
import type { IRouter } from "express";
import { db, nonScanMasukTable, nonScanKeluarTable, materialsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function validateCreateMasukBody(body: any): { materialId: number; jumlah: number; satuan: string; userId: number } | null {
  const { materialId, jumlah, satuan, userId } = body ?? {};
  if (!Number.isInteger(materialId) || materialId <= 0) return null;
  if (!Number.isInteger(jumlah) || jumlah <= 0) return null;
  if (typeof satuan !== "string" || satuan.trim() === "") return null;
  if (!Number.isInteger(userId) || userId <= 0) return null;
  return { materialId, jumlah, satuan: satuan.trim(), userId };
}

function masukToJson(m: any, materialName?: string, userName?: string) {
  return {
    id: m.id,
    materialId: m.materialId,
    materialName: materialName ?? null,
    kodeMaterial: m.kodeMaterial,
    jumlah: m.jumlah,
    satuan: m.satuan,
    userId: m.userId,
    userName: userName ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/material-masuk", async (req, res): Promise<void> => {
  const rows = await db.select().from(nonScanMasukTable).orderBy(nonScanMasukTable.createdAt);
  const results = await Promise.all(rows.map(async (r) => {
    const [mat] = await db.select().from(materialsTable).where(eq(materialsTable.id, r.materialId));
    const [usr] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId));
    return masukToJson(r, mat?.name, usr?.username);
  }));
  res.json(results);
});

router.post("/material-masuk", async (req, res): Promise<void> => {
  const data = validateCreateMasukBody(req.body);
  if (!data) {
    res.status(400).json({ error: "Data tidak valid. Pastikan materialId, jumlah, satuan, dan userId terisi dengan benar." });
    return;
  }

  const [material] = await db.select().from(materialsTable).where(eq(materialsTable.id, data.materialId));
  if (!material) {
    res.status(404).json({ error: "Material tidak ditemukan" });
    return;
  }

  const existing = await db.select().from(nonScanMasukTable).where(eq(nonScanMasukTable.materialId, data.materialId));
  const seqNum = (existing.length + 1).toString().padStart(3, "0");
  const kodeMaterial = `${material.code}-${seqNum}`;

  const [record] = await db.insert(nonScanMasukTable).values({
    materialId: data.materialId,
    kodeMaterial,
    jumlah: data.jumlah,
    satuan: data.satuan,
    userId: data.userId,
  }).returning();

  const [usr] = await db.select().from(usersTable).where(eq(usersTable.id, record.userId));
  res.status(201).json(masukToJson(record, material.name, usr?.username));
});

router.get("/material-masuk/stock", async (req, res): Promise<void> => {
  const materials = await db.select().from(materialsTable);
  const stockList = await Promise.all(materials.map(async (mat) => {
    const masukRows = await db.select().from(nonScanMasukTable).where(eq(nonScanMasukTable.materialId, mat.id));
    const keluarRows = await db.select().from(nonScanKeluarTable).where(eq(nonScanKeluarTable.materialId, mat.id));
    const totalMasuk = masukRows.reduce((acc, r) => acc + r.jumlah, 0);
    const totalKeluar = keluarRows.reduce((acc, r) => acc + r.jumlah, 0);
    const stock = totalMasuk - totalKeluar;
    const satuanRow = masukRows[masukRows.length - 1];
    return {
      materialId: mat.id,
      materialName: mat.name,
      materialCode: mat.code,
      totalMasuk,
      totalKeluar,
      stock,
      satuan: satuanRow?.satuan ?? "",
    };
  }));
  res.json(stockList.filter((s) => s.totalMasuk > 0));
});

router.delete("/material-masuk/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }
  const [record] = await db.delete(nonScanMasukTable).where(eq(nonScanMasukTable.id, id)).returning();
  if (!record) { res.status(404).json({ error: "Data tidak ditemukan" }); return; }
  res.sendStatus(204);
});

export default router;
