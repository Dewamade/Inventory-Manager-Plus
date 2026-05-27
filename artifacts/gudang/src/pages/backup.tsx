import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, DatabaseBackup, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Backup() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreResult, setRestoreResult] = useState<any>(null);

  if (user?.role !== "master") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground gap-4">
        <ShieldAlert className="w-16 h-16 opacity-30" />
        <p className="text-lg">Access restricted to Admin (Master) only.</p>
      </div>
    );
  }

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch("/api/backup", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Backup failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${format(new Date(), "yyyyMMdd_HHmmss")}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setLastBackup(new Date().toISOString());
      toast({ title: "Backup berhasil", description: "File backup telah diunduh." });
    } catch (err: any) {
      toast({ title: "Backup gagal", description: err?.message, variant: "destructive" });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setRestoreResult(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;

    const confirmed = window.confirm(
      "⚠️ PERINGATAN: Restore akan menghapus SEMUA data yang ada dan menggantinya dengan data dari file backup.\n\nLanjutkan?"
    );
    if (!confirmed) return;

    setIsRestoring(true);
    setRestoreResult(null);

    try {
      const text = await restoreFile.text();
      const backup = JSON.parse(text);

      const res = await fetch("/api/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(backup),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Restore failed");
      }

      setRestoreResult(result.restored);
      toast({ title: "Restore berhasil!", description: "Database telah dipulihkan dari backup." });
    } catch (err: any) {
      toast({ title: "Restore gagal", description: err?.message, variant: "destructive" });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <DatabaseBackup className="w-8 h-8 text-primary" />
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Backup & Restore</h2>
          <p className="text-muted-foreground mt-1">Export and import your full database.</p>
        </div>
      </div>

      {/* Backup Card */}
      <Card className="border-emerald-500/30 shadow-sm">
        <CardHeader className="bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-border/50">
          <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Download className="w-5 h-5" /> Export Backup
          </CardTitle>
          <CardDescription>
            Download a complete snapshot of all database data as a JSON file.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="bg-muted/40 rounded-lg p-4 text-sm text-muted-foreground space-y-1 border border-border">
            <p>File backup mencakup:</p>
            <ul className="list-disc list-inside space-y-0.5 mt-2">
              <li>Semua pengguna (dengan password terenkripsi)</li>
              <li>Semua material (termasuk kategori)</li>
              <li>Semua sesi scan-in dan item</li>
              <li>Semua sesi scan-out</li>
              <li>Semua data material masuk (non-scan)</li>
              <li>Semua data material keluar (non-scan)</li>
            </ul>
          </div>
          {lastBackup && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Last backup: {format(new Date(lastBackup), "dd MMM yyyy, HH:mm:ss")}
            </p>
          )}
          <Button
            onClick={handleBackup}
            disabled={isBackingUp}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wide"
          >
            {isBackingUp ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creating Backup...</>
            ) : (
              <><Download className="w-5 h-5 mr-2" /> Download Backup</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Restore Card */}
      <Card className="border-amber-500/30 shadow-sm">
        <CardHeader className="bg-amber-50/50 dark:bg-amber-950/20 border-b border-border/50">
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Upload className="w-5 h-5" /> Import / Restore
          </CardTitle>
          <CardDescription>
            Restore database from a previously exported backup file.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/20 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-400">
            <p className="font-semibold flex items-center gap-1"><ShieldAlert className="w-4 h-4" /> Warning</p>
            <p className="mt-1">Restoring will permanently delete all current data and replace it with the backup contents. This cannot be undone.</p>
          </div>

          {/* File picker */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
            onClick={() => document.getElementById("restore-file-input")?.click()}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            {restoreFile ? (
              <div>
                <p className="font-medium text-foreground">{restoreFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{(restoreFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground">Click to select backup file</p>
                <p className="text-xs text-muted-foreground mt-1">.json files only</p>
              </div>
            )}
            <input
              id="restore-file-input"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Restore result */}
          {restoreResult && (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Restore Berhasil
              </p>
              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                <span>Users dipulihkan:</span><span className="font-mono font-bold text-foreground">{restoreResult.users}</span>
                <span>Material dipulihkan:</span><span className="font-mono font-bold text-foreground">{restoreResult.materials}</span>
                <span>Sesi scan-in:</span><span className="font-mono font-bold text-foreground">{restoreResult.scanIns}</span>
                <span>Item scan:</span><span className="font-mono font-bold text-foreground">{restoreResult.scanItems}</span>
                <span>Sesi scan-out:</span><span className="font-mono font-bold text-foreground">{restoreResult.scanOuts}</span>
                <span>Material masuk (non-scan):</span><span className="font-mono font-bold text-foreground">{restoreResult.nonScanMasuk ?? 0}</span>
                <span>Material keluar (non-scan):</span><span className="font-mono font-bold text-foreground">{restoreResult.nonScanKeluar ?? 0}</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleRestore}
            disabled={!restoreFile || isRestoring}
            className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase tracking-wide"
          >
            {isRestoring ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Restoring...</>
            ) : (
              <><Upload className="w-5 h-5 mr-2" /> Restore from Backup</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
