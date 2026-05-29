import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, PackageMinus, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface StockItem {
  materialId: number;
  materialName: string;
  materialCode: string;
  totalMasuk: number;
  totalKeluar: number;
  stock: number;
  satuan: string;
}

interface KeluarRecord {
  id: number;
  materialId: number;
  materialName: string;
  jumlah: number;
  userId: number;
  userName: string;
  createdAt: string;
}

export default function MaterialKeluar() {
  const { user } = useAuth();

  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState(true);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [jumlah, setJumlah] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [records, setRecords] = useState<KeluarRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);

  const fetchStock = useCallback(async () => {
    try {
      const data = await customFetch<StockItem[]>("/api/material-masuk/stock");
      setStockList(data);
    } catch {
      setStockList([]);
    } finally {
      setIsLoadingStock(false);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const data = await customFetch<KeluarRecord[]>("/api/material-keluar");
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    fetchStock();
    fetchRecords();
  }, [fetchStock, fetchRecords]);

  const selectedStock = stockList.find((s) => s.materialId.toString() === selectedMaterialId);

  const handleSubmit = async () => {
    if (!selectedMaterialId || !jumlah || !user) {
      setErrorMessage("Semua field harus diisi.");
      return;
    }
    const jumlahNum = parseInt(jumlah);
    if (isNaN(jumlahNum) || jumlahNum <= 0) {
      setErrorMessage("Jumlah harus berupa angka positif.");
      return;
    }
    if (selectedStock && jumlahNum > selectedStock.stock) {
      setErrorMessage(`Stok tidak cukup. Stok tersedia: ${selectedStock.stock} ${selectedStock.satuan}`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await customFetch<KeluarRecord>("/api/material-keluar", {
        method: "POST",
        body: JSON.stringify({
          materialId: parseInt(selectedMaterialId),
          jumlah: jumlahNum,
          userId: user.id,
        }),
      });

      setSuccessMessage(`Berhasil! ${result.jumlah} ${selectedStock?.satuan ?? ""} ${result.materialName} dikeluarkan dari stok.`);
      setJumlah("");
      setSelectedMaterialId("");
      await Promise.all([fetchStock(), fetchRecords()]);
    } catch (err: any) {
      setErrorMessage(err?.data?.error ?? "Gagal menyimpan data. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <PackageMinus className="w-8 h-8 text-amber-600" />
          Material Keluar
        </h2>
        <p className="text-muted-foreground mt-1">Keluarkan material non-scan dari stok gudang</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form Keluar */}
        <Card className="border-amber-500/30 shadow-sm">
          <CardHeader className="bg-amber-50 dark:bg-amber-950/20 rounded-t-lg border-b border-amber-500/20">
            <CardTitle className="text-lg font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <PackageMinus className="w-5 h-5" />
              Form Material Keluar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {/* Pilih Material */}
            <div className="space-y-2">
              <Label htmlFor="material" className="font-semibold">Pilih Material (Stok Tersedia)</Label>
              {isLoadingStock ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Memuat stok...
                </div>
              ) : stockList.length === 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-500/20 rounded-lg text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Belum ada stok material. Silakan input material masuk terlebih dahulu.
                </div>
              ) : (
                <Select value={selectedMaterialId} onValueChange={(v) => { setSelectedMaterialId(v); setJumlah(""); }}>
                  <SelectTrigger id="material">
                    <SelectValue placeholder="— Pilih material —" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[50vh] overflow-y-auto">
                    {stockList.map((s) => (
                      <SelectItem key={s.materialId} value={s.materialId.toString()} disabled={s.stock <= 0}>
                        <span className="font-mono text-xs mr-2 text-muted-foreground">{s.materialCode}</span>
                        {s.materialName}
                        <span className="ml-2 text-xs font-bold text-primary">({s.stock} {s.satuan})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Info Stok Terpilih */}
            {selectedStock && (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Stok</p>
                  <p className="text-2xl font-bold font-mono text-primary">{selectedStock.stock}</p>
                  <p className="text-xs text-muted-foreground">{selectedStock.satuan}</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-500/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Masuk</p>
                  <p className="text-2xl font-bold font-mono text-emerald-600">{selectedStock.totalMasuk}</p>
                  <p className="text-xs text-muted-foreground">{selectedStock.satuan}</p>
                </div>
                <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-500/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Keluar</p>
                  <p className="text-2xl font-bold font-mono text-amber-600">{selectedStock.totalKeluar}</p>
                  <p className="text-xs text-muted-foreground">{selectedStock.satuan}</p>
                </div>
              </div>
            )}

            {/* Jumlah */}
            <div className="space-y-2">
              <Label htmlFor="jumlah" className="font-semibold">
                Jumlah Keluar
                {selectedStock && <span className="ml-1 text-xs text-muted-foreground font-normal">(maks. {selectedStock.stock} {selectedStock.satuan})</span>}
              </Label>
              <Input
                id="jumlah"
                type="number"
                min="1"
                max={selectedStock?.stock}
                placeholder="Masukkan jumlah yang keluar..."
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                disabled={!selectedMaterialId}
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
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedMaterialId || !jumlah || stockList.length === 0}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Selesai — Kurangi Stok</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Riwayat Keluar */}
        <Card className="border-sidebar-border shadow-sm">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-lg font-semibold">Riwayat Material Keluar</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingRecords ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : records.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Belum ada data material keluar</div>
            ) : (
              <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
                {[...records].reverse().map((r) => {
                  const stock = stockList.find((s) => s.materialId === r.materialId);
                  return (
                    <div key={r.id} className="p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{r.materialName}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs border-amber-500/40 text-amber-700 dark:text-amber-400">
                              Keluar
                            </Badge>
                            <span className="text-sm font-mono font-bold text-amber-600">
                              {r.jumlah} {stock?.satuan ?? ""}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{r.userName} · {format(new Date(r.createdAt), "dd MMM yyyy HH:mm")}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabel Stok Keseluruhan */}
      <Card className="border-sidebar-border shadow-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-lg font-semibold">Ringkasan Stok Material Non-Scan</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingStock ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : stockList.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Belum ada stok material non-scan</div>
          ) : (
            <div className="rounded-b-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Material</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Satuan</th>
                    <th className="text-center py-3 px-4 font-semibold text-emerald-600 uppercase tracking-wider text-xs">Masuk</th>
                    <th className="text-center py-3 px-4 font-semibold text-amber-600 uppercase tracking-wider text-xs">Keluar</th>
                    <th className="text-center py-3 px-4 font-semibold text-primary uppercase tracking-wider text-xs">Stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stockList.map((s) => (
                    <tr key={s.materialId} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium">{s.materialName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.materialCode}</p>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{s.satuan}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-500">{s.totalMasuk}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-amber-600 dark:text-amber-500">{s.totalKeluar}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-primary">{s.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
