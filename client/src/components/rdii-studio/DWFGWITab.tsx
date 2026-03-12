import { useState, useCallback } from "react";
import { Waves, ArrowRight, Play, AlertTriangle, Moon, TrendingUp, Calculator } from "lucide-react";
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
import { useCalibrationData } from "@/contexts/CalibrationDataContext";
import { HelpTooltip } from "./HelpTooltip";
import type { DWFResult } from "@/contexts/CalibrationDataContext";
import {
  analyzeMNF, buildGWIModel, calculateBSF, extractDWFPattern, reconstructDWF,
  type TimeSeriesPoint,
} from "@/lib/flowDecomposition";
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Legend,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface DWFGWITabProps {
  onNext?: () => void;
}

export function DWFGWITab({ onNext }: DWFGWITabProps) {
  const {
    flowData, rainfallData, dwfResult, setDWFResult,
    dryDays, mnfResult, setMnfResult, gwiModel, setGwiModel,
    bsfResult, setBsfResult, dwfPattern, setDwfPattern,
  } = useCalibrationData();
  const [running, setRunning] = useState(false);
  const [noDryDays, setNoDryDays] = useState(false);
  const [activeTab, setActiveTab] = useState("separate");
  const [nightStart, setNightStart] = useState(0);
  const [nightEnd, setNightEnd] = useState(5);
  const [mnfMethod, setMnfMethod] = useState<"min" | "mean" | "median" | "p10">("median");
  const [gwiFactor, setGwiFactor] = useState(0.90);
  const [pipeInchMiles, setPipeInchMiles] = useState(100);
  const [gwiModelType, setGwiModelType] = useState<"constant" | "monthly" | "sinusoidal">("constant");
  const [bsfMethod, setBsfMethod] = useState<"per_capita" | "direct" | "billing">("direct");
  const [population, setPopulation] = useState(10000);
  const [gpcd, setGpcd] = useState(80);
  const [patternPercentile, setPatternPercentile] = useState(50);

  const handleSeparate = useCallback(() => {
    if (!flowData || !rainfallData) return;
    setRunning(true);
    setNoDryDays(false);
    setTimeout(() => {
      const n = flowData.timestamps.length;
      const localDayKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const dayRain = new Map<string, number>();
      for (let i = 0; i < rainfallData.timestamps.length; i++) {
        const key = localDayKey(rainfallData.timestamps[i]);
        dayRain.set(key, (dayRain.get(key) || 0) + rainfallData.values[i]);
      }

      const hourlyPattern = new Array(24).fill(0);
      const hourlyCounts = new Array(24).fill(0);
      let gwiEstimate = Infinity;
      let hasDryDays = false;

      for (let i = 0; i < n; i++) {
        const ts = flowData.timestamps[i];
        const key = localDayKey(ts);
        const totalRain = dayRain.get(key) || 0;
        if (totalRain <= 0.01) {
          hasDryDays = true;
          const h = ts.getHours();
          hourlyPattern[h] += flowData.values[i];
          hourlyCounts[h]++;
          if (flowData.values[i] < gwiEstimate) gwiEstimate = flowData.values[i];
        }
      }

      if (hasDryDays) {
        for (let h = 0; h < 24; h++) {
          hourlyPattern[h] = hourlyCounts[h] > 0 ? hourlyPattern[h] / hourlyCounts[h] : 0;
        }
      } else {
        setNoDryDays(true);
        const meanFlow = flowData.values.reduce((a, b) => a + b, 0) / n;
        hourlyPattern.fill(meanFlow);
        gwiEstimate = Math.min(...flowData.values) * 0.8;
      }

      if (!isFinite(gwiEstimate) || gwiEstimate < 0) gwiEstimate = 0;

      const baseFlow: number[] = [];
      const gwiFlow: number[] = [];
      for (let i = 0; i < n; i++) {
        const hour = flowData.timestamps[i].getHours();
        baseFlow.push(hourlyPattern[hour]);
        gwiFlow.push(gwiEstimate);
      }

      const meanDWF = hourlyPattern.reduce((a, b) => a + b, 0) / 24;
      const result: DWFResult = { baseFlow, gwiFlow, dwfPattern: hourlyPattern, meanDWF, meanGWI: gwiEstimate };
      setDWFResult(result);
      setRunning(false);
    }, 300);
  }, [flowData, rainfallData, setDWFResult]);

  const handleMNFAnalysis = useCallback(() => {
    if (!flowData || dryDays.length === 0) return;
    const flowTS: TimeSeriesPoint[] = flowData.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: flowData.values[i],
    }));
    const result = analyzeMNF(flowTS, dryDays, {
      nightStart, nightEnd, method: mnfMethod, gwiFactor, pipeInchMiles,
    });
    setMnfResult(result);
  }, [flowData, dryDays, nightStart, nightEnd, mnfMethod, gwiFactor, pipeInchMiles, setMnfResult]);

  const handleGWIModel = useCallback(() => {
    if (!mnfResult) return;
    const model = buildGWIModel(mnfResult, gwiModelType);
    setGwiModel(model);
  }, [mnfResult, gwiModelType, setGwiModel]);

  const handleBSFCalc = useCallback(() => {
    const gwi = mnfResult?.gwiEstimate || dwfResult?.meanGWI || 0;
    const meanDWF = dwfResult?.meanDWF || 0;
    const result = calculateBSF(meanDWF, gwi, bsfMethod, {
      population, gpcd,
    });
    setBsfResult(result);
  }, [mnfResult, dwfResult, bsfMethod, population, gpcd, setBsfResult]);

  const handlePatternExtraction = useCallback(() => {
    if (!flowData || dryDays.length === 0) return;
    const flowTS: TimeSeriesPoint[] = flowData.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: flowData.values[i],
    }));
    const pattern = extractDWFPattern(flowTS, dryDays, { percentile: patternPercentile });
    setDwfPattern(pattern);
  }, [flowData, dryDays, patternPercentile, setDwfPattern]);

  const chartData = flowData && dwfResult
    ? (() => {
        const step = Math.max(1, Math.floor(flowData.timestamps.length / 500));
        const data: { time: string; total: number; dwf: number; gwi: number }[] = [];
        for (let i = 0; i < flowData.timestamps.length; i += step) {
          data.push({
            time: flowData.timestamps[i].toLocaleDateString(),
            total: flowData.values[i],
            dwf: dwfResult.baseFlow[i],
            gwi: dwfResult.meanGWI,
          });
        }
        return data;
      })()
    : [];

  const patternChartData = dwfPattern
    ? dwfPattern.hourlyMultipliers.map((m, h) => ({
        hour: `${String(h).padStart(2, '0')}:00`,
        all: m,
        weekday: dwfPattern.weekdayMultipliers[h],
        weekend: dwfPattern.weekendMultipliers[h],
      }))
    : dwfResult
    ? dwfResult.dwfPattern.map((v, h) => ({
        hour: `${String(h).padStart(2, '0')}:00`,
        all: dwfResult.meanDWF > 0 ? v / dwfResult.meanDWF : 1,
        weekday: dwfResult.meanDWF > 0 ? v / dwfResult.meanDWF : 1,
        weekend: dwfResult.meanDWF > 0 ? v / dwfResult.meanDWF : 1,
      }))
    : [];

  const monthlyGWIData = mnfResult
    ? mnfResult.monthlyMNF.map((v, i) => ({
        month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
        mnf: v,
        gwi: gwiModel ? gwiModel.values[i] : v * gwiFactor,
      }))
    : [];

  if (!flowData || !rainfallData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Waves className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Import flow and rainfall data first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="separate" data-testid="tab-dwf-separate"><Waves className="h-3.5 w-3.5 mr-1" />Separate</TabsTrigger>
          <TabsTrigger value="mnf" data-testid="tab-mnf"><Moon className="h-3.5 w-3.5 mr-1" />MNF/GWI</TabsTrigger>
          <TabsTrigger value="bsf" data-testid="tab-bsf"><Calculator className="h-3.5 w-3.5 mr-1" />BSF</TabsTrigger>
          <TabsTrigger value="pattern" data-testid="tab-pattern"><TrendingUp className="h-3.5 w-3.5 mr-1" />Pattern</TabsTrigger>
        </TabsList>

        <TabsContent value="separate" className="space-y-4">
          <div className="flex justify-end">
            <div className="flex items-center gap-2">
              <Button onClick={handleSeparate} disabled={running} data-testid="button-separate-dwf">
                <Play className="mr-2 h-4 w-4" />
                {running ? "Processing..." : "Separate DWF/GWI"}
              </Button>
              <HelpTooltip text="Dry Weather Flow (DWF) is the normal sanitary flow without rainfall influence. Groundwater Infiltration (GWI) is the baseline flow from groundwater seeping into pipes." />
            </div>
          </div>

          {noDryDays && dwfResult && (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="flex items-center gap-3 pt-4 pb-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                <p className="text-sm text-muted-foreground" data-testid="text-no-dry-days-warning">
                  No dry days found. DWF estimated using overall mean flow. Use Dry Day selector in Events tab for better results.
                </p>
              </CardContent>
            </Card>
          )}

          {dwfResult && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-muted-foreground">Mean DWF</p>
                      <HelpTooltip text="Average Dry Weather Flow computed from dry-day hourly patterns." />
                    </div>
                    <p className="text-2xl font-bold font-mono" data-testid="text-mean-dwf">{dwfResult.meanDWF.toFixed(3)}</p>
                    <p className="text-xs text-muted-foreground">{flowData.units}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-muted-foreground">Mean GWI</p>
                      <HelpTooltip text="Groundwater Infiltration estimated from minimum observed flows during dry weather." />
                    </div>
                    <p className="text-2xl font-bold font-mono" data-testid="text-mean-gwi">{dwfResult.meanGWI.toFixed(3)}</p>
                    <p className="text-xs text-muted-foreground">{flowData.units}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">GWI as % of DWF</p>
                    <p className="text-2xl font-bold font-mono" data-testid="text-gwi-pct">
                      {dwfResult.meanDWF > 0 ? ((dwfResult.meanGWI / dwfResult.meanDWF) * 100).toFixed(1) : "0.0"}%
                    </p>
                    <Badge variant={dwfResult.meanDWF > 0 && (dwfResult.meanGWI / dwfResult.meanDWF) > 0.15 ? "destructive" : "default"} className="mt-1">
                      {dwfResult.meanDWF > 0 && (dwfResult.meanGWI / dwfResult.meanDWF) > 0.15 ? "High GWI" : "Normal"}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Flow Decomposition</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      total: { label: "Total Flow", color: "hsl(var(--chart-1))" },
                      dwf: { label: "DWF", color: "hsl(var(--chart-2))" },
                      gwi: { label: "GWI Baseline", color: "hsl(var(--chart-4))" },
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
                        <Area type="monotone" dataKey="total" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.2} strokeWidth={1.5} name="Total Flow" />
                        <Line type="monotone" dataKey="dwf" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="DWF" />
                        <Line type="monotone" dataKey="gwi" stroke="hsl(var(--chart-4))" strokeWidth={2} strokeDasharray="5 5" dot={false} name="GWI Baseline" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="mnf" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">Minimum Night Flow Analysis</CardTitle>
                <HelpTooltip text="MNF analysis estimates GWI from the lowest flows during nighttime (typically 12AM-5AM) on dry days. A GWI factor (0.85-0.95) is applied since some night flow is sanitary." />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1.5">
                  <Label className="text-xs">Night Start (hr)</Label>
                  <Input type="number" value={nightStart} onChange={(e) => setNightStart(Number(e.target.value))} min={22} max={2} data-testid="input-night-start" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Night End (hr)</Label>
                  <Input type="number" value={nightEnd} onChange={(e) => setNightEnd(Number(e.target.value))} min={3} max={7} data-testid="input-night-end" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">MNF Method</Label>
                  <Select value={mnfMethod} onValueChange={(v) => setMnfMethod(v as any)} data-testid="select-mnf-method">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="min">Absolute Minimum</SelectItem>
                      <SelectItem value="mean">Mean</SelectItem>
                      <SelectItem value="median">Median</SelectItem>
                      <SelectItem value="p10">P10 (10th percentile)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">GWI Factor</Label>
                  <Input type="number" value={gwiFactor} onChange={(e) => setGwiFactor(Number(e.target.value))} min={0} max={1} step={0.05} data-testid="input-gwi-factor" />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleMNFAnalysis} disabled={dryDays.length === 0} data-testid="button-analyze-mnf">
                    <Moon className="mr-2 h-4 w-4" />
                    Analyze MNF
                  </Button>
                </div>
              </div>
              {dryDays.length === 0 && (
                <p className="text-xs text-muted-foreground">Select dry days first (Events → Dry Days tab)</p>
              )}
            </CardContent>
          </Card>

          {mnfResult && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xl font-bold font-mono" data-testid="text-mean-mnf">{mnfResult.meanMNF.toFixed(3)}</p>
                    <p className="text-xs text-muted-foreground">Mean MNF</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xl font-bold font-mono">{mnfResult.medianMNF.toFixed(3)}</p>
                    <p className="text-xs text-muted-foreground">Median MNF</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xl font-bold font-mono" data-testid="text-gwi-estimate">{mnfResult.gwiEstimate.toFixed(3)}</p>
                    <p className="text-xs text-muted-foreground">GWI Estimate</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-xl font-bold font-mono">{mnfResult.gwiPerInchMile.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">gpd/in-mi</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Seasonal MNF / GWI Model</CardTitle>
                    <div className="flex items-center gap-2">
                      <Select value={gwiModelType} onValueChange={(v) => setGwiModelType(v as any)} data-testid="select-gwi-model">
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="constant">Constant</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="sinusoidal">Sinusoidal</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={handleGWIModel} data-testid="button-build-gwi-model">Build Model</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {monthlyGWIData.length > 0 && (
                    <ChartContainer config={{
                      mnf: { label: "Monthly MNF", color: "hsl(var(--chart-1))" },
                      gwi: { label: "GWI Model", color: "hsl(var(--chart-4))" },
                    }} className="h-[250px] w-full">
                      <ResponsiveContainer>
                        <ComposedChart data={monthlyGWIData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend />
                          <Bar dataKey="mnf" fill="hsl(var(--chart-1))" fillOpacity={0.6} name="Monthly MNF" />
                          <Line type="monotone" dataKey="gwi" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={true} name="GWI Model" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="bsf" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">Base Sanitary Flow Calculator</CardTitle>
                <HelpTooltip text="BSF is the non-GWI component of dry weather flow. Calculate using per-capita method (population × gpcd), direct measurement (mean DWF - GWI), or billing data." />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">BSF Method</Label>
                  <Select value={bsfMethod} onValueChange={(v) => setBsfMethod(v as any)} data-testid="select-bsf-method">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct (DWF - GWI)</SelectItem>
                      <SelectItem value="per_capita">Per Capita</SelectItem>
                      <SelectItem value="billing">Billing Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {bsfMethod === "per_capita" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Population</Label>
                      <Input type="number" value={population} onChange={(e) => setPopulation(Number(e.target.value))} data-testid="input-population" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">GPCD</Label>
                      <Input type="number" value={gpcd} onChange={(e) => setGpcd(Number(e.target.value))} data-testid="input-gpcd" />
                    </div>
                  </>
                )}
                <div className="flex items-end">
                  <Button onClick={handleBSFCalc} data-testid="button-calc-bsf">
                    <Calculator className="mr-2 h-4 w-4" />
                    Calculate BSF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {bsfResult && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xl font-bold font-mono" data-testid="text-bsf">{bsfResult.bsf.toFixed(3)}</p>
                  <p className="text-xs text-muted-foreground">BSF ({flowData?.units || 'MGD'})</p>
                  {bsfResult.method === 'per_capita' && (
                    <p className="text-xs text-muted-foreground mt-1">{bsfResult.population?.toLocaleString()} pop × {bsfResult.gpcd} gpcd</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xl font-bold font-mono">{bsfResult.gwi.toFixed(3)}</p>
                  <p className="text-xs text-muted-foreground">GWI ({flowData?.units || 'MGD'})</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xl font-bold font-mono">{bsfResult.totalDWF.toFixed(3)}</p>
                  <p className="text-xs text-muted-foreground">Total DWF = BSF + GWI</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pattern" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">DWF Pattern Extraction</CardTitle>
                <HelpTooltip text="Extract 24-hour diurnal pattern from dry day flows. Separate weekday/weekend patterns. Choose percentile (50=median, useful for skewed data)." />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Percentile (%)</Label>
                  <Input type="number" value={patternPercentile} onChange={(e) => setPatternPercentile(Number(e.target.value))} min={10} max={90} data-testid="input-percentile" />
                </div>
                <div className="flex items-end">
                  <Button onClick={handlePatternExtraction} disabled={dryDays.length === 0} data-testid="button-extract-pattern">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Extract Pattern
                  </Button>
                </div>
              </div>
              {dryDays.length === 0 && (
                <p className="text-xs text-muted-foreground">Select dry days first (Events → Dry Days tab)</p>
              )}
            </CardContent>
          </Card>

          {patternChartData.length > 0 && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Diurnal Flow Pattern</CardTitle>
                  <CardDescription className="text-xs">24-hour multipliers (1.0 = average)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{
                    weekday: { label: "Weekday", color: "hsl(var(--chart-1))" },
                    weekend: { label: "Weekend", color: "hsl(var(--chart-3))" },
                  }} className="h-[250px] w-full">
                    <ResponsiveContainer>
                      <ComposedChart data={patternChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} domain={[0, 'auto']} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="weekday" fill="hsl(var(--chart-1))" fillOpacity={0.6} name="Weekday" />
                        <Line type="monotone" dataKey="weekend" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name="Weekend" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {dwfPattern && (
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xl font-bold font-mono">{dwfPattern.peakHour}:00</p>
                      <p className="text-xs text-muted-foreground">Peak Hour</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xl font-bold font-mono">{dwfPattern.peakFactor.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Peak Factor</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xl font-bold font-mono">{dwfPattern.minHour}:00</p>
                      <p className="text-xs text-muted-foreground">Min Hour</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xl font-bold font-mono">{dwfPattern.minFactor.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Min Factor</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {dwfResult && onNext && (
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
