import { useState } from "react";
import { GitCompare, ArrowRight, Plus, Trash2, MapPin } from "lucide-react";
import { ModelValidationDashboard } from "./ModelValidationDashboard";
import { ParameterCorrelationMatrix } from "./ParameterCorrelationMatrix";
import { CalibrationProjectManager } from "./CalibrationProjectManager";
import { HydrographVisualization } from "./HydrographVisualization";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Brush,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface CompareTabProps {
  onNext?: () => void;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface SewershedEntry {
  id: string;
  name: string;
  area: number;
  R1: number; T1: number; K1: number;
  R2: number; T2: number; K2: number;
  R3: number; T3: number; K3: number;
  nse: number;
}

function classifyResponse(entry: SewershedEntry): string {
  const total = entry.R1 + entry.R2 + entry.R3;
  if (total === 0) return "N/A";
  const fastFrac = entry.R1 / total;
  const slowFrac = entry.R3 / total;
  if (fastFrac > 0.5) return "Inflow-Dominant";
  if (slowFrac > 0.5) return "Infiltration-Dominant";
  return "Balanced";
}

function MultiSewershedComparison() {
  const [sewersheds, setSewersheds] = useState<SewershedEntry[]>(() => {
    try {
      const saved = localStorage.getItem("multi-sewershed-data");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState(50);
  const { optimizationResults, selectedSolutionIndex } = useCalibrationData();

  function addCurrentSewershed() {
    if (!newName.trim() || optimizationResults.length === 0) return;
    const sel = optimizationResults[selectedSolutionIndex] || optimizationResults[0];
    const entry: SewershedEntry = {
      id: `sw-${Date.now()}`,
      name: newName.trim(),
      area: newArea,
      ...sel.parameters,
      nse: sel.nse,
    };
    const updated = [...sewersheds, entry];
    setSewersheds(updated);
    localStorage.setItem("multi-sewershed-data", JSON.stringify(updated));
    setNewName("");
  }

  function removeEntry(id: string) {
    if (!confirm("Remove this sewershed from the comparison?")) return;
    const updated = sewersheds.filter(s => s.id !== id);
    setSewersheds(updated);
    localStorage.setItem("multi-sewershed-data", JSON.stringify(updated));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Multi-Sewershed Comparison
        </CardTitle>
        <CardDescription className="text-xs">
          Save calibrated RTK from different sewersheds and compare side-by-side
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {optimizationResults.length > 0 && (
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Sewershed Name</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g., Downtown Core"
                className="h-8 text-xs"
                data-testid="input-sewershed-name"
              />
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-xs">Area (ac)</Label>
              <Input
                type="number"
                value={newArea}
                onChange={e => setNewArea(Number(e.target.value))}
                className="h-8 text-xs"
                data-testid="input-sewershed-area"
              />
            </div>
            <Button size="sm" className="h-8" onClick={addCurrentSewershed} data-testid="button-add-sewershed">
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
        )}

        {sewersheds.length > 0 ? (
          <ScrollArea className="h-[250px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Sewershed</TableHead>
                  <TableHead className="text-xs text-right">Area</TableHead>
                  <TableHead className="text-xs text-right">R-total</TableHead>
                  <TableHead className="text-xs text-right">R1</TableHead>
                  <TableHead className="text-xs text-right">R2</TableHead>
                  <TableHead className="text-xs text-right">R3</TableHead>
                  <TableHead className="text-xs text-right">NSE</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sewersheds.map(s => {
                  const responseType = classifyResponse(s);
                  const total = s.R1 + s.R2 + s.R3;
                  return (
                    <TableRow key={s.id} data-testid={`row-sewershed-${s.id}`}>
                      <TableCell className="text-xs font-medium">{s.name}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{s.area}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{total.toFixed(4)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{s.R1.toFixed(4)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{s.R2.toFixed(4)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{s.R3.toFixed(4)}</TableCell>
                      <TableCell className="text-xs text-right">
                        <Badge variant={s.nse >= 0.75 ? "default" : s.nse >= 0.5 ? "secondary" : "destructive"} className="text-[10px]">
                          {(s.nse * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">{responseType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeEntry(s.id)} data-testid={`button-delete-sewershed-${s.id}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            No sewersheds saved yet. Run calibration and add results for each sewershed.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function CompareTab({ onNext }: CompareTabProps) {
  const { optimizationResults, selectedSolutionIndex, setSelectedSolutionIndex, rdiiSeries } = useCalibrationData();

  if (optimizationResults.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <GitCompare className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Run calibration first to compare results.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = rdiiSeries
    ? (() => {
        const step = Math.max(1, Math.floor(rdiiSeries.values.length / 400));
        const data: Record<string, number | string>[] = [];
        for (let i = 0; i < rdiiSeries.values.length; i += step) {
          const point: Record<string, number | string> = {
            idx: i,
            observed: rdiiSeries.values[i],
          };
          optimizationResults.forEach((r, j) => {
            point[`sim_${j}`] = r.simulatedFlow?.[i] || 0;
          });
          data.push(point);
        }
        return data;
      })()
    : [];

  const chartConfig: Record<string, { label: string; color: string }> = {
    observed: { label: "Observed", color: "hsl(var(--chart-1))" },
  };
  optimizationResults.forEach((r, i) => {
    chartConfig[`sim_${i}`] = {
      label: r.label || `Solution ${i + 1}`,
      color: CHART_COLORS[(i + 1) % CHART_COLORS.length],
    };
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Calibration Results Comparison</CardTitle>
          <CardDescription className="text-xs">{optimizationResults.length} solutions available</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Solution</TableHead>
                  <TableHead className="text-right">RMSE</TableHead>
                  <TableHead className="text-right">NSE</TableHead>
                  <TableHead className="text-right">Vol Err %</TableHead>
                  <TableHead className="text-right">Peak Err %</TableHead>
                  <TableHead className="text-right">R1</TableHead>
                  <TableHead className="text-right">R2</TableHead>
                  <TableHead className="text-right">R3</TableHead>
                  <TableHead className="text-right">T1</TableHead>
                  <TableHead className="text-right">T2</TableHead>
                  <TableHead className="text-right">T3</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {optimizationResults.map((r, i) => (
                  <TableRow
                    key={i}
                    className={`cursor-pointer ${i === selectedSolutionIndex ? "bg-primary/10" : ""}`}
                    onClick={() => setSelectedSolutionIndex(i)}
                    data-testid={`row-solution-${i}`}
                  >
                    <TableCell>
                      {i === selectedSolutionIndex && <Badge variant="default" className="text-xs">Selected</Badge>}
                    </TableCell>
                    <TableCell className="font-medium text-xs">{r.label || `Solution ${i + 1}`}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.rmse.toFixed(4)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{(r.nse * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.volumeError.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.peakError.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.parameters.R1.toFixed(4)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.parameters.R2.toFixed(4)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.parameters.R3.toFixed(4)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.parameters.T1.toFixed(1)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.parameters.T2.toFixed(1)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.parameters.T3.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Hydrograph Overlay</CardTitle>
            <CardDescription className="text-xs">Observed vs all simulated solutions</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="idx" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Area type="monotone" dataKey="observed" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.1} strokeWidth={1.5} name="Observed" />
                  {optimizationResults.map((r, i) => (
                    <Line
                      key={i}
                      type="monotone"
                      dataKey={`sim_${i}`}
                      stroke={CHART_COLORS[(i + 1) % CHART_COLORS.length]}
                      strokeWidth={i === selectedSolutionIndex ? 3 : 1}
                      strokeOpacity={i === selectedSolutionIndex ? 1 : 0.5}
                      dot={false}
                      name={r.label || `Solution ${i + 1}`}
                    />
                  ))}
                  <Brush dataKey="idx" height={20} stroke="hsl(var(--primary))" travellerWidth={8} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <HydrographVisualization />

      <ModelValidationDashboard />

      <ParameterCorrelationMatrix />

      <CalibrationProjectManager />

      <MultiSewershedComparison />

      {onNext && (
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
