import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { materialsTable } from "./materials";

export const nonScanMasukTable = pgTable("non_scan_masuk", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id").notNull().references(() => materialsTable.id),
  kodeMaterial: text("kode_material").notNull(),
  jumlah: integer("jumlah").notNull(),
  satuan: text("satuan").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNonScanMasukSchema = createInsertSchema(nonScanMasukTable).omit({ id: true, createdAt: true });
export type InsertNonScanMasuk = z.infer<typeof insertNonScanMasukSchema>;
export type NonScanMasuk = typeof nonScanMasukTable.$inferSelect;

export const nonScanKeluarTable = pgTable("non_scan_keluar", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id").notNull().references(() => materialsTable.id),
  jumlah: integer("jumlah").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNonScanKeluarSchema = createInsertSchema(nonScanKeluarTable).omit({ id: true, createdAt: true });
export type InsertNonScanKeluar = z.infer<typeof insertNonScanKeluarSchema>;
export type NonScanKeluar = typeof nonScanKeluarTable.$inferSelect;
