import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, PackagePlus, CheckCircle2, Tag } from "lucide-react";
import { format } from "date-fns";
import { useListMaterials } from "@workspace/api-client-react";

interface MasukRecord {
  id: number;
  materialId: number;
  materialName: string;
  kodeMaterial: string;
  jumlah: number;
  satuan: string;
  userId: number;
  userName: string;
  createdAt: string;
}

export default function MaterialMasuk() {
  const { user } = useAuth();
  const { data: materials } = useListMaterials();

  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [jumlah, setJumlah] = useState<string>("");
  const [satuan, setSatuan] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [records, setRecords] = useState<MasukRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [previewKode, setPreviewKode] = useState<string>("");

  const fetchRecords = useCallback(async () => {
    try {
      const data = await customFetch<MasukRecord[]>("/api/material-masuk");
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    if (!selectedMaterialId || !materials) {
      setPreviewKode("");
      return;
    }
    const mat = materials.find((m) => m.id.toString() === selectedMaterialId);
    if (!mat) { setPreviewKode(""); return; }
    const existingForMat = records.filter((r) => r.materialId.toString() === selectedMaterialId);
    const nextSeq = (existingForMat.length + 1).toString().padStart(3, "0");
    setPreviewKode(`${mat.code}-${nextSeq}`);
  }, [selectedMaterialId, materials, records]);

  const handleSubmit = async () => {
    if (!selectedMaterialId || !jumlah || !satuan || !user) {
      setErrorMessage("Semua field harus diisi.");
      return;
    }
    const jumlahNum = parseInt(jumlah);
    if (isNaN(jumlahNum) || jumlahNum <= 0) {
      setErrorMessage("Jumlah harus berupa angka positif.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await customFetch<MasukRecord>("/api/material-masuk", {
        method: "POST",
        body: JSON.stringify({
          materialId: parseInt(selectedMaterialId),
          jumlah: jumlahNum,
          satuan,
          userId: user.id,
        }),
      });

      setSuccessMessage(`Berhasil! Kode material: ${result.kodeMaterial} — ${result.jumlah} ${result.satuan} ditambahkan ke stok.`);
      setJumlah("");
      setSatuan("");
      setSelectedMaterialId("");
      await fetchRecords();
    } catch (err: any) {
      setErrorMessage(err?.data?.error ?? "Gagal menyimpan data. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMaterialName = materials?.find((m) => m.id.toString() === selectedMaterialId)?.name ?? "";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <PackagePlus className="w-8 h-8 text-emerald-600" />
          Material Masuk
        </h2>
        <p className="text-muted-foreground mt-1">Input material non-scan (selain MCB/MCCB) ke dalam stok gudang</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form Input */}
        <Card className="border-emerald-500/30 shadow-sm">
          <CardHeader className="bg-emerald-50 dark:bg-emerald-950/20 rounded-t-lg border-b border-emerald-500/20">
            <CardTitle className="text-lg font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <PackagePlus className="w-5 h-5" />
              Form Input Material Masuk
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {/* Pilih Material */}
            <div className="space-y-2">
              <Label htmlFor="material" className="font-semibold">Pilih Material</Label>
              <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
                <SelectTrigger id="material">
                  <SelectValue placeholder="— Pilih material —" />
                </SelectTrigger>
                <SelectContent className="max-h-[50vh] overflow-y-auto">
                  {materials?.filter((m) => (m as any).kategori === 'non-scan').map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>
                      <span className="font-mono text-xs mr-2 text-muted-foreground">{m.code}</span>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview Kode Material */}
            {previewKode && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-500/30">
                <Tag className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Kode material yang akan dibuat:</p>
                  <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-lg">{previewKode}</p>
                </div>
              </div>
            )}

            {/* Jumlah */}
            <div className="space-y-2">
              <Label htmlFor="jumlah" className="font-semibold">Jumlah</Label>
              <Input
                id="jumlah"
                type="number"
                min="1"
                placeholder="Masukkan jumlah..."
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
              />
            </div>

            {/* Satuan */}
            <div className="space-y-2">
              <Label htmlFor="satuan" className="font-semibold">Satuan</Label>
              <Input
                id="satuan"
                type="text"
                placeholder="Contoh: meter, pcs, roll, kg..."
                value={satuan}
                onChange={(e) => setSatuan(e.target.value)}
              />
            </div>

            {/* Error / Success */}
            {errorMessage && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-sm text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                {successMessage}
              </div>
            )}

            {/* Tombol Selesai */}
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedMaterialId || !jumlah || !satuan}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Selesai — Tambah ke Stok</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Riwayat */}
        <Card className="border-sidebar-border shadow-sm">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-lg font-semibold">Riwayat Material Masuk</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingRecords ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : records.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Belum ada data material masuk</div>
            ) : (
              <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
                {[...records].reverse().map((r) => (
                  <div key={r.id} className="p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{r.materialName}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                            {r.kodeMaterial}
                          </Badge>
                          <span className="text-sm font-mono font-bold text-emerald-600">{r.jumlah} {r.satuan}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.userName} · {format(new Date(r.createdAt), "dd MMM yyyy HH:mm")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
