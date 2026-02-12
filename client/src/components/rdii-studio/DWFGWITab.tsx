import { useState, useCallback } from "react";
import { Waves, ArrowRight, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";
import type { DWFResult } from "@/contexts/CalibrationDataContext";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface DWFGWITabProps {
  onNext?: () => void;
}

export function DWFGWITab({ onNext }: DWFGWITabProps) {
  const { flowData, rainfallData, dwfResult, setDWFResult } = useCalibrationData();
  const [running, setRunning] = useState(false);

  const handleSeparate = useCallback(() => {
    if (!flowData || !rainfallData) return;
    setRunning(true);
    setTimeout(() => {
      const n = flowData.timestamps.length;
      const hourMs = 3600000;
      const dayMs = 86400000;

      const dayMap = new Map<string, { flows: number[]; rain: number }>();

      for (let i = 0; i < n; i++) {
        const dayKey = flowData.timestamps[i].toISOString().slice(0, 10);
        if (!dayMap.has(dayKey)) dayMap.set(dayKey, { flows: [], rain: 0 });
        const entry = dayMap.get(dayKey)!;
        entry.flows.push(flowData.values[i]);
      }

      for (let i = 0; i < rainfallData.timestamps.length; i++) {
        const dayKey = rainfallData.timestamps[i].toISOString().slice(0, 10);
        if (dayMap.has(dayKey)) {
          dayMap.get(dayKey)!.rain += rainfallData.values[i];
        }
      }

      const dryDays: { flows: number[] }[] = [];
      for (const [, entry] of dayMap) {
        if (entry.rain <= 0.01 && entry.flows.length > 0) {
          dryDays.push({ flows: entry.flows });
        }
      }

      const hourlyPattern = new Array(24).fill(0);
      const hourlyCounts = new Array(24).fill(0);
      let gwiEstimate = Infinity;

      if (dryDays.length > 0) {
        for (const day of dryDays) {
          const stepsPerHour = Math.max(1, Math.floor(day.flows.length / 24));
          let dayMin = Infinity;
          for (let h = 0; h < 24 && h * stepsPerHour < day.flows.length; h++) {
            const start = h * stepsPerHour;
            const end = Math.min(start + stepsPerHour, day.flows.length);
            let sum = 0;
            let count = 0;
            for (let k = start; k < end; k++) {
              sum += day.flows[k];
              count++;
              if (day.flows[k] < dayMin) dayMin = day.flows[k];
            }
            if (count > 0) {
              hourlyPattern[h] += sum / count;
              hourlyCounts[h]++;
            }
          }
          if (dayMin < gwiEstimate) gwiEstimate = dayMin;
        }
        for (let h = 0; h < 24; h++) {
          hourlyPattern[h] = hourlyCounts[h] > 0 ? hourlyPattern[h] / hourlyCounts[h] : 0;
        }
      } else {
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
      const result: DWFResult = {
        baseFlow,
        gwiFlow,
        dwfPattern: hourlyPattern,
        meanDWF,
        meanGWI: gwiEstimate,
      };

      setDWFResult(result);
      setRunning(false);
    }, 300);
  }, [flowData, rainfallData, setDWFResult]);

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
      <div className="flex justify-end">
        <Button onClick={handleSeparate} disabled={running} data-testid="button-separate-dwf">
          <Play className="mr-2 h-4 w-4" />
          {running ? "Processing..." : "Separate DWF/GWI"}
        </Button>
      </div>

      {dwfResult && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Mean DWF</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-mean-dwf">{dwfResult.meanDWF.toFixed(3)}</p>
                <p className="text-xs text-muted-foreground">{flowData.units}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Mean GWI</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-mean-gwi">{dwfResult.meanGWI.toFixed(3)}</p>
                <p className="text-xs text-muted-foreground">{flowData.units}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">GWI as % of Mean DWF</p>
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
              <CardDescription className="text-xs">Total flow, DWF component, and GWI baseline</CardDescription>
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
