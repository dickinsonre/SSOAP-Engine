import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Play, Pause, RotateCcw, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";
import type { OptimizationResult } from "@/contexts/CalibrationDataContext";

const DEFAULT_PARAMS: OptimizationResult["parameters"] = {
  R1: 0.05, T1: 1.5, K1: 2.0,
  R2: 0.03, T2: 5.0, K2: 3.5,
  R3: 0.02, T3: 15.0, K3: 5.0,
};

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

interface ConvolutionStep {
  stepIndex: number;
  totalSteps: number;
  fast: number[];
  medium: number[];
  slow: number[];
  total: number[];
  rmse: number;
  nse: number;
}

function buildConvolutionSteps(
  rain: number[],
  observed: number[],
  params: OptimizationResult["parameters"]
): ConvolutionStep[] {
  const n = rain.length;
  const uh1 = generateTriangularUH(params.T1, params.K1, 1);
  const uh2 = generateTriangularUH(params.T2, params.K2, 1);
  const uh3 = generateTriangularUH(params.T3, params.K3, 1);

  const fast = new Array(n).fill(0);
  const medium = new Array(n).fill(0);
  const slow = new Array(n).fill(0);
  const total = new Array(n).fill(0);

  const sampleRate = Math.max(1, Math.floor(n / 500));
  const steps: ConvolutionStep[] = [];

  let sumObs = 0;
  let sumSqErr = 0;

  for (let i = 0; i < n; i++) {
    const rVal = rain[i];
    if (rVal > 0) {
      for (let j = 0; j < uh1.length && i + j < n; j++) {
        fast[i + j] += rVal * params.R1 * uh1[j];
      }
      for (let j = 0; j < uh2.length && i + j < n; j++) {
        medium[i + j] += rVal * params.R2 * uh2[j];
      }
      for (let j = 0; j < uh3.length && i + j < n; j++) {
        slow[i + j] += rVal * params.R3 * uh3[j];
      }
    }

    total[i] = fast[i] + medium[i] + slow[i];
    sumObs += observed[i];
    sumSqErr += (observed[i] - total[i]) ** 2;

    if (i % sampleRate === 0 || i === n - 1) {
      const count = i + 1;
      const meanObs = sumObs / count;
      let ssTot = 0;
      for (let k = 0; k < count; k++) {
        ssTot += (observed[k] - meanObs) ** 2;
      }
      const rmse = Math.sqrt(sumSqErr / count);
      const nse = ssTot > 0 ? 1 - sumSqErr / ssTot : 0;

      steps.push({
        stepIndex: i,
        totalSteps: n,
        fast: [...fast],
        medium: [...medium],
        slow: [...slow],
        total: [...total],
        rmse,
        nse,
      });
    }
  }

  return steps;
}

export function ConvolutionVisualizer() {
  const { rainfallData, rdiiSeries, optimizationResults, selectedSolutionIndex } = useCalibrationData();

  const params = useMemo(() => {
    if (optimizationResults.length > 0) {
      const idx = Math.min(selectedSolutionIndex, optimizationResults.length - 1);
      return optimizationResults[Math.max(0, idx)].parameters;
    }
    return DEFAULT_PARAMS;
  }, [optimizationResults, selectedSolutionIndex]);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("2");
  const [currentStep, setCurrentStep] = useState(0);
  const [convData, setConvData] = useState<ConvolutionStep | null>(null);

  const stepsRef = useRef<ConvolutionStep[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rain = useMemo(() => rainfallData?.values || [], [rainfallData]);
  const observed = useMemo(() => rdiiSeries?.values || [], [rdiiSeries]);

  const totalSteps = stepsRef.current.length;
  const dataLength = rain.length;
  const displayStep = Math.max(1, Math.floor(dataLength / 300));

  useEffect(() => {
    if (rain.length === 0 || observed.length === 0) return;
    stepsRef.current = buildConvolutionSteps(rain, observed, params);
    setCurrentStep(0);
    setConvData(stepsRef.current[0] || null);
    setPlaying(false);
  }, [rain, observed, params]);

  const goToStep = useCallback((step: number) => {
    const clamped = Math.max(0, Math.min(step, stepsRef.current.length - 1));
    setCurrentStep(clamped);
    setConvData(stepsRef.current[clamped] || null);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!playing || stepsRef.current.length === 0) return;

    const speedVal = parseInt(speed, 10);
    const interval = Math.max(10, 50 / speedVal);

    timerRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + speedVal;
        if (next >= stepsRef.current.length) {
          setPlaying(false);
          const last = stepsRef.current.length - 1;
          setConvData(stepsRef.current[last]);
          return last;
        }
        setConvData(stepsRef.current[next]);
        return next;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, speed]);

  const handlePlay = useCallback(() => {
    if (currentStep >= stepsRef.current.length - 1) {
      goToStep(0);
    }
    setPlaying(true);
  }, [currentStep, goToStep]);

  const handlePause = useCallback(() => setPlaying(false), []);

  const handleReset = useCallback(() => {
    setPlaying(false);
    goToStep(0);
  }, [goToStep]);

  const chartData = useMemo(() => {
    if (!convData || !rainfallData) return [];
    const upTo = convData.stepIndex + 1;
    const data: { idx: number; rainfall: number; fast: number; medium: number; slow: number; total: number; observed: number }[] = [];
    for (let i = 0; i < upTo; i += displayStep) {
      data.push({
        idx: i,
        rainfall: rain[i] || 0,
        fast: convData.fast[i] || 0,
        medium: convData.medium[i] || 0,
        slow: convData.slow[i] || 0,
        total: convData.total[i] || 0,
        observed: observed[i] || 0,
      });
    }
    return data;
  }, [convData, displayStep, rain, observed, rainfallData]);

  const uhChartData = useMemo(() => {
    const uh1 = generateTriangularUH(params.T1, params.K1, 1);
    const uh2 = generateTriangularUH(params.T2, params.K2, 1);
    const uh3 = generateTriangularUH(params.T3, params.K3, 1);
    const maxLen = Math.max(uh1.length, uh2.length, uh3.length);
    const data: { t: number; fast: number; medium: number; slow: number }[] = [];
    for (let i = 0; i < maxLen; i++) {
      data.push({
        t: i,
        fast: uh1[i] || 0,
        medium: uh2[i] || 0,
        slow: uh3[i] || 0,
      });
    }
    return data;
  }, [params]);

  if (!rainfallData || !rdiiSeries) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Zap className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground" data-testid="text-convolution-empty">
            Load rainfall data and generate RDII series to use the convolution visualizer.
          </p>
        </CardContent>
      </Card>
    );
  }

  const progressPct = convData && dataLength > 0 ? ((convData.stepIndex + 1) / dataLength) * 100 : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-sm">Convolution Visualizer</CardTitle>
              <CardDescription className="text-xs">
                Animated RTK convolution — watch fast, medium, and slow responses build the total RDII hydrograph
              </CardDescription>
            </div>
            <Badge variant={optimizationResults.length > 0 ? "default" : "secondary"}>
              {optimizationResults.length > 0 ? "Calibrated Params" : "Default Params"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {playing ? (
              <Button size="sm" onClick={handlePause} data-testid="button-convolution-pause">
                <Pause className="mr-1 h-4 w-4" />
                Pause
              </Button>
            ) : (
              <Button size="sm" onClick={handlePlay} data-testid="button-convolution-play">
                <Play className="mr-1 h-4 w-4" />
                Play
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleReset} data-testid="button-convolution-reset">
              <RotateCcw className="mr-1 h-4 w-4" />
              Reset
            </Button>
            <Select value={speed} onValueChange={setSpeed}>
              <SelectTrigger className="w-24" data-testid="select-speed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="5">5x</SelectItem>
                <SelectItem value="10">10x</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground font-mono" data-testid="text-step-counter">
              Step {currentStep + 1} / {totalSteps} ({convData ? convData.stepIndex + 1 : 0} / {dataLength} pts)
            </span>
          </div>

          <Slider
            value={[currentStep]}
            onValueChange={(v) => {
              if (!playing) goToStep(v[0]);
            }}
            min={0}
            max={Math.max(0, (totalSteps || 1) - 1)}
            step={1}
            data-testid="slider-convolution-step"
          />

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-3 text-center">
                <p className="text-lg font-bold font-mono" data-testid="text-conv-progress">{progressPct.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 text-center">
                <p className="text-lg font-bold font-mono" data-testid="text-conv-rmse">{convData ? convData.rmse.toFixed(4) : "—"}</p>
                <p className="text-xs text-muted-foreground">RMSE</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 text-center">
                <p className="text-lg font-bold font-mono" data-testid="text-conv-nse">{convData ? (convData.nse * 100).toFixed(1) + "%" : "—"}</p>
                <p className="text-xs text-muted-foreground">NSE</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 text-center">
                <p className="text-lg font-bold font-mono" data-testid="text-conv-params">
                  R={((params.R1 + params.R2 + params.R3) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Total R</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Convolution Build-Up</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                rainfall: { label: "Rainfall", color: "hsl(var(--chart-5))" },
                fast: { label: "Fast (R1)", color: "hsl(var(--chart-1))" },
                medium: { label: "Medium (R2)", color: "hsl(var(--chart-2))" },
                slow: { label: "Slow (R3)", color: "hsl(var(--chart-4))" },
                total: { label: "Total RDII", color: "hsl(var(--chart-3))" },
                observed: { label: "Observed", color: "hsl(var(--foreground))" },
              }}
              className="h-[350px] w-full"
            >
              <ResponsiveContainer>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="idx" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="flow" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="rain" orientation="right" reversed tick={{ fontSize: 9 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar yAxisId="rain" dataKey="rainfall" fill="hsl(var(--chart-5))" fillOpacity={0.4} name="Rainfall" />
                  <Area yAxisId="flow" type="monotone" dataKey="fast" stackId="rdii" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} name="Fast (R1)" />
                  <Area yAxisId="flow" type="monotone" dataKey="medium" stackId="rdii" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} name="Medium (R2)" />
                  <Area yAxisId="flow" type="monotone" dataKey="slow" stackId="rdii" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.3} name="Slow (R3)" />
                  <Line yAxisId="flow" type="monotone" dataKey="observed" stroke="hsl(var(--foreground))" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Observed" />
                  <Line yAxisId="flow" type="monotone" dataKey="total" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name="Total RDII" />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Unit Hydrograph Shapes</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                fast: { label: "Fast UH", color: "hsl(var(--chart-1))" },
                medium: { label: "Medium UH", color: "hsl(var(--chart-2))" },
                slow: { label: "Slow UH", color: "hsl(var(--chart-4))" },
              }}
              className="h-[350px] w-full"
            >
              <ResponsiveContainer>
                <ComposedChart data={uhChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="t" tick={{ fontSize: 9 }} label={{ value: "Time (hrs)", position: "bottom", fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Area type="monotone" dataKey="fast" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.2} name="Fast UH" />
                  <Area type="monotone" dataKey="medium" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.2} name="Medium UH" />
                  <Area type="monotone" dataKey="slow" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.2} name="Slow UH" />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
