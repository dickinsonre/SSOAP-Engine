import { useState, useCallback } from "react";
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, ArrowRight, Play, Filter, Wrench, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";
import { HelpTooltip } from "./HelpTooltip";
import type { ParsedTimeSeriesData, QAQCResult, QAQCIssue } from "@/contexts/CalibrationDataContext";
import {
  detectGaps, fillGaps, detectOutliers,
  type TimeSeriesPoint,
} from "@/lib/flowDecomposition";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
  BarChart, Bar, Cell,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface QAQCTabProps {
  onNext?: () => void;
}

function runQAQCChecks(data: ParsedTimeSeriesData): QAQCResult {
  const issues: QAQCIssue[] = [];
  let missingCount = 0;
  let outlierCount = 0;
  let gapCount = 0;
  let duplicateCount = 0;
  let negativeCount = 0;

  const mean = data.values.reduce((a, b) => a + b, 0) / data.values.length;
  const variance = data.values.reduce((a, v) => a + (v - mean) ** 2, 0) / data.values.length;
  const stdDev = Math.sqrt(variance);
  const outlierThreshold = mean + 3 * stdDev;

  for (let i = 0; i < data.values.length; i++) {
    const ts = data.timestamps[i].toISOString();

    if (data.values[i] === null || data.values[i] === undefined || isNaN(data.values[i])) {
      missingCount++;
      issues.push({ type: "missing", index: i, timestamp: ts, message: "Missing or NaN value", severity: "error" });
    }

    if (data.values[i] > outlierThreshold) {
      outlierCount++;
      issues.push({ type: "outlier", index: i, timestamp: ts, value: data.values[i], message: `Value ${data.values[i].toFixed(2)} exceeds threshold ${outlierThreshold.toFixed(2)}`, severity: "warning" });
    }

    if (data.values[i] < 0) {
      negativeCount++;
      issues.push({ type: "negative", index: i, timestamp: ts, value: data.values[i], message: `Negative value: ${data.values[i].toFixed(4)}`, severity: "warning" });
    }

    if (i > 0) {
      const dt = data.timestamps[i].getTime() - data.timestamps[i - 1].getTime();
      if (i > 1) {
        const prevDt = data.timestamps[i - 1].getTime() - data.timestamps[i - 2].getTime();
        if (prevDt > 0 && dt > prevDt * 3) {
          gapCount++;
          issues.push({ type: "gap", index: i, timestamp: ts, message: `Time gap of ${(dt / 3600000).toFixed(1)} hours`, severity: "warning" });
        }
      }
      if (dt === 0) {
        duplicateCount++;
        issues.push({ type: "duplicate", index: i, timestamp: ts, value: data.values[i], message: "Duplicate timestamp", severity: "error" });
      }
    }
  }

  const passed = missingCount === 0 && outlierCount <= 5 && gapCount === 0 && negativeCount === 0 && duplicateCount === 0;

  return {
    totalPoints: data.values.length,
    missingCount,
    outlierCount,
    gapCount,
    duplicateCount,
    negativeCount,
    issues,
    passed,
  };
}

export function QAQCTab({ onNext }: QAQCTabProps) {
  const {
    flowData, rainfallData,
    qaqcFlowResult, setQaqcFlowResult,
    qaqcRainfallResult, setQaqcRainfallResult,
    gapFillResult, setGapFillResult,
    outlierResult, setOutlierResult,
  } = useCalibrationData();
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("checks");
  const [gapMethod, setGapMethod] = useState<"linear" | "spline" | "pattern" | "none">("linear");
  const [maxGapHours, setMaxGapHours] = useState(4);
  const [flatlineHours, setFlatlineHours] = useState(6);
  const [zeroFlowHours, setZeroFlowHours] = useState(2);
  const [outlierMethod, setOutlierMethod] = useState<"zscore" | "modified_zscore" | "iqr">("zscore");
  const [zThreshold, setZThreshold] = useState(3.0);
  const [iqrMult, setIqrMult] = useState(1.5);
  const [maxFlow, setMaxFlow] = useState("");
  const [maxDqDt, setMaxDqDt] = useState("");

  const handleRunQAQC = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      if (flowData) setQaqcFlowResult(runQAQCChecks(flowData));
      if (rainfallData) setQaqcRainfallResult(runQAQCChecks(rainfallData));
      setRunning(false);
    }, 300);
  }, [flowData, rainfallData, setQaqcFlowResult, setQaqcRainfallResult]);

  const handleGapDetection = useCallback(() => {
    if (!flowData) return;
    const ts: TimeSeriesPoint[] = flowData.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: flowData.values[i],
    }));
    const gaps = detectGaps(ts, { flatlineThresholdHours: flatlineHours, zeroFlowThresholdHours: zeroFlowHours });
    const result = fillGaps(ts, gaps, gapMethod, maxGapHours);
    setGapFillResult(result);
  }, [flowData, gapMethod, maxGapHours, flatlineHours, zeroFlowHours, setGapFillResult]);

  const handleOutlierDetection = useCallback(() => {
    if (!flowData) return;
    const ts: TimeSeriesPoint[] = flowData.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: flowData.values[i],
    }));
    const result = detectOutliers(ts, {
      method: outlierMethod,
      zScoreThreshold: zThreshold,
      iqrMultiplier: iqrMult,
      maxFlow: maxFlow ? parseFloat(maxFlow) : undefined,
      maxDqDt: maxDqDt ? parseFloat(maxDqDt) : undefined,
    });
    setOutlierResult(result);
  }, [flowData, outlierMethod, zThreshold, iqrMult, maxFlow, maxDqDt, setOutlierResult]);

  const renderSummaryCard = (label: string, result: QAQCResult | null) => {
    if (!result) return null;
    const checks = [
      { name: "Missing Values", count: result.missingCount, ok: result.missingCount === 0 },
      { name: "Outliers", count: result.outlierCount, ok: result.outlierCount <= 5 },
      { name: "Time Gaps", count: result.gapCount, ok: result.gapCount === 0 },
      { name: "Negative Values", count: result.negativeCount, ok: result.negativeCount === 0 },
      { name: "Duplicates", count: result.duplicateCount, ok: result.duplicateCount === 0 },
    ];
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">{label}</CardTitle>
            <Badge variant={result.passed ? "default" : "destructive"} data-testid={`badge-qaqc-${label.toLowerCase().replace(/\s/g, "-")}`}>
              {result.passed ? "PASSED" : "ISSUES FOUND"}
            </Badge>
          </div>
          <CardDescription className="text-xs font-mono">{result.totalPoints.toLocaleString()} data points checked</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checks.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                  <span>{c.name}</span>
                </div>
                <span className="font-mono">{c.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const flowStats = flowData ? (() => {
    const vals = [...flowData.values].sort((a, b) => a - b);
    const n = vals.length;
    const mean = vals.reduce((s, v) => s + v, 0) / n;
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    return {
      min: vals[0],
      max: vals[n - 1],
      mean,
      median: vals[Math.floor(n / 2)],
      std,
      p10: vals[Math.floor(n * 0.1)],
      p90: vals[Math.floor(n * 0.9)],
      completeness: ((n / (n + (qaqcFlowResult?.missingCount || 0) + (qaqcFlowResult?.gapCount || 0))) * 100),
    };
  })() : null;

  const rainStats = rainfallData ? (() => {
    const vals = rainfallData.values;
    const total = vals.reduce((s, v) => s + v, 0);
    const nonZero = vals.filter(v => v > 0);
    const maxIntensity = Math.max(...vals);
    const step = rainfallData.timestamps.length > 1 ? (rainfallData.timestamps[1].getTime() - rainfallData.timestamps[0].getTime()) / 3600000 : 1;
    return { total, events: nonZero.length, maxIntensity: maxIntensity / step, maxDepth: maxIntensity };
  })() : null;

  const scattergraphData = flowData && flowData.values.length > 0 ? (() => {
    const step = Math.max(1, Math.floor(flowData.values.length / 500));
    const data: { depth: number; velocity: number; hour: number }[] = [];
    for (let i = 0; i < flowData.values.length; i += step) {
      const flow = flowData.values[i];
      const depth = Math.sqrt(flow) * 0.8;
      const velocity = flow > 0 ? flow / (depth * 0.5 + 0.1) : 0;
      data.push({ depth, velocity, hour: flowData.timestamps[i].getHours() });
    }
    return data;
  })() : [];

  const allIssues = [
    ...(qaqcFlowResult?.issues.map((i) => ({ ...i, source: "Flow" })) || []),
    ...(qaqcRainfallResult?.issues.map((i) => ({ ...i, source: "Rainfall" })) || []),
  ];

  if (!flowData && !rainfallData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Import data first to run quality checks.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="checks" data-testid="tab-qaqc-checks"><ShieldCheck className="h-3.5 w-3.5 mr-1" />Checks</TabsTrigger>
          <TabsTrigger value="gaps" data-testid="tab-qaqc-gaps"><Wrench className="h-3.5 w-3.5 mr-1" />Gap Fill</TabsTrigger>
          <TabsTrigger value="outliers" data-testid="tab-qaqc-outliers"><Filter className="h-3.5 w-3.5 mr-1" />Outliers</TabsTrigger>
          <TabsTrigger value="summary" data-testid="tab-qaqc-summary"><BarChart3 className="h-3.5 w-3.5 mr-1" />Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="checks" className="space-y-4">
          <div className="flex justify-end">
            <div className="flex items-center gap-2">
              <Button onClick={handleRunQAQC} disabled={running} data-testid="button-run-qaqc">
                <Play className="mr-2 h-4 w-4" />
                {running ? "Running..." : "Run QA/QC"}
              </Button>
              <HelpTooltip text="Quality Assurance / Quality Control checks validate your data for missing values, outliers (beyond 3 standard deviations), time gaps, duplicate timestamps, and negative values before analysis." />
            </div>
          </div>

          {(qaqcFlowResult || qaqcRainfallResult) && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {renderSummaryCard("Flow Data", qaqcFlowResult)}
                {renderSummaryCard("Rainfall Data", qaqcRainfallResult)}
              </div>

              {allIssues.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Issues Detail</CardTitle>
                    <CardDescription className="text-xs">{allIssues.length} issues found</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">Source</TableHead>
                            <TableHead className="w-20">Severity</TableHead>
                            <TableHead className="w-24">Type</TableHead>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Message</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allIssues.slice(0, 100).map((issue, idx) => (
                            <TableRow key={idx} data-testid={`row-issue-${idx}`}>
                              <TableCell className="text-xs">{issue.source}</TableCell>
                              <TableCell>
                                {issue.severity === "error" ? (
                                  <Badge variant="destructive" className="text-xs">Error</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">Warning</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs font-mono">{issue.type}</TableCell>
                              <TableCell className="text-xs font-mono">{new Date(issue.timestamp).toLocaleString()}</TableCell>
                              <TableCell className="text-xs">{issue.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="gaps" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">Gap Detection & Filling</CardTitle>
                <HelpTooltip text="Detects missing timestamps, flatline periods, and zero-flow events. Choose a filling method to interpolate gaps or flag them for review." />
              </div>
              <CardDescription className="text-xs">Detect and fill gaps in flow time series data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fill Method</Label>
                  <Select value={gapMethod} onValueChange={(v) => setGapMethod(v as any)} data-testid="select-gap-method">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">Linear Interpolation</SelectItem>
                      <SelectItem value="spline">Spline Interpolation</SelectItem>
                      <SelectItem value="pattern">Pattern-Based Fill</SelectItem>
                      <SelectItem value="none">Flag Only (No Fill)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Gap to Fill (hrs)</Label>
                  <Input type="number" value={maxGapHours} onChange={(e) => setMaxGapHours(Number(e.target.value))} min={1} max={48} data-testid="input-max-gap" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Flatline Threshold (hrs)</Label>
                  <Input type="number" value={flatlineHours} onChange={(e) => setFlatlineHours(Number(e.target.value))} min={1} max={24} data-testid="input-flatline" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Zero-Flow Threshold (hrs)</Label>
                  <Input type="number" value={zeroFlowHours} onChange={(e) => setZeroFlowHours(Number(e.target.value))} min={0.5} max={12} step={0.5} data-testid="input-zero-flow" />
                </div>
              </div>
              <Button onClick={handleGapDetection} disabled={!flowData} data-testid="button-detect-gaps">
                <Play className="mr-2 h-4 w-4" />
                Detect & Fill Gaps
              </Button>
            </CardContent>
          </Card>

          {gapFillResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Gap Analysis Results</CardTitle>
                <CardDescription className="text-xs">{gapFillResult.gaps.length} gaps detected, {gapFillResult.recordsFilled} filled, {gapFillResult.recordsFlagged} flagged</CardDescription>
              </CardHeader>
              <CardContent>
                {gapFillResult.gaps.length > 0 ? (
                  <ScrollArea className="h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead className="text-right">Duration (hrs)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gapFillResult.gaps.map((g, i) => (
                          <TableRow key={i} data-testid={`row-gap-${i}`}>
                            <TableCell><Badge variant="outline" className="text-xs">{g.type}</Badge></TableCell>
                            <TableCell className="text-xs font-mono">{new Date(g.startTime).toLocaleString()}</TableCell>
                            <TableCell className="text-xs font-mono">{new Date(g.endTime).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{g.durationHours.toFixed(1)}</TableCell>
                            <TableCell>
                              <Badge variant={g.durationHours <= maxGapHours && g.type === 'missing' ? "default" : "secondary"} className="text-xs">
                                {g.durationHours <= maxGapHours && g.type === 'missing' ? "Filled" : "Flagged"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No gaps detected in the data.</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="outliers" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">Outlier Detection & Removal</CardTitle>
                <HelpTooltip text="Identifies outliers using statistical methods (Z-score, Modified Z-score, IQR) and physical checks (negative flow, max capacity, rate of change). Outliers are interpolated from neighbors." />
              </div>
              <CardDescription className="text-xs">Statistical and physical outlier detection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1.5">
                  <Label className="text-xs">Method</Label>
                  <Select value={outlierMethod} onValueChange={(v) => setOutlierMethod(v as any)} data-testid="select-outlier-method">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zscore">Z-Score</SelectItem>
                      <SelectItem value="modified_zscore">Modified Z-Score (MAD)</SelectItem>
                      <SelectItem value="iqr">IQR Fence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{outlierMethod === 'iqr' ? 'IQR Multiplier' : 'Z Threshold'}</Label>
                  <Input
                    type="number"
                    value={outlierMethod === 'iqr' ? iqrMult : zThreshold}
                    onChange={(e) => outlierMethod === 'iqr' ? setIqrMult(Number(e.target.value)) : setZThreshold(Number(e.target.value))}
                    step={0.1}
                    data-testid="input-outlier-threshold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Flow (capacity)</Label>
                  <Input type="number" value={maxFlow} onChange={(e) => setMaxFlow(e.target.value)} placeholder="Optional" data-testid="input-max-flow" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max dQ/dt</Label>
                  <Input type="number" value={maxDqDt} onChange={(e) => setMaxDqDt(e.target.value)} placeholder="Optional" data-testid="input-max-dqdt" />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleOutlierDetection} disabled={!flowData} data-testid="button-detect-outliers">
                    <Play className="mr-2 h-4 w-4" />
                    Detect
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {outlierResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Outlier Results</CardTitle>
                <CardDescription className="text-xs">{outlierResult.outliers.length} outliers detected</CardDescription>
              </CardHeader>
              <CardContent>
                {outlierResult.outliers.length > 0 ? (
                  <ScrollArea className="h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Method</TableHead>
                          <TableHead>Timestamp</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Severity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outlierResult.outliers.slice(0, 50).map((o, i) => (
                          <TableRow key={i} data-testid={`row-outlier-${i}`}>
                            <TableCell className="text-xs font-mono">{o.method}</TableCell>
                            <TableCell className="text-xs font-mono">{new Date(o.timestamp).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{o.value.toFixed(3)}</TableCell>
                            <TableCell className="text-xs">{o.reason}</TableCell>
                            <TableCell>
                              <Badge variant={o.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">{o.severity}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No outliers detected.</p>
                )}
              </CardContent>
            </Card>
          )}

          {scattergraphData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Flow Data Scattergraph</CardTitle>
                <CardDescription className="text-xs">Depth vs Velocity (derived from flow) — color by time of day</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{ scatter: { label: "Flow Points", color: "hsl(var(--chart-1))" } }} className="h-[300px] w-full">
                  <ResponsiveContainer>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="velocity" name="Velocity" tick={{ fontSize: 9 }} label={{ value: "Velocity (est)", position: "bottom", fontSize: 10 }} />
                      <YAxis dataKey="depth" name="Depth" tick={{ fontSize: 9 }} label={{ value: "Depth (est)", angle: -90, position: "insideLeft", fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Scatter name="Day (6-18h)" data={scattergraphData.filter(d => d.hour >= 6 && d.hour < 18)} fill="hsl(var(--chart-1))" fillOpacity={0.5} />
                      <Scatter name="Night (18-6h)" data={scattergraphData.filter(d => d.hour < 6 || d.hour >= 18)} fill="hsl(var(--chart-3))" fillOpacity={0.5} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          {flowStats && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Data Summary Dashboard</CardTitle>
                <CardDescription className="text-xs">Flow and rainfall statistics overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-semibold mb-3">Flow Statistics</h4>
                    <Table>
                      <TableBody>
                        {[
                          ["Min", flowStats.min.toFixed(3)],
                          ["Max", flowStats.max.toFixed(3)],
                          ["Mean", flowStats.mean.toFixed(3)],
                          ["Median", flowStats.median.toFixed(3)],
                          ["Std Dev", flowStats.std.toFixed(3)],
                          ["P10", flowStats.p10.toFixed(3)],
                          ["P90", flowStats.p90.toFixed(3)],
                        ].map(([label, value]) => (
                          <TableRow key={label}>
                            <TableCell className="text-xs py-1.5">{label}</TableCell>
                            <TableCell className="text-right font-mono text-xs py-1.5">{value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {rainStats && (
                    <div>
                      <h4 className="text-xs font-semibold mb-3">Rainfall Statistics</h4>
                      <Table>
                        <TableBody>
                          {[
                            ["Total Depth", rainStats.total.toFixed(2)],
                            ["Wet Intervals", rainStats.events.toString()],
                            ["Max Intensity", rainStats.maxIntensity.toFixed(2) + " /hr"],
                            ["Max Depth", rainStats.maxDepth.toFixed(3)],
                          ].map(([label, value]) => (
                            <TableRow key={label}>
                              <TableCell className="text-xs py-1.5">{label}</TableCell>
                              <TableCell className="text-right font-mono text-xs py-1.5">{value}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span>Data Completeness</span>
                    <span className="font-mono">{flowStats.completeness.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${flowStats.completeness}%` }}
                    />
                  </div>
                  <Badge variant={flowStats.completeness >= 95 ? "default" : flowStats.completeness >= 80 ? "secondary" : "destructive"} className="mt-2 text-xs">
                    {flowStats.completeness >= 95 ? "Excellent" : flowStats.completeness >= 80 ? "Good" : "Poor"} Quality
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {(qaqcFlowResult || qaqcRainfallResult) && onNext && (
        <div className="flex justify-end">
          <Button onClick={onNext} data-testid="button-next-step">
            Next Step
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
