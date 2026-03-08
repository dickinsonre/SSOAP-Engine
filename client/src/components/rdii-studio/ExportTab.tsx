import { useState, useCallback } from "react";
import { FileOutput, Copy, Download, Check, ExternalLink, FileText, CloudRain, Play, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";

export function ExportTab() {
  const { optimizationResults, selectedSolutionIndex } = useCalibrationData();
  const [copied, setCopied] = useState(false);

  const selected = optimizationResults.length > 0 ? optimizationResults[selectedSolutionIndex] || optimizationResults[0] : null;

  const generateSWMM5Format = useCallback(() => {
    if (!selected) return "";
    const p = selected.parameters;
    return `[RDII]
;;UHGroup    Month  Response  R          T          K
;;----------  -----  --------  ---------  ---------  ---------
  UH1         *      1         ${p.R1.toFixed(6)}   ${p.T1.toFixed(2)}       ${p.K1.toFixed(2)}
  UH1         *      2         ${p.R2.toFixed(6)}   ${p.T2.toFixed(2)}       ${p.K2.toFixed(2)}
  UH1         *      3         ${p.R3.toFixed(6)}   ${p.T3.toFixed(2)}       ${p.K3.toFixed(2)}`;
  }, [selected]);

  const generateCSV = useCallback(() => {
    if (!selected) return "";
    const p = selected.parameters;
    return `Response,R,T,K
Fast,${p.R1.toFixed(6)},${p.T1.toFixed(2)},${p.K1.toFixed(2)}
Medium,${p.R2.toFixed(6)},${p.T2.toFixed(2)},${p.K2.toFixed(2)}
Slow,${p.R3.toFixed(6)},${p.T3.toFixed(2)},${p.K3.toFixed(2)}

Metrics
RMSE,${selected.rmse.toFixed(6)}
NSE,${(selected.nse * 100).toFixed(2)}%
Volume Error,${selected.volumeError.toFixed(2)}%
Peak Error,${selected.peakError.toFixed(2)}%`;
  }, [selected]);

  const handleCopy = useCallback(async () => {
    const text = generateSWMM5Format();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generateSWMM5Format]);

  const handleDownloadCSV = useCallback(() => {
    const csv = generateCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rtk_parameters.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [generateCSV]);

  if (!selected) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileOutput className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Run calibration first to export parameters.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleCopy} variant="outline" data-testid="button-copy-clipboard">
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy to Clipboard"}
        </Button>
        <Button onClick={handleDownloadCSV} variant="outline" data-testid="button-download-csv">
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
        <Badge variant="outline" data-testid="badge-selected-solution">
          {selected.label || `Solution ${selectedSolutionIndex + 1}`}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">SWMM5 [RDII] Section Format</CardTitle>
          <CardDescription className="text-xs">Ready to paste into your SWMM5 .inp file</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted/50 p-4 rounded-md text-xs font-mono overflow-x-auto whitespace-pre" data-testid="text-swmm5-preview">
            {generateSWMM5Format()}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Calibration Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <p className="text-lg font-bold font-mono" data-testid="text-export-rmse">{selected.rmse.toFixed(4)}</p>
              <p className="text-xs text-muted-foreground">RMSE</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold font-mono" data-testid="text-export-nse">{(selected.nse * 100).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">NSE</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold font-mono" data-testid="text-export-vol">{selected.volumeError.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Volume Error</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold font-mono" data-testid="text-export-peak">{selected.peakError.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Peak Error</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Ecosystem Connections</CardTitle>
          <CardDescription className="text-xs">Send your RTK parameters to companion tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="justify-start gap-3"
              data-testid="button-link-inp-maker"
              onClick={() => {
                const p = selected.parameters;
                const hash = `R1=${p.R1}&T1=${p.T1}&K1=${p.K1}&R2=${p.R2}&T2=${p.T2}&K2=${p.K2}&R3=${p.R3}&T3=${p.T3}&K3=${p.K3}`;
                window.open(`https://inp-maker.app/#${hash}`, "_blank", "noopener,noreferrer");
              }}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm">INP MAKER</span>
                <span className="text-xs text-muted-foreground">Build SWMM .inp files with RTK params</span>
              </div>
              <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-3"
              data-testid="button-link-rain-canvas"
              onClick={() => {
                window.open("https://rain-canvas.app/", "_blank", "noopener,noreferrer");
              }}
            >
              <CloudRain className="h-4 w-4 shrink-0" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm">Rain Canvas</span>
                <span className="text-xs text-muted-foreground">Rainfall data library and visualizer</span>
              </div>
              <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-3"
              data-testid="button-link-swmm5-engine"
              onClick={() => {
                window.open("https://swmm5-engine.app/", "_blank", "noopener,noreferrer");
              }}
            >
              <Play className="h-4 w-4 shrink-0" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm">SWMM5 Engine</span>
                <span className="text-xs text-muted-foreground">Run hydraulic simulations online</span>
              </div>
              <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-3"
              data-testid="button-link-batch-swmm"
              onClick={() => {
                window.open("https://batch-swmm.app/", "_blank", "noopener,noreferrer");
              }}
            >
              <Layers className="h-4 w-4 shrink-0" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm">BatchSWMM</span>
                <span className="text-xs text-muted-foreground">Batch process multiple SWMM scenarios</span>
              </div>
              <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
