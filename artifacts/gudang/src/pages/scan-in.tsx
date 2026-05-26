import { useState, useRef, useEffect, useCallback } from "react";
import { useListMaterials, useCreateScanIn, useUpdateScanIn, useAddScanInItem, useDeleteScanInItem, useListScanIn, getListScanInQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Trash2, Camera, Keyboard, CheckCircle2, Play, Square, Loader2 } from "lucide-react";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { useQueryClient } from "@tanstack/react-query";

export default function ScanInView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  const { data: materials, isLoading: isLoadingMaterials } = useListMaterials();
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  
  // Session state
  const [activeSession, setActiveSession] = useState<any>(null);
  const [scannedItems, setScannedItems] = useState<{id: number, serialNumber: string}[]>([]);
  const [generatedQr, setGeneratedQr] = useState<string | null>(null);

  // Scanning state
  const [scanMethod, setScanMethod] = useState<"camera" | "manual">("manual");
  const [manualInput, setManualInput] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const lastScanTime = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const createScanInMutation = useCreateScanIn();
  const updateScanInMutation = useUpdateScanIn();
  const addItemMutation = useAddScanInItem();
  const deleteItemMutation = useDeleteScanInItem();

  // Initialize AudioContext
  useEffect(() => {
    setAudioContext(new (window.AudioContext || (window as any).webkitAudioContext)());
  }, []);

  const playBeep = useCallback((success = true) => {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(success ? 800 : 300, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  }, [audioContext]);

  // Handle Session Start
  const handleStartSession = async () => {
    if (!selectedMaterialId || !user) return;

    try {
      const result = await createScanInMutation.mutateAsync({
        data: {
          materialId: parseInt(selectedMaterialId),
          userId: user.id
        }
      });
      setActiveSession(result);
      setScannedItems([]);
      setGeneratedQr(null);
      
      // Auto focus input if manual
      if (scanMethod === "manual") {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (error) {
      toast({
        title: "Failed to start session",
        description: "An error occurred while creating the scan session.",
        variant: "destructive"
      });
    }
  };

  // Handle Item Scan
  const handleScanItem = async (serialNumber: string) => {
    if (!activeSession) return;
    const sn = serialNumber.trim();
    if (!sn) return;

    if (sn.length !== 28) {
      toast({
        title: "Invalid Serial Number",
        description: "Serial number must be exactly 28 characters.",
        variant: "destructive"
      });
      playBeep(false);
      return;
    }

    if (scannedItems.some(item => item.serialNumber === sn)) {
      toast({
        title: "Duplicate",
        description: "This item has already been scanned in this session.",
        variant: "destructive"
      });
      playBeep(false);
      return;
    }

    try {
      const item = await addItemMutation.mutateAsync({
        id: activeSession.id,
        data: { serialNumber: sn }
      });
      
      setScannedItems(prev => [item, ...prev]);
      playBeep(true);
      setManualInput("");
      
      if (scanMethod === "manual") {
        inputRef.current?.focus();
      }
    } catch (error: any) {
      playBeep(false);
      toast({
        title: "Scan failed",
        description: error?.message || "Failed to add item. It might be a duplicate.",
        variant: "destructive"
      });
    }
  };

  // Handle Delete Item
  const handleDeleteItem = async (itemId: number) => {
    if (!activeSession) return;
    
    try {
      await deleteItemMutation.mutateAsync({
        scanInId: activeSession.id,
        itemId
      });
      setScannedItems(prev => prev.filter(i => i.id !== itemId));
      toast({ title: "Item removed" });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to remove item",
        variant: "destructive"
      });
    }
  };

  // Handle Complete Session
  const handleCompleteSession = async () => {
    if (!activeSession) return;
    if (scannedItems.length === 0) {
      toast({
        title: "Cannot complete",
        description: "Scan at least one item before completing.",
        variant: "destructive"
      });
      return;
    }

    try {
      const qrText = scannedItems.map(i => i.serialNumber).join('\n');
      const qrDataUrl = await QRCode.toDataURL(qrText, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 300
      });

      await updateScanInMutation.mutateAsync({
        id: activeSession.id,
        data: {
          status: "completed",
          qrCodeData: qrDataUrl
        }
      });

      setGeneratedQr(qrDataUrl);
      queryClient.invalidateQueries({ queryKey: getListScanInQueryKey() });
      toast({
        title: "Session Completed",
        description: `Successfully scanned ${scannedItems.length} items.`,
      });
      stopCamera();
    } catch (error) {
      toast({
        title: "Failed to complete",
        description: "An error occurred while completing the session.",
        variant: "destructive"
      });
    }
  };

  const handleReset = () => {
    setActiveSession(null);
    setScannedItems([]);
    setGeneratedQr(null);
    setSelectedMaterialId("");
    stopCamera();
  };

  // Camera handling
  const startCamera = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.play();
          setIsCameraActive(true);
          requestRef.current = requestAnimationFrame(tick);
        }
      } catch (err) {
        toast({
          title: "Camera Error",
          description: "Could not access camera. Please check permissions.",
          variant: "destructive"
        });
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
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
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
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        
        if (code) {
          const now = Date.now();
          if (now - lastScanTime.current > 1500) { // 1.5s cooldown
            lastScanTime.current = now;
            handleScanItem(code.data);
          }
        }
      }
    }
    if (isCameraActive) {
      requestRef.current = requestAnimationFrame(tick);
    }
  };

  useEffect(() => {
    if (scanMethod === "camera" && activeSession && !generatedQr) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [scanMethod, activeSession, generatedQr]);


  if (generatedQr) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-50/10 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-emerald-100 text-emerald-600 w-16 h-16 flex items-center justify-center rounded-full mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <CardTitle className="text-2xl">Session Completed</CardTitle>
          <p className="text-muted-foreground mt-2">
            Box Label: <strong className="text-foreground font-mono bg-muted px-2 py-1 rounded">{activeSession?.boxLabel}</strong>
          </p>
          <p className="text-muted-foreground">
            Total Items: <strong className="text-foreground">{scannedItems.length}</strong>
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center pt-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-border">
            <img src={generatedQr} alt="Box QR Code" className="w-64 h-64 object-contain" />
          </div>
          <p className="text-sm text-center text-muted-foreground mt-6 max-w-sm">
            Print this QR code and attach it to the physical box. It contains all the serial numbers of the scanned items.
          </p>
        </CardContent>
        <CardFooter className="justify-center pt-2 pb-6">
          <Button onClick={handleReset} size="lg" className="px-8">Start New Session</Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-12">
      <div className="md:col-span-5 lg:col-span-4 space-y-6">
        <Card className="border-primary/20 shadow-sm">
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeSession ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Material</label>
                  <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId} disabled={isLoadingMaterials}>
                    <SelectTrigger className="h-12 font-mono">
                      <SelectValue placeholder="Select Material..." />
                    </SelectTrigger>
                    <SelectContent>
                      {materials?.map(m => (
                        <SelectItem key={m.id} value={m.id.toString()}>{m.code} - {m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleStartSession} 
                  disabled={!selectedMaterialId || createScanInMutation.isPending}
                  className="w-full h-12 uppercase tracking-wide font-bold"
                >
                  {createScanInMutation.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />}
                  Start Scanning
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg border border-border space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Material</p>
                    <p className="font-mono font-medium">{activeSession.materialName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Box Label</p>
                    <p className="font-mono text-lg font-bold text-primary">{activeSession.boxLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Scanned</p>
                    <p className="text-2xl font-bold">{scannedItems.length} <span className="text-sm font-normal text-muted-foreground">items</span></p>
                  </div>
                </div>
                
                <Button 
                  variant="destructive" 
                  onClick={handleCompleteSession}
                  disabled={scannedItems.length === 0 || updateScanInMutation.isPending}
                  className="w-full h-12 uppercase tracking-wide font-bold"
                >
                  {updateScanInMutation.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Square className="w-5 h-5 mr-2 fill-current" />}
                  Complete Box
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {activeSession && (
          <Card className="border-sidebar-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Input Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex rounded-md shadow-sm">
                <Button
                  variant={scanMethod === "manual" ? "default" : "outline"}
                  className="flex-1 rounded-r-none h-12"
                  onClick={() => setScanMethod("manual")}
                >
                  <Keyboard className="w-4 h-4 mr-2" />
                  Manual / USB
                </Button>
                <Button
                  variant={scanMethod === "camera" ? "default" : "outline"}
                  className="flex-1 rounded-l-none h-12"
                  onClick={() => setScanMethod("camera")}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Camera
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
              Scanner Area
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {!activeSession ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                <QrCode className="w-24 h-24 mb-4 opacity-20" />
                <p className="text-lg">Select a material and start session</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-border/50 bg-background sticky top-0 z-10">
                  {scanMethod === "manual" ? (
                    <form 
                      onSubmit={(e) => { e.preventDefault(); handleScanItem(manualInput); }}
                      className="flex gap-2"
                    >
                      <Input
                        ref={inputRef}
                        placeholder="Scan or type 28-char serial number..."
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        className="h-14 font-mono text-lg"
                        autoFocus
                      />
                      <Button type="submit" className="h-14 px-6" disabled={!manualInput || addItemMutation.isPending}>
                        Add
                      </Button>
                    </form>
                  ) : (
                    <div className="relative w-full max-w-md mx-auto aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center">
                      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                      {/* Scanner overlay */}
                      <div className="absolute inset-0 border-[3px] border-primary/50 z-10 m-8 rounded">
                         <div className="absolute inset-0 bg-primary/10 animate-pulse" />
                         <div className="absolute top-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_8px_2px_rgba(var(--primary),0.8)] animate-[scan_2s_ease-in-out_infinite]" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-auto p-4 max-h-[400px]">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 sticky top-0 bg-card py-2">
                    Scanned Items ({scannedItems.length})
                  </h3>
                  {scannedItems.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                      Ready to scan items
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {scannedItems.map((item, index) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-md animate-in slide-in-from-left-2">
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground w-6 text-right text-xs font-mono">{scannedItems.length - index}.</span>
                            <span className="font-mono font-medium tracking-tight">{item.serialNumber}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteItem(item.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(calc(100cqh - 0.125rem)); }
          100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}