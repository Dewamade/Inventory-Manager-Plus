import { useGetMaterialStats, useGetRecentActivity, useListMaterials, useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Activity, Loader2, PackagePlus, PackageMinus, Layers, FileSpreadsheet, FileText } from "lucide-react";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | "all">("all");

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: materials } = useListMaterials();
  const { data: allStats, isLoading: isLoadingStats } = useGetMaterialStats();
  const { data: recentActivity, isLoading: isLoadingActivity } = useGetRecentActivity({ limit: 15 });

  const statsArray = Array.isArray(allStats) ? allStats : allStats ? [allStats] : [];

  const filteredStats = useMemo(() => {
    if (selectedMaterialId === "all") return statsArray;
    return statsArray.filter(s => s.materialId === selectedMaterialId);
  }, [statsArray, selectedMaterialId]);

  const singleStat = filteredStats.length === 1 ? filteredStats[0] : null;
  const { toast } = useToast();

  const handleExportExcel = () => {
    if (filteredStats.length === 0) {
      toast({ title: "Tidak ada data untuk diekspor", variant: "destructive" });
      return;
    }
    const label = selectedMaterialId === "all" ? "Semua" : filteredStats[0]?.materialName ?? "Material";
    const rows = filteredStats.map(s => ({
      "Kode": s.materialCode ?? "-",
      "Nama Material": s.materialName,
      "Total Masuk": s.totalIn,
      "Total Keluar": s.totalOut,
      "Stok Saat Ini": s.currentStock,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stok Material");
    XLSX.writeFile(wb, `Stok_Material_${label}_${format(new Date(), "yyyyMMdd")}.xlsx`);
    toast({ title: "Export Excel berhasil", description: `${rows.length} material.` });
  };

  const handleExportPDF = () => {
    if (filteredStats.length === 0) {
      toast({ title: "Tidak ada data untuk diekspor", variant: "destructive" });
      return;
    }
    const label = selectedMaterialId === "all" ? "Semua Material" : filteredStats[0]?.materialName ?? "Material";
    const doc = new jsPDF();
    const margin = 14;
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Laporan Stok per Material", margin, 18);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(
      `Gudang Pemaron  |  Filter: ${label}  |  Dicetak: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
      margin, 25
    );
    doc.setTextColor(0);

    // Table header
    const cols = [{ label: "Material", x: margin, w: 70 }, { label: "Masuk", x: margin + 72, w: 28 }, { label: "Keluar", x: margin + 102, w: 28 }, { label: "Stok", x: margin + 132, w: 28 }];
    let y = 34;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, pageW - margin * 2, 8, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    cols.forEach(c => doc.text(c.label, c.x, y));
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    filteredStats.forEach((s, i) => {
      if (y > doc.internal.pageSize.getHeight() - 16) { doc.addPage(); y = 16; }
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
      }
      doc.text(s.materialName, cols[0].x, y);
      doc.text(String(s.totalIn), cols[1].x, y);
      doc.text(String(s.totalOut), cols[2].x, y);
      doc.setFont("helvetica", "bold");
      doc.text(String(s.currentStock), cols[3].x, y);
      doc.setFont("helvetica", "normal");
      y += 7;
    });

    const filename = `Stok_Material_${label.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
    doc.save(filename);
    toast({ title: "Export PDF berhasil", description: `${filteredStats.length} material.` });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Tampilan Realtime Material Gudang Pemaron</p>
        </div>
        {/* Jenis Material badge */}
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-5 py-3 w-fit">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jenis Material</p>
            {isLoadingSummary ? (
              <div className="animate-pulse h-7 w-10 bg-muted rounded mt-0.5" />
            ) : (
              <p className="text-2xl font-bold font-mono text-primary leading-none mt-0.5">
                {summary?.totalMaterials ?? 0}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">

        {/* Stok per Material */}
        <div className="lg:col-span-2">
          <Card className="border-border/60 shadow-sm h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/40 gap-3 flex-wrap">
              <CardTitle className="text-lg font-semibold shrink-0">Stok per Material</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-[200px] shrink-0">
                  <Select
                    value={selectedMaterialId.toString()}
                    onValueChange={(val) => setSelectedMaterialId(val === "all" ? "all" : parseInt(val))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Semua Material" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Material</SelectItem>
                      {materials?.map((m) => (
                        <SelectItem key={m.id} value={m.id.toString()}>{m.code} — {m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                  onClick={handleExportExcel}
                  disabled={isLoadingStats || filteredStats.length === 0}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-950/30"
                  onClick={handleExportPDF}
                  disabled={isLoadingStats || filteredStats.length === 0}
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {isLoadingStats ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStats.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Belum ada data
                </div>
              ) : singleStat ? (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-muted-foreground text-center uppercase tracking-wider">
                    {singleStat.materialName}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <StatBox label="Stock" value={singleStat.currentStock} color="primary" />
                    <StatBox label="Masuk" value={singleStat.totalIn} color="emerald" />
                    <StatBox label="Keluar" value={singleStat.totalOut} color="amber" />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/40">
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Material</th>
                        <th className="text-center py-3 px-4 font-semibold text-emerald-600 uppercase tracking-wider text-xs">Masuk</th>
                        <th className="text-center py-3 px-4 font-semibold text-amber-600 uppercase tracking-wider text-xs">Keluar</th>
                        <th className="text-center py-3 px-4 font-semibold text-primary uppercase tracking-wider text-xs">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredStats.map((s) => (
                        <tr
                          key={s.materialId}
                          className="hover:bg-muted/30 transition-colors cursor-pointer group"
                          onClick={() => setSelectedMaterialId(s.materialId)}
                        >
                          <td className="py-3.5 px-4 font-medium group-hover:text-primary transition-colors">{s.materialName}</td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-500">{s.totalIn}</td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-600 dark:text-amber-500">{s.totalOut}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center justify-center font-mono font-bold text-primary bg-primary/8 rounded-lg px-3 py-1 min-w-[48px]">
                              {s.currentStock}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-muted-foreground text-center py-2.5 bg-muted/20 border-t border-border/30">
                    Klik baris untuk lihat detail
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Aktivitas Terbaru */}
        <div className="lg:col-span-1">
          <Card className="h-full border-border/60 shadow-sm flex flex-col">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Aktivitas Terbaru
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto max-h-[520px]">
              {isLoadingActivity ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : recentActivity && recentActivity.length > 0 ? (
                <div className="divide-y divide-border/40">
                  {recentActivity.map((activity) => {
                    const isNonScan = activity.source === "non-scan";
                    const isIn = activity.type === "in";
                    const IconComp = isNonScan
                      ? (isIn ? PackagePlus : PackageMinus)
                      : (isIn ? ArrowDownRight : ArrowUpRight);
                    const label = isNonScan
                      ? (isIn ? "Material Masuk" : "Material Keluar")
                      : (isIn ? "Scan Masuk" : "Scan Keluar");
                    const colorClass = isIn
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";

                    return (
                      <div key={activity.id} className="px-4 py-3.5 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                        <div className={`mt-0.5 p-2 rounded-full shrink-0 ${colorClass}`}>
                          <IconComp className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 space-y-0.5 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold leading-none truncate">{label}</p>
                            <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                              {format(new Date(activity.createdAt), "HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            <span className="font-semibold text-foreground">
                              {activity.count} {isNonScan && (activity as any).satuan ? (activity as any).satuan : "item"}
                            </span>
                            {" — "}
                            <span className="font-mono text-xs">{activity.materialName || "-"}</span>
                          </p>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="font-mono text-[11px] bg-muted/70 px-1.5 py-0.5 rounded text-muted-foreground">
                              {isNonScan ? "Non-Scan" : (activity.boxLabel || "N/A")}
                            </span>
                            <span className="text-[11px] text-muted-foreground">· {activity.userName}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Belum ada aktivitas
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: "primary" | "emerald" | "amber" }) {
  const styles = {
    primary: {
      wrap: "bg-primary/5 border-primary/20",
      label: "text-muted-foreground",
      value: "text-primary",
    },
    emerald: {
      wrap: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/20",
      label: "text-muted-foreground",
      value: "text-emerald-600 dark:text-emerald-500",
    },
    amber: {
      wrap: "bg-amber-50 dark:bg-amber-950/20 border-amber-500/20",
      label: "text-muted-foreground",
      value: "text-amber-600 dark:text-amber-500",
    },
  }[color];

  return (
    <div className={`flex flex-col items-center justify-center p-6 rounded-xl border ${styles.wrap}`}>
      <span className={`text-xs font-semibold uppercase tracking-wider mb-2 ${styles.label}`}>{label}</span>
      <span className={`text-5xl font-bold font-mono ${styles.value}`}>{value}</span>
    </div>
  );
}
