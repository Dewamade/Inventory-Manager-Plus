import { useState, useMemo } from "react";
import { useListHistory, useDeleteHistory } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { History, FileDown, Printer, Trash2, ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { useToast } from "@/hooks/use-toast";

export default function Riwayat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: history, isLoading, refetch } = useListHistory({
    query: {
      type: filterType === "all" ? undefined : filterType
    }
  });

  const deleteHistoryMutation = useDeleteHistory();

  // Effective records = selected ones if any selected, else all
  const effectiveRecords = useMemo(() => {
    if (!history) return [];
    if (selectedIds.size === 0) return history;
    return history.filter(h => selectedIds.has(h.id));
  }, [history, selectedIds]);

  const allIds = useMemo(() => history?.map(h => h.id) ?? [], [history]);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectionLabel = selectedIds.size > 0
    ? `${selectedIds.size} dipilih`
    : `Semua (${history?.length ?? 0})`;

  const handleExportXLSX = () => {
    if (effectiveRecords.length === 0) {
      toast({ title: "Tidak ada data", variant: "destructive" });
      return;
    }

    // Expand: one row per serial number
    const rows: object[] = [];
    effectiveRecords.forEach(h => {
      if (h.serialNumbers.length === 0) {
        rows.push({
          Tipe: h.type === 'in' ? 'Masuk' : 'Keluar',
          Tanggal: format(new Date(h.createdAt), "yyyy-MM-dd HH:mm:ss"),
          Material: h.materialName || '-',
          BoxLabel: h.boxLabel || '-',
          Operator: h.userName,
          SerialNumber: '-',
        });
      } else {
        h.serialNumbers.forEach((sn, idx) => {
          rows.push({
            Tipe: idx === 0 ? (h.type === 'in' ? 'Masuk' : 'Keluar') : '',
            Tanggal: idx === 0 ? format(new Date(h.createdAt), "yyyy-MM-dd HH:mm:ss") : '',
            Material: idx === 0 ? (h.materialName || '-') : '',
            BoxLabel: idx === 0 ? (h.boxLabel || '-') : '',
            Operator: idx === 0 ? h.userName : '',
            SerialNumber: sn,
          });
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto column widths
    ws['!cols'] = [
      { wch: 8 }, { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Riwayat");
    XLSX.writeFile(wb, `Riwayat_MIG_${format(new Date(), "yyyyMMdd")}.xlsx`);
    const totalSN = effectiveRecords.reduce((s, h) => s + h.serialNumbers.length, 0);
    toast({ title: `Export Excel berhasil`, description: `${effectiveRecords.length} box, ${totalSN} serial number.` });
  };

  const handleExportPDF = () => {
    if (effectiveRecords.length === 0) {
      toast({ title: "Tidak ada data", variant: "destructive" });
      return;
    }
    toast({ title: "Membuat PDF...", description: "Harap tunggu sebentar." });

    const doc = new jsPDF();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const lineH = 5;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Laporan Riwayat Transaksi", margin, 18);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Manajemen Inventori Gudang  |  Dicetak: ${format(new Date(), "dd/MM/yyyy HH:mm")}  |  ${effectiveRecords.length} record`, margin, 25);
    doc.setTextColor(0);

    let y = 33;

    const checkPage = (needed: number) => {
      if (y + needed > pageH - 10) {
        doc.addPage();
        y = 16;
      }
    };

    effectiveRecords.forEach((h, i) => {
      checkPage(16);

      // Box header row
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      const tipe = h.type === 'in' ? 'MASUK' : 'KELUAR';
      doc.text(`${i + 1}.  [${tipe}]  ${h.boxLabel || '-'}  —  ${h.materialName || '-'}`, margin, y);
      y += lineH;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.text(`${format(new Date(h.createdAt), "dd/MM/yyyy HH:mm")}   Operator: ${h.userName}   (${h.serialNumbers.length} item)`, margin + 4, y);
      y += lineH - 0.5;
      doc.setTextColor(0);

      // Serial numbers — one per row
      if (h.serialNumbers.length > 0) {
        doc.setFontSize(8);
        h.serialNumbers.forEach((sn, idx) => {
          checkPage(5);
          doc.setTextColor(50);
          doc.text(`${String(idx + 1).padStart(3, ' ')}.  ${sn}`, margin + 6, y);
          doc.setTextColor(0);
          y += lineH - 0.5;
        });
      }

      y += 3; // gap between boxes
    });

    doc.save(`Riwayat_MIG_${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  const handlePrintQR = async () => {
    const inRecords = effectiveRecords.filter(h => h.type === 'in' && h.serialNumbers.length > 0);
    if (inRecords.length === 0) {
      toast({ title: "Tidak ada data Scan Masuk", description: "Pilih record Scan Masuk untuk cetak QR.", variant: "destructive" });
      return;
    }

    toast({ title: "Membuat halaman cetak...", description: `Menyiapkan ${inRecords.length} QR label.` });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let html = `
      <html>
      <head>
        <title>Cetak QR Box Labels</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: monospace; padding: 16px; background: #fff; }
          .grid { display: flex; flex-wrap: wrap; gap: 16px; }
          .card { border: 2px dashed #333; padding: 16px; text-align: center; width: 280px; break-inside: avoid; }
          .box-label { font-size: 20px; font-weight: bold; margin-bottom: 6px; }
          .meta { font-size: 12px; color: #555; margin-bottom: 10px; line-height: 1.5; }
          .qr img { width: 220px; height: 220px; }
          @media print {
            .card { page-break-inside: avoid; }
            @page { margin: 10mm; }
          }
        </style>
      </head>
      <body><div class="grid">
    `;

    for (const record of inRecords) {
      const qrText = record.serialNumbers.join('\n');
      const dataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 220 });
      html += `
        <div class="card">
          <div class="box-label">${record.boxLabel || '-'}</div>
          <div class="meta">
            ${record.materialName || '-'}<br/>
            ${record.serialNumbers.length} item<br/>
            ${format(new Date(record.createdAt), "dd/MM/yyyy HH:mm")}<br/>
            Operator: ${record.userName}
          </div>
          <div class="qr"><img src="${dataUrl}" /></div>
        </div>
      `;
    }

    html += `</div></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
  };

  const handleDelete = async (id: number) => {
    if (confirm("Yakin ingin menghapus record ini? Tindakan ini tidak bisa dibatalkan.")) {
      try {
        await deleteHistoryMutation.mutateAsync({ id });
        setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        toast({ title: "Record dihapus" });
        refetch();
      } catch {
        toast({ title: "Gagal menghapus", variant: "destructive" });
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <History className="w-8 h-8 text-primary" />
            Riwayat Transaksi
          </h2>
          <p className="text-muted-foreground mt-1">
            {selectedIds.size > 0
              ? <span className="text-primary font-medium">{selectedIds.size} record dipilih — export/cetak hanya yang dipilih</span>
              : "Pilih baris untuk export/cetak selektif, atau biarkan kosong untuk semua."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-muted-foreground text-xs">
              Batal pilih
            </Button>
          )}
          <Button variant="outline" onClick={handlePrintQR} title={`Cetak QR (${selectionLabel})`}>
            <Printer className="w-4 h-4 mr-2" /> Cetak QR
          </Button>
          <Button variant="outline" onClick={handleExportPDF} title={`Export PDF (${selectionLabel})`}>
            <FileDown className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button onClick={handleExportXLSX} className="bg-emerald-600 hover:bg-emerald-700 text-white" title={`Export Excel (${selectionLabel})`}>
            <FileDown className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      <Card className="border-sidebar-border shadow-sm">
        <CardHeader className="py-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base font-semibold">
              Filter & Tabel
              {selectedIds.size > 0 && (
                <Badge variant="secondary" className="ml-2 text-primary border-primary/30">
                  {selectedIds.size} dipilih
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={(v: any) => { setFilterType(v); setSelectedIds(new Set()); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="in">Masuk</SelectItem>
                  <SelectItem value="out">Keluar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center items-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mr-2" /> Memuat riwayat...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Pilih semua"
                        className={someSelected ? "data-[state=unchecked]:bg-primary/20" : ""}
                      />
                    </TableHead>
                    <TableHead className="w-[100px]">Tipe</TableHead>
                    <TableHead>Tanggal & Waktu</TableHead>
                    <TableHead>Box Label</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead>Operator</TableHead>
                    {user?.role === 'master' && <TableHead className="text-right pr-4">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!history || history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={user?.role === 'master' ? 8 : 7} className="h-32 text-center text-muted-foreground">
                        Tidak ada transaksi ditemukan
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((record) => {
                      const isSelected = selectedIds.has(record.id);
                      return (
                        <TableRow
                          key={record.id}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/10'}`}
                          onClick={() => toggleOne(record.id)}
                        >
                          <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(record.id)}
                              aria-label="Pilih baris ini"
                            />
                          </TableCell>
                          <TableCell>
                            {record.type === 'in' ? (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 px-2 py-1 whitespace-nowrap">
                                <ArrowDownRight className="w-3 h-3 mr-1" /> Masuk
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 px-2 py-1 whitespace-nowrap">
                                <ArrowUpRight className="w-3 h-3 mr-1" /> Keluar
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm whitespace-nowrap">{format(new Date(record.createdAt), "dd MMM yyyy, HH:mm")}</TableCell>
                          <TableCell className="font-mono font-medium">{record.boxLabel || '-'}</TableCell>
                          <TableCell>{record.materialName || '-'}</TableCell>
                          <TableCell className="text-center font-bold">{record.serialNumbers.length}</TableCell>
                          <TableCell>{record.userName}</TableCell>
                          {user?.role === 'master' && (
                            <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                                onClick={() => handleDelete(record.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
