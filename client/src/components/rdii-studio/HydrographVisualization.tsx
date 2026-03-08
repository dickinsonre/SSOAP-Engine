import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Layers } from "lucide-react";

function generateTriangularUH(T: number, K: number, dt: number): number[] {
  const duration = T + T * K;
  const steps = Math.ceil(duration / dt);
  const uh: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    let q = 0;
    if (t <= T) q = t / T;
    else if (t <= T + T * K) q = 1 - (t - T) / (T * K);
    uh.push(Math.max(0, q));
  }
  const sum = uh.reduce((a, b) => a + b, 0);
  return uh.map((v) => (sum > 0 ? v / sum : 0));
}

function convolve(rain: number[], uh: number[]): number[] {
  const result = new Array(rain.length).fill(0);
  for (let i = 0; i < rain.length; i++) {
    for (let j = 0; j < uh.length && i + j < result.length; j++) {
      result[i + j] += rain[i] * uh[j];
    }
  }
  return result;
}

interface ComponentStats {
  peak: number;
  timeToPeak: number;
  volume: number;
}

function computeComponentStats(values: number[]): ComponentStats {
  let peak = 0;
  let timeToPeak = 0;
  let volume = 0;
  for (let i = 0; i < values.length; i++) {
    volume += values[i];
    if (values[i] > peak) {
      peak = values[i];
      timeToPeak = i;
    }
  }
  return { peak, timeToPeak, volume };
}

const FAST_COLOR = "hsl(0 72% 51%)";
const MEDIUM_COLOR = "hsl(25 95% 53%)";
const SLOW_COLOR = "hsl(217 91% 60%)";
const OBSERVED_COLOR = "hsl(var(--chart-1))";

export function HydrographVisualization() {
  const { rainfallData, rdiiSeries, optimizationResults, selectedSolutionIndex } = useCalibrationData();

  const selectedResult = optimizationResults.length > 0
    ? optimizationResults[selectedSolutionIndex] ?? optimizationResults[0]
    : null;

  const { chartData, fastStats, mediumStats, slowStats } = useMemo(() => {
    if (!rainfallData || !rdiiSeries || !selectedResult) {
      return { chartData: [], fastStats: null, mediumStats: null, slowStats: null };
    }

    const params = selectedResult.parameters;
    const rain = rainfallData.values;

    const uh1 = generateTriangularUH(params.T1, params.K1, 1);
    const uh2 = generateTriangularUH(params.T2, params.K2, 1);
    const uh3 = generateTriangularUH(params.T3, params.K3, 1);

    const fast = convolve(rain.map((r) => r * params.R1), uh1);
    const medium = convolve(rain.map((r) => r * params.R2), uh2);
    const slow = convolve(rain.map((r) => r * params.R3), uh3);

    const fastStats = computeComponentStats(fast);
    const mediumStats = computeComponentStats(medium);
    const slowStats = computeComponentStats(slow);

    const step = Math.max(1, Math.floor(rdiiSeries.values.length / 400));
    const data: Record<string, number>[] = [];
    for (let i = 0; i < rdiiSeries.values.length; i += step) {
      data.push({
        idx: i,
        observed: rdiiSeries.values[i],
        fast: fast[i] || 0,
        medium: medium[i] || 0,
        slow: slow[i] || 0,
      });
    }

    return { chartData: data, fastStats, mediumStats, slowStats };
  }, [rainfallData, rdiiSeries, selectedResult]);

  if (!selectedResult || chartData.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Layers className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground" data-testid="text-hydro-viz-empty">
            Run calibration to view RDII component breakdown.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = {
    slow: { label: "Slow (R3)", color: SLOW_COLOR },
    medium: { label: "Medium (R2)", color: MEDIUM_COLOR },
    fast: { label: "Fast (R1)", color: FAST_COLOR },
    observed: { label: "Observed", color: OBSERVED_COLOR },
  };

  const components = [
    { label: "Fast (R1)", stats: fastStats!, color: FAST_COLOR, param: `R=${selectedResult.parameters.R1.toFixed(4)}, T=${selectedResult.parameters.T1.toFixed(1)}h, K=${selectedResult.parameters.K1.toFixed(2)}` },
    { label: "Medium (R2)", stats: mediumStats!, color: MEDIUM_COLOR, param: `R=${selectedResult.parameters.R2.toFixed(4)}, T=${selectedResult.parameters.T2.toFixed(1)}h, K=${selectedResult.parameters.K2.toFixed(2)}` },
    { label: "Slow (R3)", stats: slowStats!, color: SLOW_COLOR, param: `R=${selectedResult.parameters.R3.toFixed(4)}, T=${selectedResult.parameters.T3.toFixed(1)}h, K=${selectedResult.parameters.K3.toFixed(2)}` },
  ];

  return (
    <Card data-testid="card-hydrograph-visualization">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">RDII Component Breakdown</CardTitle>
        <CardDescription className="text-xs">
          Fast, medium, and slow response hydrographs with observed flow overlay
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {components.map((c) => (
            <div key={c.label} className="flex flex-col gap-1 rounded-md border p-3" data-testid={`card-component-${c.label.split(" ")[0].toLowerCase()}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: c.color }} />
                <span className="text-xs font-medium">{c.label}</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">{c.param}</p>
              <div className="flex gap-3 flex-wrap mt-1">
                <Badge variant="secondary" className="text-xs">
                  Peak: {c.stats.peak.toFixed(4)}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  T-Peak: {c.stats.timeToPeak}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Vol: {c.stats.volume.toFixed(2)}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <ResponsiveContainer>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="idx" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="slow"
                stackId="rdii"
                stroke={SLOW_COLOR}
                fill={SLOW_COLOR}
                fillOpacity={0.5}
                strokeWidth={1}
                name="Slow (R3)"
              />
              <Area
                type="monotone"
                dataKey="medium"
                stackId="rdii"
                stroke={MEDIUM_COLOR}
                fill={MEDIUM_COLOR}
                fillOpacity={0.5}
                strokeWidth={1}
                name="Medium (R2)"
              />
              <Area
                type="monotone"
                dataKey="fast"
                stackId="rdii"
                stroke={FAST_COLOR}
                fill={FAST_COLOR}
                fillOpacity={0.5}
                strokeWidth={1}
                name="Fast (R1)"
              />
              <Line
                type="monotone"
                dataKey="observed"
                stroke={OBSERVED_COLOR}
                strokeWidth={2}
                dot={false}
                name="Observed"
              />
              <Brush dataKey="idx" height={20} stroke="hsl(var(--primary))" travellerWidth={8} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
