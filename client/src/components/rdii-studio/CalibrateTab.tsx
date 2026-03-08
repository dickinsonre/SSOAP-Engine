import { useState, useCallback } from "react";
import { SlidersHorizontal, ArrowRight, Play, Loader2, Trophy, Swords } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";
import type { OptimizationResult } from "@/contexts/CalibrationDataContext";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  LineChart,
  Brush,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { apiRequest } from "@/lib/queryClient";

interface CalibrateTabProps {
  onNext?: () => void;
}

interface ParamBounds {
  R1: [number, number]; T1: [number, number]; K1: [number, number];
  R2: [number, number]; T2: [number, number]; K2: [number, number];
  R3: [number, number]; T3: [number, number]; K3: [number, number];
}

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

function simulateRDII(params: OptimizationResult["parameters"], rain: number[]): number[] {
  const uh1 = generateTriangularUH(params.T1, params.K1, 1);
  const uh2 = generateTriangularUH(params.T2, params.K2, 1);
  const uh3 = generateTriangularUH(params.T3, params.K3, 1);
  const r1 = convolve(rain.map((r) => r * params.R1), uh1);
  const r2 = convolve(rain.map((r) => r * params.R2), uh2);
  const r3 = convolve(rain.map((r) => r * params.R3), uh3);
  return rain.map((_, i) => (r1[i] || 0) + (r2[i] || 0) + (r3[i] || 0));
}

function computeMetrics(observed: number[], simulated: number[]) {
  const n = observed.length;
  let sumSqErr = 0;
  let meanObs = 0;
  let obsVol = 0;
  let simVol = 0;
  let obsPeak = 0;
  let simPeak = 0;
  for (let i = 0; i < n; i++) {
    meanObs += observed[i];
    obsVol += observed[i];
    simVol += simulated[i];
    if (observed[i] > obsPeak) obsPeak = observed[i];
    if (simulated[i] > simPeak) simPeak = simulated[i];
  }
  meanObs /= n;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    sumSqErr += (observed[i] - simulated[i]) ** 2;
    ssTot += (observed[i] - meanObs) ** 2;
  }
  const rmse = Math.sqrt(sumSqErr / n);
  const nse = ssTot > 0 ? 1 - sumSqErr / ssTot : 0;
  const volumeError = obsVol > 0 ? ((simVol - obsVol) / obsVol) * 100 : 0;
  const peakError = obsPeak > 0 ? ((simPeak - obsPeak) / obsPeak) * 100 : 0;
  return { rmse, nse, volumeError, peakError };
}

function dominates(a: number[], b: number[]): boolean {
  let dominated = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] > b[i]) return false;
    if (a[i] < b[i]) dominated = true;
  }
  return dominated;
}

function nonDominatedSort(objectives: number[][]): number[] {
  const n = objectives.length;
  const ranks = new Array(n).fill(0);
  const domCount = new Array(n).fill(0);
  const dominated: number[][] = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (dominates(objectives[i], objectives[j])) {
        dominated[i].push(j);
        domCount[j]++;
      } else if (dominates(objectives[j], objectives[i])) {
        dominated[j].push(i);
        domCount[i]++;
      }
    }
  }

  let front: number[] = [];
  for (let i = 0; i < n; i++) {
    if (domCount[i] === 0) { ranks[i] = 0; front.push(i); }
  }

  let rank = 0;
  while (front.length > 0) {
    const nextFront: number[] = [];
    for (const i of front) {
      for (const j of dominated[i]) {
        domCount[j]--;
        if (domCount[j] === 0) { ranks[j] = rank + 1; nextFront.push(j); }
      }
    }
    rank++;
    front = nextFront;
  }

  return ranks;
}

interface TournamentMetrics {
  rmse: number;
  nse: number;
  volumeError: number;
  peakError: number;
}

interface TournamentResult {
  label: string;
  parameters: OptimizationResult["parameters"];
  metrics: TournamentMetrics;
  simulatedFlow: number[];
  elapsed: number;
}

interface TournamentState {
  ga: TournamentResult | null;
  nsgaii: TournamentResult | null;
  verdict: string;
}

export function CalibrateTab({ onNext }: CalibrateTabProps) {
  const { rainfallData, rdiiSeries, optimizationResults, setOptimizationResults } = useCalibrationData();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressHistory, setProgressHistory] = useState<{ gen: number; best: number }[]>([]);

  const [tournamentRunning, setTournamentRunning] = useState(false);
  const [tournamentProgress, setTournamentProgress] = useState("");
  const [tournament, setTournament] = useState<TournamentState | null>(null);

  const [bounds, setBounds] = useState<ParamBounds>({
    R1: [0.001, 0.2], T1: [0.5, 4], K1: [1.5, 4],
    R2: [0.001, 0.15], T2: [2, 12], K2: [2, 6],
    R3: [0.001, 0.1], T3: [6, 48], K3: [2, 8],
  });

  const handleCalibrate = useCallback(() => {
    if (!rainfallData || !rdiiSeries) return;
    setRunning(true);
    setProgress(0);
    setProgressHistory([]);

    const rain = rainfallData.values;
    const observed = rdiiSeries.values;
    const popSize = 50;
    const maxGen = 100;

    setTimeout(() => {
      const randParam = (): OptimizationResult["parameters"] => ({
        R1: bounds.R1[0] + Math.random() * (bounds.R1[1] - bounds.R1[0]),
        T1: bounds.T1[0] + Math.random() * (bounds.T1[1] - bounds.T1[0]),
        K1: bounds.K1[0] + Math.random() * (bounds.K1[1] - bounds.K1[0]),
        R2: bounds.R2[0] + Math.random() * (bounds.R2[1] - bounds.R2[0]),
        T2: bounds.T2[0] + Math.random() * (bounds.T2[1] - bounds.T2[0]),
        K2: bounds.K2[0] + Math.random() * (bounds.K2[1] - bounds.K2[0]),
        R3: bounds.R3[0] + Math.random() * (bounds.R3[1] - bounds.R3[0]),
        T3: bounds.T3[0] + Math.random() * (bounds.T3[1] - bounds.T3[0]),
        K3: bounds.K3[0] + Math.random() * (bounds.K3[1] - bounds.K3[0]),
      });

      const clampParam = (p: OptimizationResult["parameters"]): OptimizationResult["parameters"] => ({
        R1: Math.max(bounds.R1[0], Math.min(bounds.R1[1], p.R1)),
        T1: Math.max(bounds.T1[0], Math.min(bounds.T1[1], p.T1)),
        K1: Math.max(bounds.K1[0], Math.min(bounds.K1[1], p.K1)),
        R2: Math.max(bounds.R2[0], Math.min(bounds.R2[1], p.R2)),
        T2: Math.max(bounds.T2[0], Math.min(bounds.T2[1], p.T2)),
        K2: Math.max(bounds.K2[0], Math.min(bounds.K2[1], p.K2)),
        R3: Math.max(bounds.R3[0], Math.min(bounds.R3[1], p.R3)),
        T3: Math.max(bounds.T3[0], Math.min(bounds.T3[1], p.T3)),
        K3: Math.max(bounds.K3[0], Math.min(bounds.K3[1], p.K3)),
      });

      let population = Array.from({ length: popSize }, randParam);
      const history: { gen: number; best: number }[] = [];

      for (let gen = 0; gen < maxGen; gen++) {
        const fitnesses: { params: OptimizationResult["parameters"]; objectives: number[] }[] = population.map((p) => {
          const sim = simulateRDII(p, rain);
          const m = computeMetrics(observed, sim);
          return { params: p, objectives: [m.rmse, Math.abs(m.volumeError), Math.abs(m.peakError)] };
        });

        const objArr = fitnesses.map((f) => f.objectives);
        const ranks = nonDominatedSort(objArr);

        const sorted = fitnesses.map((f, i) => ({ ...f, rank: ranks[i] })).sort((a, b) => a.rank - b.rank);

        const bestM = computeMetrics(observed, simulateRDII(sorted[0].params, rain));
        history.push({ gen: gen + 1, best: bestM.nse });

        const newPop: OptimizationResult["parameters"][] = [];
        for (let i = 0; i < 2 && i < sorted.length; i++) newPop.push(sorted[i].params);

        while (newPop.length < popSize) {
          const t1 = sorted[Math.floor(Math.random() * Math.min(10, sorted.length))].params;
          const t2 = sorted[Math.floor(Math.random() * Math.min(10, sorted.length))].params;
          const keys = ["R1", "T1", "K1", "R2", "T2", "K2", "R3", "T3", "K3"] as const;
          const child: any = {};
          for (const k of keys) {
            child[k] = Math.random() < 0.5 ? t1[k] : t2[k];
            if (Math.random() < 0.15) {
              const bk = bounds[k];
              child[k] += (Math.random() - 0.5) * 0.2 * (bk[1] - bk[0]);
            }
          }
          newPop.push(clampParam(child));
        }

        population = newPop;
      }

      const finalFitnesses = population.map((p) => {
        const sim = simulateRDII(p, rain);
        const m = computeMetrics(observed, sim);
        return { params: p, sim, ...m };
      });

      finalFitnesses.sort((a, b) => a.rmse - b.rmse);
      const best = finalFitnesses[0];

      const results: OptimizationResult[] = [];
      const paretoSet = finalFitnesses.slice(0, 5);
      for (let i = 0; i < paretoSet.length; i++) {
        const s = paretoSet[i];
        results.push({
          parameters: s.params,
          rmse: s.rmse,
          volumeError: s.volumeError,
          peakError: s.peakError,
          nse: s.nse,
          simulatedFlow: s.sim,
          label: i === 0 ? "Best RMSE" : `Solution ${i + 1}`,
        });
      }

      setOptimizationResults([...optimizationResults, ...results]);
      setProgress(100);
      setProgressHistory(history);
      setRunning(false);
    }, 100);
  }, [rainfallData, rdiiSeries, bounds, optimizationResults, setOptimizationResults]);

  const handleTournament = useCallback(async () => {
    if (!rainfallData || !rdiiSeries) return;
    setTournamentRunning(true);
    setTournament(null);

    const rain = rainfallData.values;
    const observed = rdiiSeries.values;

    setTournamentProgress("Running client-side NSGA-II...");
    const nsgaStart = performance.now();

    const popSize = 50;
    const maxGen = 100;

    const randParam = (): OptimizationResult["parameters"] => ({
      R1: bounds.R1[0] + Math.random() * (bounds.R1[1] - bounds.R1[0]),
      T1: bounds.T1[0] + Math.random() * (bounds.T1[1] - bounds.T1[0]),
      K1: bounds.K1[0] + Math.random() * (bounds.K1[1] - bounds.K1[0]),
      R2: bounds.R2[0] + Math.random() * (bounds.R2[1] - bounds.R2[0]),
      T2: bounds.T2[0] + Math.random() * (bounds.T2[1] - bounds.T2[0]),
      K2: bounds.K2[0] + Math.random() * (bounds.K2[1] - bounds.K2[0]),
      R3: bounds.R3[0] + Math.random() * (bounds.R3[1] - bounds.R3[0]),
      T3: bounds.T3[0] + Math.random() * (bounds.T3[1] - bounds.T3[0]),
      K3: bounds.K3[0] + Math.random() * (bounds.K3[1] - bounds.K3[0]),
    });

    const clampParam = (p: OptimizationResult["parameters"]): OptimizationResult["parameters"] => ({
      R1: Math.max(bounds.R1[0], Math.min(bounds.R1[1], p.R1)),
      T1: Math.max(bounds.T1[0], Math.min(bounds.T1[1], p.T1)),
      K1: Math.max(bounds.K1[0], Math.min(bounds.K1[1], p.K1)),
      R2: Math.max(bounds.R2[0], Math.min(bounds.R2[1], p.R2)),
      T2: Math.max(bounds.T2[0], Math.min(bounds.T2[1], p.T2)),
      K2: Math.max(bounds.K2[0], Math.min(bounds.K2[1], p.K2)),
      R3: Math.max(bounds.R3[0], Math.min(bounds.R3[1], p.R3)),
      T3: Math.max(bounds.T3[0], Math.min(bounds.T3[1], p.T3)),
      K3: Math.max(bounds.K3[0], Math.min(bounds.K3[1], p.K3)),
    });

    let population = Array.from({ length: popSize }, randParam);

    for (let gen = 0; gen < maxGen; gen++) {
      const fitnesses = population.map((p) => {
        const sim = simulateRDII(p, rain);
        const m = computeMetrics(observed, sim);
        return { params: p, objectives: [m.rmse, Math.abs(m.volumeError), Math.abs(m.peakError)] };
      });

      const objArr = fitnesses.map((f) => f.objectives);
      const ranks = nonDominatedSort(objArr);
      const sorted = fitnesses.map((f, i) => ({ ...f, rank: ranks[i] })).sort((a, b) => a.rank - b.rank);

      const newPop: OptimizationResult["parameters"][] = [];
      for (let i = 0; i < 2 && i < sorted.length; i++) newPop.push(sorted[i].params);
      while (newPop.length < popSize) {
        const t1 = sorted[Math.floor(Math.random() * Math.min(10, sorted.length))].params;
        const t2 = sorted[Math.floor(Math.random() * Math.min(10, sorted.length))].params;
        const keys = ["R1", "T1", "K1", "R2", "T2", "K2", "R3", "T3", "K3"] as const;
        const child: any = {};
        for (const k of keys) {
          child[k] = Math.random() < 0.5 ? t1[k] : t2[k];
          if (Math.random() < 0.15) {
            const bk = bounds[k];
            child[k] += (Math.random() - 0.5) * 0.2 * (bk[1] - bk[0]);
          }
        }
        newPop.push(clampParam(child));
      }
      population = newPop;
    }

    const nsgaBest = population.reduce((best, p) => {
      const m = computeMetrics(observed, simulateRDII(p, rain));
      const bm = computeMetrics(observed, simulateRDII(best, rain));
      return m.rmse < bm.rmse ? p : best;
    }, population[0]);

    const nsgaSimulated = simulateRDII(nsgaBest, rain);
    const nsgaMetrics = computeMetrics(observed, nsgaSimulated);
    const nsgaElapsed = Math.round(performance.now() - nsgaStart);

    const nsgaResult: TournamentResult = {
      label: "NSGA-II (Client)",
      parameters: nsgaBest,
      metrics: nsgaMetrics,
      simulatedFlow: nsgaSimulated,
      elapsed: nsgaElapsed,
    };

    setTournamentProgress("Running server-side GA...");

    let gaResult: TournamentResult | null = null;
    try {
      const resp = await apiRequest("POST", "/api/calibration/run-direct", {
        rainfall: rain,
        observed: observed,
      });
      const data = await resp.json();
      if (data.success) {
        const gaSimulated = data.simulatedFlow as number[];
        const gaMetrics = computeMetrics(observed, gaSimulated);
        gaResult = {
          label: "GA (Server)",
          parameters: data.parameters,
          metrics: gaMetrics,
          simulatedFlow: gaSimulated,
          elapsed: data.elapsed as number,
        };
      }
    } catch {
      gaResult = null;
    }

    let verdict = "";
    if (gaResult && nsgaResult) {
      let gaWins = 0;
      let nsgaWins = 0;

      if (gaResult.metrics.rmse < nsgaResult.metrics.rmse) gaWins++;
      else if (gaResult.metrics.rmse > nsgaResult.metrics.rmse) nsgaWins++;

      if (gaResult.metrics.nse > nsgaResult.metrics.nse) gaWins++;
      else if (gaResult.metrics.nse < nsgaResult.metrics.nse) nsgaWins++;

      if (Math.abs(gaResult.metrics.volumeError) < Math.abs(nsgaResult.metrics.volumeError)) gaWins++;
      else if (Math.abs(gaResult.metrics.volumeError) > Math.abs(nsgaResult.metrics.volumeError)) nsgaWins++;

      if (Math.abs(gaResult.metrics.peakError) < Math.abs(nsgaResult.metrics.peakError)) gaWins++;
      else if (Math.abs(gaResult.metrics.peakError) > Math.abs(nsgaResult.metrics.peakError)) nsgaWins++;

      if (gaWins > nsgaWins) {
        verdict = `Server-side GA wins ${gaWins}-${nsgaWins}! The single-objective GA found a better overall solution.`;
      } else if (nsgaWins > gaWins) {
        verdict = `Client-side NSGA-II wins ${nsgaWins}-${gaWins}! Multi-objective optimization produced a superior result.`;
      } else {
        verdict = `It's a tie ${gaWins}-${nsgaWins}! Both algorithms performed equally well across metrics.`;
      }
    } else if (!gaResult) {
      verdict = "Server-side GA failed. Only NSGA-II results available.";
    }

    setTournament({ ga: gaResult, nsgaii: nsgaResult, verdict });
    setTournamentProgress("");
    setTournamentRunning(false);
  }, [rainfallData, rdiiSeries, bounds]);

  const latestResult = optimizationResults.length > 0 ? optimizationResults[optimizationResults.length - 1] : null;

  const hydrographData = latestResult && rdiiSeries
    ? (() => {
        const step = Math.max(1, Math.floor(rdiiSeries.values.length / 400));
        const data: { idx: number; observed: number; simulated: number }[] = [];
        for (let i = 0; i < rdiiSeries.values.length; i += step) {
          data.push({
            idx: i,
            observed: rdiiSeries.values[i],
            simulated: latestResult.simulatedFlow?.[i] || 0,
          });
        }
        return data;
      })()
    : [];

  const paramKeys: (keyof ParamBounds)[] = ["R1", "T1", "K1", "R2", "T2", "K2", "R3", "T3", "K3"];
  const paramLabels: Record<string, string> = {
    R1: "R1 (Fast fraction)", T1: "T1 (Fast peak hrs)", K1: "K1 (Fast recession)",
    R2: "R2 (Medium fraction)", T2: "T2 (Medium peak hrs)", K2: "K2 (Medium recession)",
    R3: "R3 (Slow fraction)", T3: "T3 (Slow peak hrs)", K3: "K3 (Slow recession)",
  };

  if (!rainfallData || !rdiiSeries) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <SlidersHorizontal className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Generate RDII series and detect events first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Parameter Bounds</CardTitle>
          <CardDescription className="text-xs">
            Constraints: R1+R2+R3 &le; 1.0 &bull; T1 &lt; T2 &lt; T3 &bull; K1 &lt; K2 &lt; K3
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {paramKeys.map((k) => (
              <div key={k} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{paramLabels[k]}</span>
                  <span className="font-mono">[{bounds[k][0]}, {bounds[k][1]}]</span>
                </div>
                <Slider
                  value={bounds[k]}
                  onValueChange={(v) => setBounds((b) => ({ ...b, [k]: v as [number, number] }))}
                  min={k.startsWith("R") ? 0 : k.startsWith("T") ? 0.1 : 1}
                  max={k.startsWith("R") ? 0.5 : k === "T3" ? 96 : k.startsWith("T") ? 48 : 10}
                  step={k.startsWith("R") ? 0.001 : 0.1}
                  data-testid={`slider-${k.toLowerCase()}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 flex-wrap">
        <Button onClick={handleCalibrate} disabled={running} data-testid="button-run-calibration">
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          {running ? "Optimizing..." : "Run Calibration"}
        </Button>
        {running && (
          <div className="flex-1 max-w-xs">
            <Progress value={progress} data-testid="progress-calibration" />
          </div>
        )}
      </div>

      {progressHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Optimization Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ best: { label: "Best NSE", color: "hsl(var(--primary))" } }} className="h-[200px] w-full">
              <ResponsiveContainer>
                <LineChart data={progressHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="gen" tick={{ fontSize: 9 }} label={{ value: "Generation", position: "bottom", fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="best" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Best NSE" />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {latestResult && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold font-mono" data-testid="text-rmse">{latestResult.rmse.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground">RMSE</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold font-mono" data-testid="text-nse">{(latestResult.nse * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">NSE</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold font-mono" data-testid="text-vol-error">{latestResult.volumeError.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Volume Error</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold font-mono" data-testid="text-peak-error">{latestResult.peakError.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Peak Error</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Calibrated Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Response</TableHead>
                    <TableHead className="text-right">R (fraction)</TableHead>
                    <TableHead className="text-right">T (hours)</TableHead>
                    <TableHead className="text-right">K (ratio)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Fast</TableCell>
                    <TableCell className="text-right font-mono">{latestResult.parameters.R1.toFixed(4)}</TableCell>
                    <TableCell className="text-right font-mono">{latestResult.parameters.T1.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{latestResult.parameters.K1.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Medium</TableCell>
                    <TableCell className="text-right font-mono">{latestResult.parameters.R2.toFixed(4)}</TableCell>
                    <TableCell className="text-right font-mono">{latestResult.parameters.T2.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{latestResult.parameters.K2.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Slow</TableCell>
                    <TableCell className="text-right font-mono">{latestResult.parameters.R3.toFixed(4)}</TableCell>
                    <TableCell className="text-right font-mono">{latestResult.parameters.T3.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{latestResult.parameters.K3.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Total R</TableCell>
                    <TableCell className="text-right font-mono" colSpan={3}>
                      <Badge variant={(latestResult.parameters.R1 + latestResult.parameters.R2 + latestResult.parameters.R3) > 1 ? "destructive" : "default"}>
                        {((latestResult.parameters.R1 + latestResult.parameters.R2 + latestResult.parameters.R3) * 100).toFixed(2)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {hydrographData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Observed vs Simulated Hydrograph</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    observed: { label: "Observed", color: "hsl(var(--chart-1))" },
                    simulated: { label: "Simulated", color: "hsl(var(--chart-3))" },
                  }}
                  className="h-[300px] w-full"
                >
                  <ResponsiveContainer>
                    <ComposedChart data={hydrographData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="idx" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Area type="monotone" dataKey="observed" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.15} strokeWidth={1.5} name="Observed" />
                      <Line type="monotone" dataKey="simulated" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name="Simulated" />
                      <Brush dataKey="idx" height={20} stroke="hsl(var(--primary))" travellerWidth={8} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Separator />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            <CardTitle className="text-sm">Calibration Tournament</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Run both server-side GA and client-side NSGA-II on the same data and compare results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleTournament} disabled={tournamentRunning} data-testid="button-run-tournament">
            {tournamentRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
            {tournamentRunning ? tournamentProgress || "Running..." : "Run Tournament"}
          </Button>

          {tournament && (
            <div className="space-y-4">
              {tournament.verdict && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      <p className="text-sm font-medium" data-testid="text-tournament-verdict">{tournament.verdict}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Side-by-Side Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead className="text-right">GA (Server)</TableHead>
                        <TableHead className="text-right">NSGA-II (Client)</TableHead>
                        <TableHead className="text-center">Winner</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        {
                          label: "RMSE",
                          ga: tournament.ga?.metrics.rmse,
                          nsga: tournament.nsgaii?.metrics.rmse,
                          format: (v: number) => v.toFixed(4),
                          lower: true,
                        },
                        {
                          label: "NSE",
                          ga: tournament.ga?.metrics.nse,
                          nsga: tournament.nsgaii?.metrics.nse,
                          format: (v: number) => (v * 100).toFixed(1) + "%",
                          lower: false,
                        },
                        {
                          label: "Volume Error",
                          ga: tournament.ga ? Math.abs(tournament.ga.metrics.volumeError) : undefined,
                          nsga: tournament.nsgaii ? Math.abs(tournament.nsgaii.metrics.volumeError) : undefined,
                          format: (v: number) => v.toFixed(1) + "%",
                          lower: true,
                        },
                        {
                          label: "Peak Error",
                          ga: tournament.ga ? Math.abs(tournament.ga.metrics.peakError) : undefined,
                          nsga: tournament.nsgaii ? Math.abs(tournament.nsgaii.metrics.peakError) : undefined,
                          format: (v: number) => v.toFixed(1) + "%",
                          lower: true,
                        },
                        {
                          label: "Time Elapsed",
                          ga: tournament.ga?.elapsed,
                          nsga: tournament.nsgaii?.elapsed,
                          format: (v: number) => v + " ms",
                          lower: true,
                        },
                      ].map((row) => {
                        let winner = "";
                        if (row.ga != null && row.nsga != null) {
                          if (row.lower) {
                            winner = row.ga < row.nsga ? "GA" : row.nsga < row.ga ? "NSGA-II" : "Tie";
                          } else {
                            winner = row.ga > row.nsga ? "GA" : row.nsga > row.ga ? "NSGA-II" : "Tie";
                          }
                        }
                        return (
                          <TableRow key={row.label}>
                            <TableCell className="font-medium">{row.label}</TableCell>
                            <TableCell className="text-right font-mono" data-testid={`text-tournament-ga-${row.label.toLowerCase().replace(/\s/g, "-")}`}>
                              {row.ga != null ? row.format(row.ga) : "N/A"}
                            </TableCell>
                            <TableCell className="text-right font-mono" data-testid={`text-tournament-nsga-${row.label.toLowerCase().replace(/\s/g, "-")}`}>
                              {row.nsga != null ? row.format(row.nsga) : "N/A"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={winner === "Tie" ? "secondary" : "default"} data-testid={`badge-tournament-winner-${row.label.toLowerCase().replace(/\s/g, "-")}`}>
                                {winner || "N/A"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {rdiiSeries && (tournament.ga || tournament.nsgaii) && (() => {
                const step = Math.max(1, Math.floor(rdiiSeries.values.length / 400));
                const chartData: { idx: number; observed: number; ga?: number; nsgaii?: number }[] = [];
                for (let i = 0; i < rdiiSeries.values.length; i += step) {
                  chartData.push({
                    idx: i,
                    observed: rdiiSeries.values[i],
                    ga: tournament.ga?.simulatedFlow[i],
                    nsgaii: tournament.nsgaii?.simulatedFlow[i],
                  });
                }
                return (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Hydrograph Overlay</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{
                          observed: { label: "Observed", color: "hsl(var(--chart-1))" },
                          ga: { label: "GA (Server)", color: "hsl(var(--chart-2))" },
                          nsgaii: { label: "NSGA-II (Client)", color: "hsl(var(--chart-3))" },
                        }}
                        className="h-[300px] w-full"
                      >
                        <ResponsiveContainer>
                          <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="idx" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 9 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Area type="monotone" dataKey="observed" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.1} strokeWidth={1.5} name="Observed" />
                            {tournament.ga && (
                              <Line type="monotone" dataKey="ga" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="GA (Server)" />
                            )}
                            {tournament.nsgaii && (
                              <Line type="monotone" dataKey="nsgaii" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name="NSGA-II (Client)" />
                            )}
                            <Brush dataKey="idx" height={20} stroke="hsl(var(--primary))" travellerWidth={8} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {latestResult && onNext && (
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
