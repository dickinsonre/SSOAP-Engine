import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";
import { Activity } from "lucide-react";

interface PerformanceRating {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
}

function getNSERating(nse: number): PerformanceRating {
  if (nse > 0.75) return { label: "Excellent", variant: "default" };
  if (nse > 0.65) return { label: "Good", variant: "secondary" };
  if (nse > 0.50) return { label: "Satisfactory", variant: "outline" };
  return { label: "Unsatisfactory", variant: "destructive" };
}

function getPBIASRating(pbias: number): PerformanceRating {
  const abs = Math.abs(pbias);
  if (abs < 10) return { label: "Excellent", variant: "default" };
  if (abs < 15) return { label: "Good", variant: "secondary" };
  if (abs < 25) return { label: "Satisfactory", variant: "outline" };
  return { label: "Unsatisfactory", variant: "destructive" };
}

function getRSquaredRating(r2: number): PerformanceRating {
  if (r2 > 0.85) return { label: "Excellent", variant: "default" };
  if (r2 > 0.75) return { label: "Good", variant: "secondary" };
  if (r2 > 0.60) return { label: "Satisfactory", variant: "outline" };
  return { label: "Unsatisfactory", variant: "destructive" };
}

function getRMSERating(rmse: number, range: number): PerformanceRating {
  const nrmse = range > 0 ? rmse / range : 1;
  if (nrmse < 0.10) return { label: "Excellent", variant: "default" };
  if (nrmse < 0.20) return { label: "Good", variant: "secondary" };
  if (nrmse < 0.30) return { label: "Satisfactory", variant: "outline" };
  return { label: "Unsatisfactory", variant: "destructive" };
}

function getMAERating(mae: number, mean: number): PerformanceRating {
  const nmae = mean > 0 ? mae / mean : 1;
  if (nmae < 0.10) return { label: "Excellent", variant: "default" };
  if (nmae < 0.20) return { label: "Good", variant: "secondary" };
  if (nmae < 0.30) return { label: "Satisfactory", variant: "outline" };
  return { label: "Unsatisfactory", variant: "destructive" };
}

export function ModelValidationDashboard() {
  const { optimizationResults, selectedSolutionIndex, rdiiSeries } = useCalibrationData();

  const metrics = useMemo(() => {
    if (!rdiiSeries || optimizationResults.length === 0) return null;

    const result = optimizationResults[selectedSolutionIndex];
    if (!result || !result.simulatedFlow) return null;

    const observed = rdiiSeries.values;
    const simulated = result.simulatedFlow;
    const n = Math.min(observed.length, simulated.length);

    if (n === 0) return null;

    let sumObs = 0, sumSim = 0, sumSqErr = 0, sumAbsErr = 0;
    let sumObsSq = 0, sumSimSq = 0, sumObsSim = 0;
    let maxObs = -Infinity, minObs = Infinity;
    const residuals: number[] = [];

    for (let i = 0; i < n; i++) {
      const o = observed[i];
      const s = simulated[i];
      const err = o - s;
      residuals.push(err);
      sumObs += o;
      sumSim += s;
      sumSqErr += err * err;
      sumAbsErr += Math.abs(err);
      sumObsSq += o * o;
      sumSimSq += s * s;
      sumObsSim += o * s;
      if (o > maxObs) maxObs = o;
      if (o < minObs) minObs = o;
    }

    const meanObs = sumObs / n;
    const meanSim = sumSim / n;
    const range = maxObs - minObs;

    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
      ssRes += (observed[i] - simulated[i]) ** 2;
      ssTot += (observed[i] - meanObs) ** 2;
    }

    const nse = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    const pbias = sumObs > 0 ? ((sumObs - sumSim) / sumObs) * 100 : 0;
    const rmse = Math.sqrt(sumSqErr / n);
    const mae = sumAbsErr / n;

    const numerator = n * sumObsSim - sumObs * sumSim;
    const denominator = Math.sqrt((n * sumObsSq - sumObs ** 2) * (n * sumSimSq - sumSim ** 2));
    const r = denominator > 0 ? numerator / denominator : 0;
    const r2 = r * r;

    const binCount = 20;
    const minRes = Math.min(...residuals);
    const maxRes = Math.max(...residuals);
    const binWidth = (maxRes - minRes) / binCount || 1;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      binStart: minRes + i * binWidth,
      binEnd: minRes + (i + 1) * binWidth,
      count: 0,
      label: (minRes + (i + 0.5) * binWidth).toFixed(3),
    }));
    residuals.forEach((r) => {
      let idx = Math.floor((r - minRes) / binWidth);
      if (idx >= binCount) idx = binCount - 1;
      if (idx < 0) idx = 0;
      bins[idx].count++;
    });

    const step = Math.max(1, Math.floor(n / 300));
    const residualTimeSeries: { idx: number; residual: number }[] = [];
    for (let i = 0; i < n; i += step) {
      residualTimeSeries.push({ idx: i, residual: residuals[i] });
    }

    return {
      nse,
      pbias,
      r2,
      rmse,
      mae,
      range,
      meanObs,
      bins,
      residualTimeSeries,
      nseRating: getNSERating(nse),
      pbiasRating: getPBIASRating(pbias),
      r2Rating: getRSquaredRating(r2),
      rmseRating: getRMSERating(rmse, range),
      maeRating: getMAERating(mae, meanObs),
    };
  }, [optimizationResults, selectedSolutionIndex, rdiiSeries]);

  if (!metrics) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Activity className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground" data-testid="text-validation-empty">
            Select a solution with simulated flow to view validation metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  const metricCards = [
    { name: "NSE", value: metrics.nse.toFixed(4), description: "Nash-Sutcliffe Efficiency", rating: metrics.nseRating },
    { name: "PBIAS", value: `${metrics.pbias.toFixed(2)}%`, description: "Percent Bias", rating: metrics.pbiasRating },
    { name: "R\u00B2", value: metrics.r2.toFixed(4), description: "Coefficient of Determination", rating: metrics.r2Rating },
    { name: "RMSE", value: metrics.rmse.toFixed(4), description: "Root Mean Square Error", rating: metrics.rmseRating },
    { name: "MAE", value: metrics.mae.toFixed(4), description: "Mean Absolute Error", rating: metrics.maeRating },
  ];

  const histogramConfig = {
    count: { label: "Frequency", color: "hsl(var(--chart-1))" },
  };

  const scatterConfig = {
    residual: { label: "Residual", color: "hsl(var(--chart-2))" },
  };

  return (
    <div className="space-y-4" data-testid="model-validation-dashboard">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Model Validation Dashboard</CardTitle>
          <CardDescription className="text-xs">
            Goodness-of-fit metrics per Moriasi et al. (2007) criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {metricCards.map((m) => (
              <div
                key={m.name}
                className="flex flex-col gap-1 rounded-md border p-3"
                data-testid={`metric-card-${m.name.toLowerCase().replace(/[²%]/g, "")}`}
              >
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground">{m.name}</span>
                  <Badge variant={m.rating.variant} className="text-[10px]" data-testid={`badge-rating-${m.name.toLowerCase().replace(/[²%]/g, "")}`}>
                    {m.rating.label}
                  </Badge>
                </div>
                <span className="text-lg font-bold font-mono" data-testid={`text-value-${m.name.toLowerCase().replace(/[²%]/g, "")}`}>
                  {m.value}
                </span>
                <span className="text-[10px] text-muted-foreground">{m.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Residual Histogram</CardTitle>
            <CardDescription className="text-xs">Distribution of prediction errors</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={histogramConfig} className="h-[250px] w-full">
              <ResponsiveContainer>
                <BarChart data={metrics.bins} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Residuals vs Time</CardTitle>
            <CardDescription className="text-xs">Temporal pattern of prediction errors</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={scatterConfig} className="h-[250px] w-full">
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="idx" tick={{ fontSize: 9 }} name="Time Index" />
                  <YAxis dataKey="residual" tick={{ fontSize: 9 }} name="Residual" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Scatter data={metrics.residualTimeSeries} name="Residual">
                    {metrics.residualTimeSeries.map((_, i) => (
                      <Cell key={i} fill="hsl(var(--chart-2))" opacity={0.6} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
