import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Database, Package2, Users2, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
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
        <TabsList className="h-12 w-full max-w-md grid grid-cols-2">
          <TabsTrigger value="materials" className="text-base">
            <Package2 className="w-4 h-4 mr-2" /> Materials
          </TabsTrigger>
          <TabsTrigger value="users" className="text-base">
            <Users2 className="w-4 h-4 mr-2" /> Users
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="materials" className="mt-6">
          <MaterialsTab />
        </TabsContent>
        
        <TabsContent value="users" className="mt-6">
          <UsersTab />
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
  const [formData, setFormData] = useState({ name: "", code: "", description: "" });

  const handleOpen = (material?: any) => {
    if (material) {
      setEditingId(material.id);
      setFormData({ name: material.name, code: material.code, description: material.description || "" });
    } else {
      setEditingId(null);
      setFormData({ name: "", code: "", description: "" });
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
                <DialogTitle>{editingId ? "Edit Material" : "New Material"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Code / SKU</Label>
                  <Input 
                    value={formData.code} 
                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} 
                    placeholder="e.g. MTR-001"
                    className="font-mono uppercase"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="Material Name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Input 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Save Changes" : "Create Material"}
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
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials?.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono font-bold">{m.code}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
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