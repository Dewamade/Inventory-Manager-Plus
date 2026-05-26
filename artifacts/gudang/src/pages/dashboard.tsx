import { useGetDashboardSummary, useGetMaterialStats, useGetRecentActivity, useListMaterials } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ArrowDownRight, ArrowUpRight, Activity, Loader2 } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function Dashboard() {
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | "all">("all");

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: materials } = useListMaterials();

  const { data: materialStatsRaw, isLoading: isLoadingStats } = useGetMaterialStats(
    selectedMaterialId === "all" ? {} : { query: { materialId: selectedMaterialId } }
  );

  const { data: recentActivity, isLoading: isLoadingActivity } = useGetRecentActivity({ limit: 10 });

  const statsArray = Array.isArray(materialStatsRaw) ? materialStatsRaw : materialStatsRaw ? [materialStatsRaw] : [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard Operations</h2>
          <p className="text-muted-foreground mt-1">Real-time overview of warehouse inventory.</p>
        </div>
      </div>

      {/* Global Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Stock"
          value={summary?.totalStock ?? 0}
          icon={Package}
          isLoading={isLoadingSummary}
          className="border-primary/50 bg-primary/5"
        />
        <MetricCard
          title="Total Masuk"
          value={summary?.totalMaterialIn ?? 0}
          icon={ArrowDownRight}
          isLoading={isLoadingSummary}
          className="border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20"
          valueClass="text-emerald-600 dark:text-emerald-500"
        />
        <MetricCard
          title="Total Keluar"
          value={summary?.totalMaterialOut ?? 0}
          icon={ArrowUpRight}
          isLoading={isLoadingSummary}
          className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20"
          valueClass="text-amber-600 dark:text-amber-500"
        />
        <MetricCard
          title="Jenis Material"
          value={summary?.totalMaterials ?? 0}
          icon={Activity}
          isLoading={isLoadingSummary}
        />
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-sidebar-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-xl font-semibold">Stok per Material</CardTitle>
              <div className="w-[200px]">
                <Select
                  value={selectedMaterialId.toString()}
                  onValueChange={(val) => setSelectedMaterialId(val === "all" ? "all" : parseInt(val))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Material" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Material</SelectItem>
                    {materials?.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>{m.code} - {m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="h-[200px] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : statsArray.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">Belum ada data</div>
              ) : selectedMaterialId !== "all" && statsArray.length === 1 ? (
                /* Single material view */
                <div className="grid gap-6 sm:grid-cols-3 p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex flex-col items-center justify-center p-4 bg-card rounded-md shadow-sm border border-border">
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stock</span>
                    <span className="text-4xl font-bold font-mono text-primary">{statsArray[0].currentStock}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 bg-card rounded-md shadow-sm border border-border">
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Masuk</span>
                    <span className="text-4xl font-bold font-mono text-emerald-600 dark:text-emerald-500">{statsArray[0].totalIn}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 bg-card rounded-md shadow-sm border border-border">
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Keluar</span>
                    <span className="text-4xl font-bold font-mono text-amber-600 dark:text-amber-500">{statsArray[0].totalOut}</span>
                  </div>
                </div>
              ) : (
                /* All materials table view */
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Material</th>
                        <th className="text-center py-3 px-4 font-semibold text-emerald-600 uppercase tracking-wider text-xs">Masuk</th>
                        <th className="text-center py-3 px-4 font-semibold text-amber-600 uppercase tracking-wider text-xs">Keluar</th>
                        <th className="text-center py-3 px-4 font-semibold text-primary uppercase tracking-wider text-xs">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {statsArray.map((s) => (
                        <tr key={s.materialId} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium">{s.materialName}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-500">{s.totalIn}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-amber-600 dark:text-amber-500">{s.totalOut}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-primary">{s.currentStock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="h-full border-sidebar-border shadow-sm flex flex-col">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Aktivitas Terbaru
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto max-h-[500px]">
              {isLoadingActivity ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : recentActivity && recentActivity.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="p-4 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                      <div className={`mt-0.5 p-2 rounded-full ${activity.type === 'in' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                        {activity.type === 'in' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium leading-none">
                            {activity.type === 'in' ? 'Scan Masuk' : 'Scan Keluar'}
                          </p>
                          <span className="text-xs text-muted-foreground font-mono">
                            {format(new Date(activity.createdAt), "HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{activity.count} items</span> — <span className="font-mono">{activity.materialName || 'Unknown'}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Box: <span className="font-mono bg-muted px-1 py-0.5 rounded">{activity.boxLabel || 'N/A'}</span> · {activity.userName}
                        </p>
                      </div>
                    </div>
                  ))}
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

function MetricCard({ title, value, icon: Icon, isLoading, className = "", valueClass = "" }: any) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wider">{title}</CardTitle>
        <Icon className="h-4 w-4 opacity-70" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-8 flex items-center">
            <Skeleton className="h-6 w-20" />
          </div>
        ) : (
          <div className={`text-3xl font-bold font-mono tracking-tight ${valueClass}`}>{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}
