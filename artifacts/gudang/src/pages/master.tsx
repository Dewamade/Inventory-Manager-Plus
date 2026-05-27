import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Database, Package2, Users2, Plus, Pencil, Trash2, Loader2, DatabaseBackup, Download, Upload, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useListMaterials, useCreateMaterial, useUpdateMaterial, useDeleteMaterial, 
         useListUsers, useCreateUser, useUpdateUser, useDeleteUser, getListMaterialsQueryKey, getListUsersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";

export default function Master() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Database className="w-8 h-8 text-primary" />
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Master Data</h2>
          <p className="text-muted-foreground mt-1">Manage core system entities.</p>
        </div>
      </div>

      <Tabs defaultValue="materials" className="w-full">
        <TabsList className="h-12 w-full max-w-xl grid grid-cols-3">
          <TabsTrigger value="materials" className="text-base">
            <Package2 className="w-4 h-4 mr-2" /> Materials
          </TabsTrigger>
          <TabsTrigger value="users" className="text-base">
            <Users2 className="w-4 h-4 mr-2" /> Users
          </TabsTrigger>
          <TabsTrigger value="backup" className="text-base">
            <DatabaseBackup className="w-4 h-4 mr-2" /> Backup
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="materials" className="mt-6">
          <MaterialsTab />
        </TabsContent>
        
        <TabsContent value="users" className="mt-6">
          <UsersTab />
        </TabsContent>

        <TabsContent value="backup" className="mt-6">
          <BackupTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MaterialsTab() {
  const { data: materials, isLoading } = useListMaterials();
  const createMutation = useCreateMaterial();
  const updateMutation = useUpdateMaterial();
  const deleteMutation = useDeleteMaterial();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "", description: "", kategori: "scan" as "scan" | "non-scan" });

  const handleOpen = (material?: any) => {
    if (material) {
      setEditingId(material.id);
      setFormData({ name: material.name, code: material.code, description: material.description || "", kategori: material.kategori ?? "scan" });
    } else {
      setEditingId(null);
      setFormData({ name: "", code: "", description: "", kategori: "scan" });
    }
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: formData });
        toast({ title: "Material updated" });
      } else {
        await createMutation.mutateAsync({ data: formData });
        toast({ title: "Material created" });
      }
      queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
      setIsOpen(false);
    } catch (error) {
      toast({ title: "Operation failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this material?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
        toast({ title: "Material deleted" });
      } catch (error) {
        toast({ title: "Delete failed", variant: "destructive" });
      }
    }
  };

  return (
    <Card className="border-sidebar-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4 bg-muted/20">
        <div>
          <CardTitle>Material Catalog</CardTitle>
          <CardDescription>Manage materials that can be scanned.</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpen()} className="uppercase tracking-wide font-bold">
              <Plus className="w-4 h-4 mr-2" /> Add Material
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Material" : "Tambah Material"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nama Material</Label>
                  <Input 
                    value={formData.code} 
                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} 
                    placeholder="contoh: MCB 4A"
                    className="font-mono uppercase"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Normalisasi</Label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="contoh: 3250032"
                    required
                    className="bg-[transparent]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deskripsi (Opsional)</Label>
                  <Input 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kategori Material</Label>
                  <Select value={formData.kategori} onValueChange={(v: "scan" | "non-scan") => setFormData({...formData, kategori: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scan">Scan (Serial Number / Barcode)</SelectItem>
                      <SelectItem value="non-scan">Non-Scan (Manual / Satuan)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.kategori === "scan" 
                      ? "Muncul di menu Scan Material untuk scan barcode/QR" 
                      : "Muncul di menu Material Masuk/Keluar untuk input manual"}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Save Changes" : "Buat Material"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials?.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono font-bold">{m.code}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${(m as any).kategori === 'non-scan' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                      {(m as any).kategori ?? 'scan'}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.description || '-'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpen(m)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}


function UsersTab() {
  const { data: users, isLoading } = useListUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ username: "", password: "", role: "user" as "master" | "user" });

  const handleOpen = (user?: any) => {
    if (user) {
      setEditingId(user.id);
      setFormData({ username: user.username, password: "", role: user.role });
    } else {
      setEditingId(null);
      setFormData({ username: "", password: "", role: "user" });
    }
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const payload: any = { username: formData.username, role: formData.role };
        if (formData.password) payload.password = formData.password;
        await updateMutation.mutateAsync({ id: editingId, data: payload });
        toast({ title: "User updated" });
      } else {
        if (!formData.password) {
          toast({ title: "Password required for new user", variant: "destructive" });
          return;
        }
        await createMutation.mutateAsync({ data: formData });
        toast({ title: "User created" });
      }
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setIsOpen(false);
    } catch (error) {
      toast({ title: "Operation failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this user?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "User deleted" });
      } catch (error) {
        toast({ title: "Delete failed", variant: "destructive" });
      }
    }
  };

  return (
    <Card className="border-sidebar-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4 bg-muted/20">
        <div>
          <CardTitle>System Users</CardTitle>
          <CardDescription>Manage operator and master access.</CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpen()} className="uppercase tracking-wide font-bold">
              <Plus className="w-4 h-4 mr-2" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit User" : "New User"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input 
                    value={formData.username} 
                    onChange={e => setFormData({...formData, username: e.target.value})} 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{editingId ? "New Password (Optional)" : "Password"}</Label>
                  <Input 
                    type="password"
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                    required={!editingId}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={formData.role} onValueChange={(v: "master"|"user") => setFormData({...formData, role: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Operator (User)</SelectItem>
                      <SelectItem value="master">Admin (Master)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Save Changes" : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium font-mono">{u.username}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${u.role === 'master' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpen(u)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(u.id)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}


function BackupTab() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreResult, setRestoreResult] = useState<any>(null);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch("/api/backup", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Backup gagal");
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
        throw new Error(result.error || "Restore gagal");
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
    <div className="space-y-6 max-w-2xl">
      {/* Export Backup Card */}
      <Card className="border-emerald-500/30 shadow-sm">
        <CardHeader className="bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-border/50">
          <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Download className="w-5 h-5" /> Export Backup
          </CardTitle>
          <CardDescription>
            Download snapshot lengkap semua data database sebagai file JSON.
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
              Backup terakhir: {format(new Date(lastBackup), "dd MMM yyyy, HH:mm:ss")}
            </p>
          )}
          <Button
            onClick={handleBackup}
            disabled={isBackingUp}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wide"
          >
            {isBackingUp ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Membuat Backup...</>
            ) : (
              <><Download className="w-5 h-5 mr-2" /> Download Backup</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Import / Restore Card */}
      <Card className="border-amber-500/30 shadow-sm">
        <CardHeader className="bg-amber-50/50 dark:bg-amber-950/20 border-b border-border/50">
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Upload className="w-5 h-5" /> Import / Restore
          </CardTitle>
          <CardDescription>
            Pulihkan database dari file backup yang sebelumnya diekspor.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/20 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-400">
            <p className="font-semibold flex items-center gap-1"><ShieldAlert className="w-4 h-4" /> Peringatan</p>
            <p className="mt-1">Restore akan menghapus semua data saat ini dan menggantinya dengan isi backup. Tindakan ini tidak dapat dibatalkan.</p>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
            onClick={() => document.getElementById("master-restore-file-input")?.click()}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            {restoreFile ? (
              <div>
                <p className="font-medium text-foreground">{restoreFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{(restoreFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground">Klik untuk memilih file backup</p>
                <p className="text-xs text-muted-foreground mt-1">hanya file .json</p>
              </div>
            )}
            <input
              id="master-restore-file-input"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

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
              </div>
            </div>
          )}

          <Button
            onClick={handleRestore}
            disabled={!restoreFile || isRestoring}
            className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase tracking-wide"
          >
            {isRestoring ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Memulihkan...</>
            ) : (
              <><Upload className="w-5 h-5 mr-2" /> Restore dari Backup</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
