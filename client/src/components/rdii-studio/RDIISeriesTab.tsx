import { useState, useCallback } from "react";
import { Activity, ArrowRight, Play, PieChart, BarChart3, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";
import {
  calculateRValues, calculateVolumeBalance, type TimeSeriesPoint,
} from "@/lib/flowDecomposition";
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Legend, PieChart as RPie, Pie, Cell,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { HelpTooltip } from "./HelpTooltip";

interface RDIISeriesTabProps {
  onNext?: () => void;
}

const PIE_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-4))"];

export function RDIISeriesTab({ onNext }: RDIISeriesTabProps) {
  const {
    flowData, dwfResult, rdiiSeries, setRDIISeries,
    rainfallData, rainfallEvents, rValueResult, setRValueResult,
    volumeBalance, setVolumeBalance, bsfResult, mnfResult,
  } = useCalibrationData();
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("extract");
  const [sewershedArea, setSewershedArea] = useState(100);

  const handleGenerate = useCallback(() => {
    if (!flowData || !dwfResult) return;
    setRunning(true);
    setTimeout(() => {
      const n = flowData.timestamps.length;
      const rdiiValues: number[] = [];
      let totalVolume = 0;

      for (let i = 0; i < n; i++) {
        const total = flowData.values[i];
        const dwf = dwfResult.baseFlow[i] || 0;
        const gwi = dwfResult.meanGWI;
        const rdii = Math.max(0, total - dwf - gwi);
        rdiiValues.push(rdii);
        totalVolume += rdii;
      }

      setRDIISeries({
        timestamps: [...flowData.timestamps],
        values: rdiiValues,
        totalVolume,
      });
      setRunning(false);
    }, 200);
  }, [flowData, dwfResult, setRDIISeries]);

  const handleRValues = useCallback(() => {
    if (!rdiiSeries || !rainfallData || rainfallEvents.length === 0) return;
    const rdiiTS: TimeSeriesPoint[] = rdiiSeries.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: rdiiSeries.values[i],
    }));
    const rainTS: TimeSeriesPoint[] = rainfallData.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: rainfallData.values[i],
    }));
    const result = calculateRValues(rdiiTS, rainTS, rainfallEvents, sewershedArea);
    setRValueResult(result);
  }, [rdiiSeries, rainfallData, rainfallEvents, sewershedArea, setRValueResult]);

  const handleVolumeBalance = useCallback(() => {
    if (!flowData || !dwfResult || !rdiiSeries) return;
    const totalTS: TimeSeriesPoint[] = flowData.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: flowData.values[i],
    }));
    const dwfTS: TimeSeriesPoint[] = flowData.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: dwfResult.baseFlow[i],
    }));
    const rdiiTS: TimeSeriesPoint[] = rdiiSeries.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: rdiiSeries.values[i],
    }));
    const step = flowData.timestamps.length > 1
      ? (flowData.timestamps[1].getTime() - flowData.timestamps[0].getTime()) / 3600000 : 1;
    const gwi = mnfResult?.gwiEstimate || dwfResult.meanGWI;
    const bsf = bsfResult?.bsf || (dwfResult.meanDWF - gwi);
    const result = calculateVolumeBalance(totalTS, dwfTS, gwi, bsf, rdiiTS, step);
    setVolumeBalance(result);
  }, [flowData, dwfResult, rdiiSeries, mnfResult, bsfResult, setVolumeBalance]);

  const peakRDII = rdiiSeries && rdiiSeries.values.length > 0 ? Math.max(...rdiiSeries.values) : 0;
  const totalFlow = flowData ? flowData.values.reduce((a, b) => a + b, 0) : 0;
  const rdiiPct = totalFlow > 0 && rdiiSeries ? ((rdiiSeries.totalVolume / totalFlow) * 100) : 0;

  const chartData = flowData && dwfResult && rdiiSeries
    ? (() => {
        const step = Math.max(1, Math.floor(flowData.timestamps.length / 500));
        const data: { time: string; observed: number; dwfGwi: number; rdii: number }[] = [];
        for (let i = 0; i < flowData.timestamps.length; i += step) {
          data.push({
            time: flowData.timestamps[i].toLocaleDateString(),
            observed: flowData.values[i],
            dwfGwi: (dwfResult.baseFlow[i] || 0) + dwfResult.meanGWI,
            rdii: rdiiSeries.values[i],
          });
        }
        return data;
      })()
    : [];

  const pieData = volumeBalance ? [
    { name: "BSF", value: volumeBalance.bsfPercent, fill: PIE_COLORS[0] },
    { name: "GWI", value: volumeBalance.gwiPercent, fill: PIE_COLORS[1] },
    { name: "RDII", value: volumeBalance.rdiiPercent, fill: PIE_COLORS[2] },
  ] : [];

  if (!flowData || !dwfResult) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Activity className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Complete DWF/GWI separation first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="extract" data-testid="tab-rdii-extract"><Activity className="h-3.5 w-3.5 mr-1" />Extract</TabsTrigger>
          <TabsTrigger value="rvalue" data-testid="tab-rvalue"><BarChart3 className="h-3.5 w-3.5 mr-1" />R-Values</TabsTrigger>
          <TabsTrigger value="balance" data-testid="tab-balance"><PieChart className="h-3.5 w-3.5 mr-1" />Balance</TabsTrigger>
        </TabsList>

        <TabsContent value="extract" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={running} data-testid="button-generate-rdii">
              <Play className="mr-2 h-4 w-4" />
              {running ? "Computing..." : "Generate RDII Series"}
            </Button>
          </div>

          {rdiiSeries && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total RDII Volume</p>
                    <p className="text-2xl font-bold font-mono" data-testid="text-rdii-volume">{rdiiSeries.totalVolume.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{flowData.units} (cumulative)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Peak RDII</p>
                    <p className="text-2xl font-bold font-mono" data-testid="text-peak-rdii">{peakRDII.toFixed(3)}</p>
                    <p className="text-xs text-muted-foreground">{flowData.units}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">RDII % of Total</p>
                    <p className="text-2xl font-bold font-mono" data-testid="text-rdii-pct">{rdiiPct.toFixed(1)}%</p>
                    <Badge variant={rdiiPct > 30 ? "destructive" : rdiiPct > 15 ? "secondary" : "default"} className="mt-1">
                      {rdiiPct > 30 ? "High" : rdiiPct > 15 ? "Moderate" : "Low"}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">RDII Decomposition</CardTitle>
                  <CardDescription className="text-xs">Observed flow, DWF+GWI baseline, and RDII component</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      observed: { label: "Observed Flow", color: "hsl(var(--chart-1))" },
                      dwfGwi: { label: "DWF + GWI", color: "hsl(var(--chart-2))" },
                      rdii: { label: "RDII", color: "hsl(var(--chart-3))" },
                    }}
                    className="h-[350px] w-full"
                  >
                    <ResponsiveContainer>
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Area type="monotone" dataKey="observed" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.15} strokeWidth={1.5} name="Observed Flow" />
                        <Line type="monotone" dataKey="dwfGwi" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="DWF + GWI" />
                        <Area type="monotone" dataKey="rdii" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.4} strokeWidth={1.5} name="RDII" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="rvalue" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">R-Value Analyzer</CardTitle>
                <HelpTooltip text="R-value is the ratio of RDII volume to rainfall volume for each event. Higher R-values indicate more inflow/infiltration. Typical values: 0.5-5% for good systems, 10-30%+ for deteriorated systems." />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sewershed Area (acres)</Label>
                  <Input type="number" value={sewershedArea} onChange={(e) => setSewershedArea(Number(e.target.value))} data-testid="input-sewershed-area" />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleRValues} disabled={rainfallEvents.length === 0 || !rdiiSeries} data-testid="button-calc-rvalues">
                    <Calculator className="mr-2 h-4 w-4" />
                    Calculate R-Values
                  </Button>
                </div>
              </div>
              {rainfallEvents.length === 0 && (
                <p className="text-xs text-muted-foreground">Detect rainfall events first (Events tab)</p>
              )}
            </CardContent>
          </Card>

          {rValueResult && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xl font-bold font-mono" data-testid="text-mean-r">{rValueResult.meanR.toFixed(2)}%</p>
                    <p className="text-xs text-muted-foreground">Mean R-Value</p>
                    <Badge variant={rValueResult.meanR > 10 ? "destructive" : rValueResult.meanR > 3 ? "secondary" : "default"} className="mt-1 text-xs">
                      {rValueResult.meanR > 10 ? "High I/I" : rValueResult.meanR > 3 ? "Moderate I/I" : "Low I/I"}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xl font-bold font-mono">{rValueResult.medianR.toFixed(2)}%</p>
                    <p className="text-xs text-muted-foreground">Median R-Value</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xl font-bold font-mono">{rValueResult.stdDevR.toFixed(2)}%</p>
                    <p className="text-xs text-muted-foreground">Std Dev</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">R-Value by Event</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead className="text-right">Rainfall (in)</TableHead>
                          <TableHead className="text-right">RDII Vol</TableHead>
                          <TableHead className="text-right">R-Value (%)</TableHead>
                          <TableHead>Rating</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rValueResult.rByEvent.map((r, i) => (
                          <TableRow key={i} data-testid={`row-rvalue-${i}`}>
                            <TableCell className="text-xs font-mono">{r.eventId}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{r.rainfall.toFixed(3)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{r.volume.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{r.rValue.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={r.rValue > 10 ? "destructive" : r.rValue > 3 ? "secondary" : "default"} className="text-xs">
                                {r.rValue > 10 ? "High" : r.rValue > 3 ? "Moderate" : "Low"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="balance" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">Volume Balance Check</CardTitle>
                <HelpTooltip text="Verify flow decomposition closure: Total Monitored = BSF + GWI + RDII. Closure error indicates data quality issues or model problems." />
              </div>
            </CardHeader>
            <CardContent>
              <Button onClick={handleVolumeBalance} disabled={!rdiiSeries} data-testid="button-calc-balance">
                <PieChart className="mr-2 h-4 w-4" />
                Calculate Volume Balance
              </Button>
            </CardContent>
          </Card>

          {volumeBalance && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-lg font-bold font-mono" data-testid="text-total-vol">{volumeBalance.totalMonitored.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Total Monitored</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-lg font-bold font-mono">{volumeBalance.totalBSF.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">BSF ({volumeBalance.bsfPercent.toFixed(1)}%)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-lg font-bold font-mono">{volumeBalance.totalGWI.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">GWI ({volumeBalance.gwiPercent.toFixed(1)}%)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-lg font-bold font-mono">{volumeBalance.totalRDII.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">RDII ({volumeBalance.rdiiPercent.toFixed(1)}%)</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Flow Component Breakdown</CardTitle>
                  <CardDescription className="text-xs">
                    Closure Error: {volumeBalance.closureError.toFixed(2)}%
                    <Badge variant={volumeBalance.closureError < 5 ? "default" : "destructive"} className="ml-2 text-xs">
                      {volumeBalance.closureError < 5 ? "Good" : "Check Data"}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{
                    BSF: { label: "BSF", color: PIE_COLORS[0] },
                    GWI: { label: "GWI", color: PIE_COLORS[1] },
                    RDII: { label: "RDII", color: PIE_COLORS[2] },
                  }} className="h-[250px] w-full">
                    <ResponsiveContainer>
                      <RPie>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}>
                          {pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </RPie>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {rdiiSeries && onNext && (
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
