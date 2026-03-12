import { useState, useCallback, useMemo } from "react";
import { CloudRain, ArrowRight, Play, Calendar, Droplets, ThermometerSun, TableIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";
import type { DetectedEvent } from "@/contexts/CalibrationDataContext";
import {
  delineateRainfallEvents, selectDryDays, calculateAntecedentMoisture,
  characterizeEvents, type TimeSeriesPoint,
} from "@/lib/flowDecomposition";
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Legend, ReferenceArea, ScatterChart, Scatter,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { HelpTooltip } from "./HelpTooltip";

interface EventsTabProps {
  onNext?: () => void;
}

export function EventsTab({ onNext }: EventsTabProps) {
  const {
    flowData, rainfallData, rdiiSeries, detectedEvents, setDetectedEvents,
    dryDays, setDryDays, rainfallEvents, setRainfallEvents,
    moistureIndex, setMoistureIndex, eventCharacterizations, setEventCharacterizations,
  } = useCalibrationData();
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("events");
  const [mit, setMit] = useState(6);
  const [minDepth, setMinDepth] = useState(0.10);
  const [minDuration, setMinDuration] = useState(1);
  const [recoveryHours, setRecoveryHours] = useState(12);
  const [adpHours, setAdpHours] = useState(48);
  const [subDryHours, setSubDryHours] = useState(12);
  const [moistureMethod, setMoistureMethod] = useState<"api" | "5day" | "amc">("api");
  const [decayFactor, setDecayFactor] = useState(0.90);
  const [sewershedArea, setSewershedArea] = useState(100);
  const [sortCol, setSortCol] = useState<string>("depth");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleDetect = useCallback(() => {
    if (!rainfallData) return;
    setRunning(true);
    setTimeout(() => {
      const rainTS: TimeSeriesPoint[] = rainfallData.timestamps.map((t, i) => ({
        timestamp: t.getTime(), value: rainfallData.values[i],
      }));

      const events = delineateRainfallEvents(rainTS, {
        minInterEventHours: mit,
        minDepth,
        minDurationHours: minDuration,
        recoveryHours,
      });
      setRainfallEvents(events);

      const legacy: DetectedEvent[] = events.map((evt, i) => {
        let rdiiVolume = 0;
        let peakRDII = 0;
        if (rdiiSeries) {
          for (let j = evt.startIndex; j <= Math.min(evt.endIndex + 24, rdiiSeries.values.length - 1); j++) {
            rdiiVolume += rdiiSeries.values[j] || 0;
            if ((rdiiSeries.values[j] || 0) > peakRDII) peakRDII = rdiiSeries.values[j];
          }
        }
        return {
          id: i,
          startIndex: evt.startIndex,
          endIndex: evt.endIndex,
          startDate: new Date(evt.startTime).toISOString(),
          endDate: new Date(evt.endTime).toISOString(),
          rainDepth: evt.totalDepth,
          rdiiVolume,
          peakRDII,
          duration: evt.duration,
          selected: true,
        };
      });
      setDetectedEvents(legacy);
      setRunning(false);
    }, 300);
  }, [rainfallData, rdiiSeries, mit, minDepth, minDuration, recoveryHours, setDetectedEvents, setRainfallEvents]);

  const handleDryDaySelection = useCallback(() => {
    if (!flowData || !rainfallData) return;
    const flowTS: TimeSeriesPoint[] = flowData.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: flowData.values[i],
    }));
    const rainTS: TimeSeriesPoint[] = rainfallData.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: rainfallData.values[i],
    }));
    const days = selectDryDays(flowTS, rainTS, {
      antecedentDryHours: adpHours,
      subsequentDryHours: subDryHours,
    });
    setDryDays(days);
  }, [flowData, rainfallData, adpHours, subDryHours, setDryDays]);

  const handleMoistureCalc = useCallback(() => {
    if (!rainfallData) return;
    const rainTS: TimeSeriesPoint[] = rainfallData.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: rainfallData.values[i],
    }));
    const idx = calculateAntecedentMoisture(rainTS, moistureMethod, decayFactor);
    setMoistureIndex(idx);
  }, [rainfallData, moistureMethod, decayFactor, setMoistureIndex]);

  const handleCharacterize = useCallback(() => {
    if (rainfallEvents.length === 0 || !rdiiSeries || !rainfallData) return;
    const rdiiTS: TimeSeriesPoint[] = rdiiSeries.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: rdiiSeries.values[i],
    }));
    const rainTS: TimeSeriesPoint[] = rainfallData.timestamps.map((t, i) => ({
      timestamp: t.getTime(), value: rainfallData.values[i],
    }));
    const chars = characterizeEvents(rainfallEvents, rdiiTS, rainTS, moistureIndex, sewershedArea);
    setEventCharacterizations(chars);
  }, [rainfallEvents, rdiiSeries, rainfallData, moistureIndex, sewershedArea, setEventCharacterizations]);

  const toggleEvent = useCallback((id: number) => {
    setDetectedEvents(detectedEvents.map((e) => e.id === id ? { ...e, selected: !e.selected } : e));
  }, [detectedEvents, setDetectedEvents]);

  const chartData = rainfallData
    ? (() => {
        const step = Math.max(1, Math.floor(rainfallData.timestamps.length / 500));
        const data: { time: string; idx: number; rainfall: number }[] = [];
        for (let i = 0; i < rainfallData.timestamps.length; i += step) {
          data.push({
            time: rainfallData.timestamps[i].toLocaleDateString(),
            idx: i,
            rainfall: rainfallData.values[i],
          });
        }
        return data;
      })()
    : [];

  const sortedChars = useMemo(() => {
    if (eventCharacterizations.length === 0) return [];
    return [...eventCharacterizations].sort((a, b) => {
      const aVal = (a as any)[sortCol] ?? 0;
      const bVal = (b as any)[sortCol] ?? 0;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [eventCharacterizations, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const weekdayDry = dryDays.filter(d => !d.isWeekend).length;
  const weekendDry = dryDays.filter(d => d.isWeekend).length;

  const calendarData = useMemo(() => {
    if (dryDays.length === 0) return [];
    const months = new Map<string, { dry: number; wet: number; total: number }>();
    dryDays.forEach(d => {
      const m = d.date.substring(0, 7);
      if (!months.has(m)) months.set(m, { dry: 0, wet: 0, total: 0 });
      months.get(m)!.dry++;
    });
    return Array.from(months.entries()).map(([month, data]) => ({
      month: month.substring(5),
      dryDays: data.dry,
    }));
  }, [dryDays]);

  if (!rainfallData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CloudRain className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Import rainfall data first to detect storm events.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="events" data-testid="tab-event-delineator"><CloudRain className="h-3.5 w-3.5 mr-1" />Events</TabsTrigger>
          <TabsTrigger value="drydays" data-testid="tab-dry-days"><Calendar className="h-3.5 w-3.5 mr-1" />Dry Days</TabsTrigger>
          <TabsTrigger value="moisture" data-testid="tab-moisture"><Droplets className="h-3.5 w-3.5 mr-1" />Moisture</TabsTrigger>
          <TabsTrigger value="characterize" data-testid="tab-characterize"><TableIcon className="h-3.5 w-3.5 mr-1" />Characterize</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">Rainfall Event Delineation</CardTitle>
                <HelpTooltip text="Separate continuous rainfall into distinct storm events using Minimum Inter-Event Time (MIT). Events below minimum depth or duration are filtered out." />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Min Inter-Event Time (hrs)</Label>
                  <Input type="number" value={mit} onChange={(e) => setMit(Number(e.target.value))} min={2} max={24} data-testid="input-mit" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Min Rainfall Depth (in)</Label>
                  <Input type="number" value={minDepth} onChange={(e) => setMinDepth(Number(e.target.value))} min={0.01} max={1} step={0.01} data-testid="input-min-depth" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Min Duration (hrs)</Label>
                  <Input type="number" value={minDuration} onChange={(e) => setMinDuration(Number(e.target.value))} min={0.25} max={6} step={0.25} data-testid="input-min-duration" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Recovery Period (hrs)</Label>
                  <Input type="number" value={recoveryHours} onChange={(e) => setRecoveryHours(Number(e.target.value))} min={6} max={72} data-testid="input-recovery" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button onClick={handleDetect} disabled={running} data-testid="button-detect-events">
                  <Play className="mr-2 h-4 w-4" />
                  {running ? "Detecting..." : "Detect Events"}
                </Button>
                {detectedEvents.length > 0 && (
                  <Badge variant="outline" data-testid="badge-event-count">{detectedEvents.length} events detected</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {chartData.length > 0 && detectedEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Rainfall with Event Windows</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{ rainfall: { label: "Rainfall", color: "hsl(var(--chart-2))" } }} className="h-[250px] w-full">
                  <ResponsiveContainer>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="rainfall" fill="hsl(var(--chart-2))" fillOpacity={0.7} name="Rainfall" />
                      {detectedEvents.filter((e) => e.selected).map((evt) => (
                        <ReferenceArea
                          key={evt.id}
                          x1={rainfallData.timestamps[evt.startIndex]?.toLocaleDateString()}
                          x2={rainfallData.timestamps[evt.endIndex]?.toLocaleDateString()}
                          fill="hsl(var(--primary))"
                          fillOpacity={0.1}
                          stroke="hsl(var(--primary))"
                          strokeOpacity={0.3}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {detectedEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Detected Storm Events</CardTitle>
                <CardDescription className="text-xs">Select events for calibration</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Use</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead className="text-right">Duration (hrs)</TableHead>
                        <TableHead className="text-right">Rain Depth</TableHead>
                        <TableHead className="text-right">Peak Int.</TableHead>
                        <TableHead className="text-right">RDII Vol</TableHead>
                        <TableHead className="text-right">Peak RDII</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detectedEvents.map((evt) => (
                        <TableRow key={evt.id} data-testid={`row-event-${evt.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={evt.selected}
                              onCheckedChange={() => toggleEvent(evt.id)}
                              data-testid={`checkbox-event-${evt.id}`}
                            />
                          </TableCell>
                          <TableCell className="text-xs font-mono">{new Date(evt.startDate).toLocaleString()}</TableCell>
                          <TableCell className="text-xs font-mono">{new Date(evt.endDate).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{evt.duration.toFixed(1)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{evt.rainDepth.toFixed(3)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {rainfallEvents[evt.id] ? rainfallEvents[evt.id].peakIntensity.toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">{evt.rdiiVolume.toFixed(3)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{evt.peakRDII.toFixed(4)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="drydays" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">Dry Day Selection</CardTitle>
                <HelpTooltip text="Identify true dry weather days for DWF analysis. Days must have no rainfall and sufficient antecedent dryness to exclude residual RDII effects." />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Antecedent Dry Hours</Label>
                  <Input type="number" value={adpHours} onChange={(e) => setAdpHours(Number(e.target.value))} min={12} max={120} data-testid="input-adp-hours" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subsequent Dry Hours</Label>
                  <Input type="number" value={subDryHours} onChange={(e) => setSubDryHours(Number(e.target.value))} min={6} max={48} data-testid="input-sub-dry-hours" />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleDryDaySelection} disabled={!flowData} data-testid="button-select-dry-days">
                    <Calendar className="mr-2 h-4 w-4" />
                    Select Dry Days
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {dryDays.length > 0 && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold font-mono" data-testid="text-total-dry-days">{dryDays.length}</p>
                    <p className="text-xs text-muted-foreground">Total Dry Days</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold font-mono">{weekdayDry}</p>
                    <p className="text-xs text-muted-foreground">Weekday Dry Days</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold font-mono">{weekendDry}</p>
                    <p className="text-xs text-muted-foreground">Weekend Dry Days</p>
                  </CardContent>
                </Card>
              </div>

              {calendarData.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Monthly Dry Day Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={{ dryDays: { label: "Dry Days", color: "hsl(var(--chart-4))" } }} className="h-[200px] w-full">
                      <ResponsiveContainer>
                        <ComposedChart data={calendarData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="dryDays" fill="hsl(var(--chart-4))" name="Dry Days" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Dry Day List</CardTitle>
                  <CardDescription className="text-xs">Classified by weekday/weekend and season</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Day</TableHead>
                          <TableHead>Season</TableHead>
                          <TableHead className="text-right">Mean Flow</TableHead>
                          <TableHead className="text-right">Min Flow</TableHead>
                          <TableHead className="text-right">Max Flow</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dryDays.slice(0, 50).map((d, i) => (
                          <TableRow key={i} data-testid={`row-dry-day-${i}`}>
                            <TableCell className="text-xs font-mono">{d.date}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant={d.isWeekend ? "secondary" : "outline"} className="text-xs">
                                {d.isWeekend ? "Weekend" : "Weekday"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{d.season}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{d.meanFlow.toFixed(3)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{d.minFlow.toFixed(3)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{d.maxFlow.toFixed(3)}</TableCell>
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

        <TabsContent value="moisture" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">Antecedent Moisture Tracker</CardTitle>
                <HelpTooltip text="Track soil moisture state to improve RDII prediction. API uses exponential decay, 5-day sums preceding rainfall, and SCS classifies into AMC I/II/III." />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Method</Label>
                  <Select value={moistureMethod} onValueChange={(v) => setMoistureMethod(v as any)} data-testid="select-moisture-method">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api">API (Antecedent Precipitation Index)</SelectItem>
                      <SelectItem value="5day">5-Day Antecedent Rainfall</SelectItem>
                      <SelectItem value="amc">SCS AMC (I/II/III)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {moistureMethod === "api" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Decay Factor (k)</Label>
                    <Input type="number" value={decayFactor} onChange={(e) => setDecayFactor(Number(e.target.value))} min={0.8} max={0.99} step={0.01} data-testid="input-decay-factor" />
                  </div>
                )}
                <div className="flex items-end">
                  <Button onClick={handleMoistureCalc} disabled={!rainfallData} data-testid="button-calc-moisture">
                    <Droplets className="mr-2 h-4 w-4" />
                    Calculate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {moistureIndex.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Moisture Index Time Series</CardTitle>
                <CardDescription className="text-xs">
                  {moistureMethod === 'api' ? 'API' : moistureMethod === '5day' ? '5-Day Sum' : 'AMC Class'} over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{ moisture: { label: "Moisture Index", color: "hsl(var(--chart-3))" } }} className="h-[250px] w-full">
                  <ResponsiveContainer>
                    <ComposedChart data={moistureIndex.map(m => ({
                      time: new Date(m.timestamp).toLocaleDateString(),
                      value: m.value,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.3} name="Moisture Index" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="characterize" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm">Event Characterization Table</CardTitle>
                <HelpTooltip text="Build a comprehensive table of all events with key metrics. Sort and filter to select the best events for calibration." />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sewershed Area (acres)</Label>
                  <Input type="number" value={sewershedArea} onChange={(e) => setSewershedArea(Number(e.target.value))} data-testid="input-sewershed-area" />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCharacterize} disabled={rainfallEvents.length === 0} data-testid="button-characterize">
                    <TableIcon className="mr-2 h-4 w-4" />
                    Characterize Events
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {sortedChars.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Event Metrics</CardTitle>
                <CardDescription className="text-xs">Click column headers to sort. {sortedChars.length} events.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer" onClick={() => toggleSort('eventId')}>Event</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => toggleSort('date')}>Date</TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('depth')}>Depth (in)</TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('duration')}>Dur (hr)</TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('peakIntensity')}>Peak (in/hr)</TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('adpDays')}>ADP (days)</TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('api')}>API</TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('rValue')}>R-val (%)</TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('peakRDII')}>Peak RDII</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedChars.map((c, i) => (
                        <TableRow key={i} data-testid={`row-char-${i}`}>
                          <TableCell className="text-xs font-mono">{c.eventId}</TableCell>
                          <TableCell className="text-xs font-mono">{c.date}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{c.depth.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{c.duration.toFixed(1)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{c.peakIntensity.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{c.adpDays.toFixed(1)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{c.api.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{c.rValue.toFixed(1)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{c.peakRDII.toFixed(4)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {detectedEvents.length > 0 && onNext && (
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
