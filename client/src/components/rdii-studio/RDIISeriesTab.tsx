import { useState, useCallback } from "react";
import { Activity, ArrowRight, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface RDIISeriesTabProps {
  onNext?: () => void;
}

export function RDIISeriesTab({ onNext }: RDIISeriesTabProps) {
  const { flowData, dwfResult, rdiiSeries, setRDIISeries } = useCalibrationData();
  const [running, setRunning] = useState(false);

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

  const peakRDII = rdiiSeries ? Math.max(...rdiiSeries.values) : 0;
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
                <p className="text-xs text-muted-foreground">RDII % of Total Flow</p>
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
