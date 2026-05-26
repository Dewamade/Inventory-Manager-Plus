import { useState } from "react";
import { useListHistory, useDeleteHistory } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  
  const { data: history, isLoading, refetch } = useListHistory({
    query: {
      type: filterType === "all" ? undefined : filterType
    }
  });

  const deleteHistoryMutation = useDeleteHistory();

  const handleExportXLSX = () => {
    if (!history || history.length === 0) return;
    
    const ws = XLSX.utils.json_to_sheet(history.map(h => ({
      ID: h.id,
      Type: h.type === 'in' ? 'Masuk' : 'Keluar',
      Date: format(new Date(h.createdAt), "yyyy-MM-dd HH:mm:ss"),
      Material: h.materialName || '-',
      BoxLabel: h.boxLabel || '-',
      Operator: h.userName,
      ItemCount: h.serialNumbers.length,
      SerialNumbers: h.serialNumbers.join(", ")
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Riwayat");
    XLSX.writeFile(wb, `Riwayat_MIG_${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!history || history.length === 0) return;
    toast({ title: "Exporting PDF...", description: "This might take a moment." });
    
    // Simple PDF implementation
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Laporan Riwayat Transaksi", 14, 20);
    doc.setFontSize(10);
    
    let y = 30;
    history.forEach((h, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${i+1}. ${h.type === 'in' ? 'MASUK' : 'KELUAR'} | ${format(new Date(h.createdAt), "yyyy-MM-dd HH:mm")} | Box: ${h.boxLabel || '-'} | Operator: ${h.userName}`, 14, y);
      y += 6;
      doc.setTextColor(100);
      const snStr = h.serialNumbers.join(", ");
      const lines = doc.splitTextToSize(`SN: ${snStr}`, 180);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 4;
      doc.setTextColor(0);
    });
    
    doc.save(`Riwayat_MIG_${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  const handlePrintQR = async () => {
    const inRecords = history?.filter(h => h.type === 'in' && h.serialNumbers.length > 0);
    if (!inRecords || inRecords.length === 0) {
      toast({ title: "No data", description: "No Scan-In records to print.", variant: "destructive" });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let html = `
      <html>
      <head>
        <title>Print QR Box Labels</title>
        <style>
          body { font-family: monospace; padding: 20px; }
          .card { border: 2px dashed #000; padding: 20px; margin-bottom: 20px; text-align: center; width: 300px; display: inline-block; margin-right: 20px; break-inside: avoid; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .meta { font-size: 14px; margin-bottom: 10px; }
          img { width: 250px; height: 250px; }
          @media print { .card { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
    `;

    for (const record of inRecords) {
      const qrText = record.serialNumbers.join('\n');
      const dataUrl = await QRCode.toDataURL(qrText, { margin: 1 });
      html += `
        <div class="card">
          <div class="title">${record.boxLabel}</div>
          <div class="meta">${record.materialName}<br>Items: ${record.serialNumbers.length}<br>${format(new Date(record.createdAt), "dd/MM/yyyy HH:mm")}</div>
          <img src="${dataUrl}" />
        </div>
      `;
    }

    html += `</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this record? This action cannot be undone.")) {
      try {
        await deleteHistoryMutation.mutateAsync({ id });
        toast({ title: "Record deleted" });
        refetch();
      } catch (error) {
        toast({ title: "Delete failed", variant: "destructive" });
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <History className="w-8 h-8 text-primary" />
            Transaction History
          </h2>
          <p className="text-muted-foreground mt-1">View, filter, and export all warehouse transactions.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrintQR}>
            <Printer className="w-4 h-4 mr-2" /> Print QR Labels
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <FileDown className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button variant="default" onClick={handleExportXLSX} className="bg-emerald-600 hover:bg-emerald-700">
            <FileDown className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      <Card className="border-sidebar-border shadow-sm">
        <CardHeader className="py-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between">
             <CardTitle className="text-base font-semibold">Filters</CardTitle>
             <div className="flex gap-2">
               <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                 <SelectTrigger className="w-[150px]">
                   <SelectValue placeholder="Type" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Types</SelectItem>
                   <SelectItem value="in">Masuk (In)</SelectItem>
                   <SelectItem value="out">Keluar (Out)</SelectItem>
                 </SelectContent>
               </Select>
             </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center items-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mr-2" /> Loading history...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Box Label</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead>Operator</TableHead>
                    {user?.role === 'master' && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    history?.map((record) => (
                      <TableRow key={record.id} className="hover:bg-muted/10">
                        <TableCell>
                          {record.type === 'in' ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 px-2 py-1">
                              <ArrowDownRight className="w-3 h-3 mr-1" /> Masuk
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 px-2 py-1">
                              <ArrowUpRight className="w-3 h-3 mr-1" /> Keluar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{format(new Date(record.createdAt), "dd MMM yyyy, HH:mm")}</TableCell>
                        <TableCell className="font-mono font-medium">{record.boxLabel || '-'}</TableCell>
                        <TableCell>{record.materialName || '-'}</TableCell>
                        <TableCell className="text-center font-bold">{record.serialNumbers.length}</TableCell>
                        <TableCell>{record.userName}</TableCell>
                        {user?.role === 'master' && (
                          <TableCell className="text-right">
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
                    ))
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