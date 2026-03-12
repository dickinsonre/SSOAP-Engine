import { useState, useCallback, useMemo } from "react";
import { FileOutput, Copy, Download, Check, ExternalLink, FileText, CloudRain, Play, Layers, FileDown, History, Table2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";
import { getPerformanceRating } from "@/lib/flowDecomposition";

interface ParameterHistory {
  timestamp: string;
  label: string;
  parameters: { R1: number; T1: number; K1: number; R2: number; T2: number; K2: number; R3: number; T3: number; K3: number };
  nse: number;
  rmse: number;
}

export function ExportTab() {
  const { optimizationResults, selectedSolutionIndex, volumeBalance, rValueResult, sensitivityResults } = useCalibrationData();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("export");
  const [uhGroup, setUhGroup] = useState("UH1");
  const [seasonalMode, setSeasonalMode] = useState(false);
  const [history, setHistory] = useState<ParameterHistory[]>(() => {
    try {
      const stored = localStorage.getItem('rtk-parameter-history');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const selected = optimizationResults.length > 0 ? optimizationResults[selectedSolutionIndex] || optimizationResults[0] : null;

  const generateSWMM5Format = useCallback(() => {
    if (!selected) return "";
    const p = selected.parameters;
    if (seasonalMode) {
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      let lines = "[RDII]\n;;UHGroup    Month  Response  R          T          K\n;;----------  -----  --------  ---------  ---------  ---------\n";
      for (const month of months) {
        lines += `  ${uhGroup.padEnd(12)}${month.padEnd(7)}1         ${p.R1.toFixed(6)}   ${p.T1.toFixed(2)}       ${p.K1.toFixed(2)}\n`;
        lines += `  ${uhGroup.padEnd(12)}${month.padEnd(7)}2         ${p.R2.toFixed(6)}   ${p.T2.toFixed(2)}       ${p.K2.toFixed(2)}\n`;
        lines += `  ${uhGroup.padEnd(12)}${month.padEnd(7)}3         ${p.R3.toFixed(6)}   ${p.T3.toFixed(2)}       ${p.K3.toFixed(2)}\n`;
      }
      return lines;
    }
    return `[RDII]
;;UHGroup    Month  Response  R          T          K
;;----------  -----  --------  ---------  ---------  ---------
  ${uhGroup.padEnd(12)}*      1         ${p.R1.toFixed(6)}   ${p.T1.toFixed(2)}       ${p.K1.toFixed(2)}
  ${uhGroup.padEnd(12)}*      2         ${p.R2.toFixed(6)}   ${p.T2.toFixed(2)}       ${p.K2.toFixed(2)}
  ${uhGroup.padEnd(12)}*      3         ${p.R3.toFixed(6)}   ${p.T3.toFixed(2)}       ${p.K3.toFixed(2)}`;
  }, [selected, uhGroup, seasonalMode]);

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

  const handleSaveToHistory = useCallback(() => {
    if (!selected) return;
    const entry: ParameterHistory = {
      timestamp: new Date().toISOString(),
      label: selected.label || `Solution ${selectedSolutionIndex + 1}`,
      parameters: selected.parameters,
      nse: selected.nse,
      rmse: selected.rmse,
    };
    const updated = [entry, ...history].slice(0, 50);
    setHistory(updated);
    localStorage.setItem('rtk-parameter-history', JSON.stringify(updated));
  }, [selected, selectedSolutionIndex, history]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('rtk-parameter-history');
  }, []);

  const handleGenerateReport = useCallback(() => {
    if (!selected) return;
    const p = selected.parameters;
    const totalR = p.R1 + p.R2 + p.R3;
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();

    const sensitivitySection = sensitivityResults.length > 0 ? `
<h2>Sensitivity Analysis</h2>
<table>
<tr><th>Parameter</th><th>Base Value</th><th>Sensitivity (NSE Range)</th><th>Rank</th></tr>
${sensitivityResults.map((s, i) => `<tr><td>${s.parameter}</td><td class="mono">${s.baseValue.toFixed(4)}</td><td class="mono">${s.sensitivity.toFixed(4)}</td><td>${i + 1}</td></tr>`).join('\n')}
</table>` : '';

    const volumeSection = volumeBalance ? `
<h2>Volume Balance</h2>
<table>
<tr><th>Component</th><th>Volume</th><th>Percentage</th></tr>
<tr><td>Total Monitored</td><td class="mono">${volumeBalance.totalMonitored.toFixed(1)}</td><td>100%</td></tr>
<tr><td>BSF</td><td class="mono">${volumeBalance.totalBSF.toFixed(1)}</td><td class="mono">${volumeBalance.bsfPercent.toFixed(1)}%</td></tr>
<tr><td>GWI</td><td class="mono">${volumeBalance.totalGWI.toFixed(1)}</td><td class="mono">${volumeBalance.gwiPercent.toFixed(1)}%</td></tr>
<tr><td>RDII</td><td class="mono">${volumeBalance.totalRDII.toFixed(1)}</td><td class="mono">${volumeBalance.rdiiPercent.toFixed(1)}%</td></tr>
<tr><td>Closure Error</td><td class="mono" colspan="2">${volumeBalance.closureError.toFixed(2)}%</td></tr>
</table>` : '';

    const rValueSection = rValueResult ? `
<h2>R-Value Analysis</h2>
<p><strong>Mean R-Value:</strong> ${rValueResult.meanR.toFixed(2)}% | <strong>Median:</strong> ${rValueResult.medianR.toFixed(2)}% | <strong>Std Dev:</strong> ${rValueResult.stdDevR.toFixed(2)}%</p>
<table>
<tr><th>Event</th><th>Rainfall (in)</th><th>RDII Volume</th><th>R-Value (%)</th></tr>
${rValueResult.rByEvent.map(r => `<tr><td>${r.eventId}</td><td class="mono">${r.rainfall.toFixed(3)}</td><td class="mono">${r.volume.toFixed(2)}</td><td class="mono">${r.rValue.toFixed(2)}</td></tr>`).join('\n')}
</table>` : '';

    const nseRating = getPerformanceRating('NSE', selected.nse);
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>RDII Calibration Report</title>
<style>
body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; color: #1a1a1a; }
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
pre { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: 'Courier New', monospace; font-size: 13px; }
</style></head><body>
<h1>RDII Calibration Report</h1>
<p><strong>Generated:</strong> ${date} at ${time}</p>
<p><strong>Solution:</strong> ${selected.label || `Solution ${selectedSolutionIndex + 1}`}</p>

<h2>Calibration Metrics</h2>
<table>
<tr><th>Metric</th><th>Value</th><th>Rating</th></tr>
<tr><td>RMSE</td><td class="mono">${selected.rmse.toFixed(6)}</td><td><span class="badge ${selected.rmse < 0.5 ? 'good' : selected.rmse < 1.0 ? 'warn' : 'bad'}">${selected.rmse < 0.5 ? 'Excellent' : selected.rmse < 1.0 ? 'Good' : 'Needs Improvement'}</span></td></tr>
<tr><td>NSE</td><td class="mono">${(selected.nse * 100).toFixed(2)}%</td><td><span class="badge ${nseRating.color === 'green' ? 'good' : nseRating.color === 'yellow' ? 'warn' : 'bad'}">${nseRating.rating}</span></td></tr>
<tr><td>Volume Error</td><td class="mono">${selected.volumeError.toFixed(2)}%</td><td><span class="badge ${Math.abs(selected.volumeError) < 10 ? 'good' : Math.abs(selected.volumeError) < 25 ? 'warn' : 'bad'}">${Math.abs(selected.volumeError) < 10 ? 'Excellent' : Math.abs(selected.volumeError) < 25 ? 'Satisfactory' : 'Unsatisfactory'}</span></td></tr>
<tr><td>Peak Error</td><td class="mono">${selected.peakError.toFixed(2)}%</td><td><span class="badge ${Math.abs(selected.peakError) < 15 ? 'good' : Math.abs(selected.peakError) < 30 ? 'warn' : 'bad'}">${Math.abs(selected.peakError) < 15 ? 'Good' : Math.abs(selected.peakError) < 30 ? 'Satisfactory' : 'Unsatisfactory'}</span></td></tr>
</table>

<h2>RTK Parameters</h2>
<table>
<tr><th>Component</th><th>R (Response Ratio)</th><th>T (Time to Peak, hrs)</th><th>K (Recession Constant)</th></tr>
<tr><td>Fast (UH1)</td><td class="mono">${p.R1.toFixed(6)}</td><td class="mono">${p.T1.toFixed(2)}</td><td class="mono">${p.K1.toFixed(2)}</td></tr>
<tr><td>Medium (UH2)</td><td class="mono">${p.R2.toFixed(6)}</td><td class="mono">${p.T2.toFixed(2)}</td><td class="mono">${p.K2.toFixed(2)}</td></tr>
<tr><td>Slow (UH3)</td><td class="mono">${p.R3.toFixed(6)}</td><td class="mono">${p.T3.toFixed(2)}</td><td class="mono">${p.K3.toFixed(2)}</td></tr>
<tr><td><strong>Total R</strong></td><td class="mono"><strong>${(totalR * 100).toFixed(2)}%</strong></td><td colspan="2"><span class="badge ${totalR <= 1 ? 'good' : 'bad'}">${totalR <= 1 ? 'Valid' : 'INVALID'}</span></td></tr>
</table>
${sensitivitySection}
${volumeSection}
${rValueSection}

<h2>SWMM5 Input Format</h2>
<pre>${generateSWMM5Format()}</pre>

<div class="footer">
<p>Generated by RDII Toolbox &mdash; RDII Studio</p>
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
  }, [selected, selectedSolutionIndex, sensitivityResults, volumeBalance, rValueResult, generateSWMM5Format]);

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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="export" data-testid="tab-export"><FileOutput className="h-3.5 w-3.5 mr-1" />Export</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history"><History className="h-3.5 w-3.5 mr-1" />History</TabsTrigger>
          <TabsTrigger value="ecosystem" data-testid="tab-ecosystem"><ExternalLink className="h-3.5 w-3.5 mr-1" />Ecosystem</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-4">
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
            <Button onClick={handleSaveToHistory} variant="outline" data-testid="button-save-history">
              <History className="mr-2 h-4 w-4" />
              Save to History
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
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">UH Group Name</Label>
                  <Input value={uhGroup} onChange={(e) => setUhGroup(e.target.value)} data-testid="input-uh-group" />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" checked={seasonalMode} onChange={(e) => setSeasonalMode(e.target.checked)} id="seasonal" className="rounded border-input" />
                  <Label htmlFor="seasonal" className="text-xs cursor-pointer">Seasonal RTK (per-month)</Label>
                </div>
              </div>
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
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Parameter History</CardTitle>
                  <CardDescription className="text-xs">Track RTK parameter evolution across calibration runs</CardDescription>
                </div>
                {history.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={handleClearHistory} data-testid="button-clear-history">Clear</Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead className="text-right">NSE</TableHead>
                        <TableHead className="text-right">RMSE</TableHead>
                        <TableHead className="text-right">R1</TableHead>
                        <TableHead className="text-right">T1</TableHead>
                        <TableHead className="text-right">R2</TableHead>
                        <TableHead className="text-right">T2</TableHead>
                        <TableHead className="text-right">R3</TableHead>
                        <TableHead className="text-right">T3</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h, i) => (
                        <TableRow key={i} data-testid={`row-history-${i}`}>
                          <TableCell className="text-xs font-mono">{new Date(h.timestamp).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{h.label}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{(h.nse * 100).toFixed(1)}%</TableCell>
                          <TableCell className="text-right font-mono text-xs">{h.rmse.toFixed(4)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{h.parameters.R1.toFixed(4)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{h.parameters.T1.toFixed(1)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{h.parameters.R2.toFixed(4)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{h.parameters.T2.toFixed(1)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{h.parameters.R3.toFixed(4)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{h.parameters.T3.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No calibration history saved yet. Use "Save to History" to track your parameter evolution.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ecosystem" className="space-y-4">
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
                  onClick={() => window.open("https://rain-canvas.app/", "_blank", "noopener,noreferrer")}
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
                  onClick={() => window.open("https://swmm5-engine.app/", "_blank", "noopener,noreferrer")}
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
                  onClick={() => window.open("https://batch-swmm.app/", "_blank", "noopener,noreferrer")}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
