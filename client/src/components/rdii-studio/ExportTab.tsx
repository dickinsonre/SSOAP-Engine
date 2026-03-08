import { useState, useCallback } from "react";
import { FileOutput, Copy, Download, Check, ExternalLink, FileText, CloudRain, Play, Layers, FileDown } from "lucide-react";
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

  const handleGenerateReport = useCallback(() => {
    if (!selected) return;
    const p = selected.parameters;
    const totalR = p.R1 + p.R2 + p.R3;
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>RDII Calibration Report</title>
<style>
body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; }
h1 { color: #0f172a; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; }
h2 { color: #334155; margin-top: 32px; }
table { width: 100%; border-collapse: collapse; margin: 16px 0; }
th, td { border: 1px solid #e2e8f0; padding: 10px 14px; text-align: left; }
th { background: #f1f5f9; font-weight: 600; }
td.mono { font-family: 'Courier New', monospace; text-align: right; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
.good { background: #dcfce7; color: #166534; }
.warn { background: #fef9c3; color: #854d0e; }
.bad { background: #fee2e2; color: #991b1b; }
.footer { margin-top: 48px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
</style></head><body>
<h1>RDII Calibration Report</h1>
<p><strong>Generated:</strong> ${date} at ${time}</p>
<p><strong>Solution:</strong> ${selected.label || `Solution ${selectedSolutionIndex + 1}`}</p>

<h2>Calibration Metrics</h2>
<table>
<tr><th>Metric</th><th>Value</th><th>Rating</th></tr>
<tr><td>RMSE</td><td class="mono">${selected.rmse.toFixed(6)}</td><td><span class="badge ${selected.rmse < 0.5 ? 'good' : selected.rmse < 1.0 ? 'warn' : 'bad'}">${selected.rmse < 0.5 ? 'Excellent' : selected.rmse < 1.0 ? 'Good' : 'Needs Improvement'}</span></td></tr>
<tr><td>NSE</td><td class="mono">${(selected.nse * 100).toFixed(2)}%</td><td><span class="badge ${selected.nse > 0.75 ? 'good' : selected.nse > 0.5 ? 'warn' : 'bad'}">${selected.nse > 0.75 ? 'Very Good' : selected.nse > 0.5 ? 'Satisfactory' : 'Unsatisfactory'}</span></td></tr>
<tr><td>Volume Error</td><td class="mono">${selected.volumeError.toFixed(2)}%</td><td><span class="badge ${Math.abs(selected.volumeError) < 10 ? 'good' : Math.abs(selected.volumeError) < 25 ? 'warn' : 'bad'}">${Math.abs(selected.volumeError) < 10 ? 'Excellent' : Math.abs(selected.volumeError) < 25 ? 'Satisfactory' : 'Unsatisfactory'}</span></td></tr>
<tr><td>Peak Error</td><td class="mono">${selected.peakError.toFixed(2)}%</td><td><span class="badge ${Math.abs(selected.peakError) < 15 ? 'good' : Math.abs(selected.peakError) < 30 ? 'warn' : 'bad'}">${Math.abs(selected.peakError) < 15 ? 'Good' : Math.abs(selected.peakError) < 30 ? 'Satisfactory' : 'Unsatisfactory'}</span></td></tr>
</table>

<h2>RTK Parameters</h2>
<table>
<tr><th>Component</th><th>R (Response Ratio)</th><th>T (Time to Peak, hrs)</th><th>K (Recession Constant)</th></tr>
<tr><td>Fast (UH1)</td><td class="mono">${p.R1.toFixed(6)}</td><td class="mono">${p.T1.toFixed(2)}</td><td class="mono">${p.K1.toFixed(2)}</td></tr>
<tr><td>Medium (UH2)</td><td class="mono">${p.R2.toFixed(6)}</td><td class="mono">${p.T2.toFixed(2)}</td><td class="mono">${p.K2.toFixed(2)}</td></tr>
<tr><td>Slow (UH3)</td><td class="mono">${p.R3.toFixed(6)}</td><td class="mono">${p.T3.toFixed(2)}</td><td class="mono">${p.K3.toFixed(2)}</td></tr>
<tr><td><strong>Total R</strong></td><td class="mono"><strong>${(totalR * 100).toFixed(2)}%</strong></td><td colspan="2"><span class="badge ${totalR <= 1 ? 'good' : 'bad'}">${totalR <= 1 ? 'Valid (R1+R2+R3 ≤ 1.0)' : 'INVALID (R1+R2+R3 > 1.0)'}</span></td></tr>
</table>

<h2>SWMM5 Input Format</h2>
<pre style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: 'Courier New', monospace; font-size: 13px;">
[RDII]
;;UHGroup    Month  Response  R          T          K
  UH1         *      1         ${p.R1.toFixed(6)}   ${p.T1.toFixed(2)}       ${p.K1.toFixed(2)}
  UH1         *      2         ${p.R2.toFixed(6)}   ${p.T2.toFixed(2)}       ${p.K2.toFixed(2)}
  UH1         *      3         ${p.R3.toFixed(6)}   ${p.T3.toFixed(2)}       ${p.K3.toFixed(2)}
</pre>

<div class="footer">
<p>Generated by SSOAP Toolbox — RDII Studio</p>
<p>RTK calibration method based on EPA SSOAP methodology</p>
</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rdii_calibration_report.html";
    a.click();
    URL.revokeObjectURL(url);
  }, [selected, selectedSolutionIndex]);

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
        <Button onClick={handleGenerateReport} variant="outline" data-testid="button-generate-report">
          <FileDown className="mr-2 h-4 w-4" />
          Generate Report
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
