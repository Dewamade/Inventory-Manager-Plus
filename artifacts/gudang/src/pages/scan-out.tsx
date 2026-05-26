import { useState, useRef, useEffect, useCallback } from "react";
import { useCreateScanOut, useAddScanOutItem, useListScanOut, getListScanOutQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Trash2, Camera, Keyboard, CheckCircle2, Play, Square, Loader2, ArrowUpRight, Package } from "lucide-react";
import jsQR from "jsqr";
import { useQueryClient } from "@tanstack/react-query";

export default function ScanOutView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Session state
  const [activeSession, setActiveSession] = useState<any>(null);
  const [scannedBoxes, setScannedBoxes] = useState<any[]>([]);

  // Scanning state
  const [scanMethod, setScanMethod] = useState<"camera" | "manual">("manual");
  const [manualInput, setManualInput] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const lastScanTime = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const createScanOutMutation = useCreateScanOut();
  const addItemMutation = useAddScanOutItem();

  useEffect(() => {
    setAudioContext(new (window.AudioContext || (window as any).webkitAudioContext)());
  }, []);

  const playBeep = useCallback((success = true) => {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = success ? "sine" : "sawtooth";
    oscillator.frequency.setValueAtTime(success ? 800 : 200, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + (success ? 0.1 : 0.3));
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  }, [audioContext]);

  const handleStartSession = async () => {
    if (!user) return;
    try {
      const result = await createScanOutMutation.mutateAsync({
        data: { userId: user.id }
      });
      setActiveSession(result);
      setScannedBoxes([]);
      if (scanMethod === "manual") {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (error) {
      toast({
        title: "Failed to start session",
        variant: "destructive"
      });
    }
  };

  const handleScanBox = async (qrData: string) => {
    if (!activeSession) return;
    const data = qrData.trim();
    if (!data) return;

    try {
      // The backend expects the raw QR data string (which contains newline-separated SNs)
      const result = await addItemMutation.mutateAsync({
        id: activeSession.id,
        data: { qrData: data }
      });
      
      // We don't get the full box info back easily from the generic item add, 
      // but we know it succeeded. Let's just track the scan locally for UX.
      const snCount = data.split('\n').filter(l => l.trim()).length;
      
      setScannedBoxes(prev => [{
        id: Date.now(), 
        count: snCount,
        data: data.slice(0, 20) + '...',
        time: new Date()
      }, ...prev]);
      
      playBeep(true);
      setManualInput("");
      toast({
        title: "Box Scanned Successfully",
        description: `${snCount} items marked for dispatch.`,
      });
      
      if (scanMethod === "manual") {
        inputRef.current?.focus();
      }
    } catch (error: any) {
      playBeep(false);
      toast({
        title: "Scan failed",
        description: error?.message || "Invalid QR, box not found, or already dispatched.",
        variant: "destructive"
      });
    }
  };

  const handleCompleteSession = () => {
    setActiveSession(null);
    setScannedBoxes([]);
    stopCamera();
    queryClient.invalidateQueries({ queryKey: getListScanOutQueryKey() });
    toast({
      title: "Dispatch Session Completed",
    });
  };

  // Camera handling (simplified, same as scan-in)
  const startCamera = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.play();
          setIsCameraActive(true);
          requestRef.current = requestAnimationFrame(tick);
        }
      } catch (err) {
        toast({ title: "Camera Error", variant: "destructive" });
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  };

  const tick = () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code) {
          const now = Date.now();
          if (now - lastScanTime.current > 2000) {
            lastScanTime.current = now;
            handleScanBox(code.data);
          }
        }
      }
    }
    if (isCameraActive) requestRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (scanMethod === "camera" && activeSession) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [scanMethod, activeSession]);


  return (
    <div className="grid gap-6 md:grid-cols-12">
      <div className="md:col-span-5 lg:col-span-4 space-y-6">
        <Card className="border-amber-500/30 shadow-sm">
          <CardHeader className="bg-amber-50/50 dark:bg-amber-950/20 border-b border-border/50">
            <CardTitle className="text-amber-700 dark:text-amber-500 flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5" /> Dispatch Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {!activeSession ? (
              <Button 
                onClick={handleStartSession} 
                disabled={createScanOutMutation.isPending}
                className="w-full h-14 uppercase tracking-wide font-bold bg-amber-600 hover:bg-amber-700 text-white"
              >
                {createScanOutMutation.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />}
                Start Dispatch
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg border border-border space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Boxes Dispatched</p>
                    <p className="text-3xl font-bold font-mono text-amber-600">{scannedBoxes.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Items Total</p>
                    <p className="text-xl font-bold">{scannedBoxes.reduce((acc, curr) => acc + curr.count, 0)}</p>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  onClick={handleCompleteSession}
                  className="w-full h-12 uppercase tracking-wide font-bold"
                >
                  <Square className="w-5 h-5 mr-2 fill-current" />
                  Finish Dispatch
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {activeSession && (
          <Card className="border-sidebar-border">
            <CardContent className="p-4">
              <div className="flex rounded-md shadow-sm">
                <Button variant={scanMethod === "manual" ? "default" : "outline"} className="flex-1 rounded-r-none" onClick={() => setScanMethod("manual")}>
                  <Keyboard className="w-4 h-4 mr-2" /> Manual
                </Button>
                <Button variant={scanMethod === "camera" ? "default" : "outline"} className="flex-1 rounded-l-none" onClick={() => setScanMethod("camera")}>
                  <Camera className="w-4 h-4 mr-2" /> Camera
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="md:col-span-7 lg:col-span-8">
        <Card className="h-full min-h-[500px] flex flex-col border-sidebar-border shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4 bg-muted/20">
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Scan Box QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {!activeSession ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                <Package className="w-24 h-24 mb-4 opacity-20" />
                <p className="text-lg text-center max-w-sm">Start a dispatch session to scan completed boxes out of the warehouse.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-border/50 bg-amber-50/30 dark:bg-amber-950/10">
                  {scanMethod === "manual" ? (
                    <form 
                      onSubmit={(e) => { e.preventDefault(); handleScanBox(manualInput); }}
                      className="flex gap-2"
                    >
                      <Input
                        ref={inputRef}
                        placeholder="Paste full QR data..."
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        className="h-14 font-mono"
                        autoFocus
                      />
                      <Button type="submit" className="h-14 px-6 bg-amber-600 hover:bg-amber-700 text-white" disabled={!manualInput || addItemMutation.isPending}>
                        Dispatch Box
                      </Button>
                    </form>
                  ) : (
                    <div className="relative w-full max-w-md mx-auto aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center">
                      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 border-[3px] border-amber-500/50 z-10 m-8 rounded">
                         <div className="absolute inset-0 bg-amber-500/10 animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-auto p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                    Dispatched Boxes log
                  </h3>
                  <div className="space-y-3">
                    {scannedBoxes.length === 0 && (
                       <div className="text-center p-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                         Awaiting box scan
                       </div>
                    )}
                    {scannedBoxes.map((box) => (
                      <div key={box.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-lg shadow-sm animate-in slide-in-from-left-2">
                        <div className="flex items-center gap-4">
                          <div className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 p-2 rounded-md">
                            <Package className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-semibold">{box.count} items</p>
                            <p className="text-xs text-muted-foreground font-mono">{box.data}</p>
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}