import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanLine, Box, LogIn, LogOut } from "lucide-react";
import ScanInView from "./scan-in";
import ScanOutView from "./scan-out";

export default function Scan() {
  const [mode, setMode] = useState<"in" | "out">("in");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ScanLine className="w-8 h-8 text-primary" />
            Scanner Terminal
          </h2>
          <p className="text-muted-foreground mt-1">Scan materials in and out of the warehouse.</p>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "in" | "out")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-14 mb-6">
          <TabsTrigger value="in" className="text-base font-semibold uppercase tracking-wider data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/50 dark:data-[state=active]:text-emerald-400">
            <LogIn className="w-5 h-5 mr-2" />
            Scan Masuk
          </TabsTrigger>
          <TabsTrigger value="out" className="text-base font-semibold uppercase tracking-wider data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700 dark:data-[state=active]:bg-amber-900/50 dark:data-[state=active]:text-amber-400">
            <LogOut className="w-5 h-5 mr-2" />
            Scan Keluar
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="in" className="mt-0">
          <ScanInView />
        </TabsContent>
        
        <TabsContent value="out" className="mt-0">
          <ScanOutView />
        </TabsContent>
      </Tabs>
    </div>
  );
}