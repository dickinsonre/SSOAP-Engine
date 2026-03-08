import { LineChart as LineChartIcon, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Brush,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ConvolutionVisualizer } from "./ConvolutionVisualizer";

interface TimeSeriesTabProps {
  onNext?: () => void;
}

export function TimeSeriesTab({ onNext }: TimeSeriesTabProps) {
  const { flowData, dwfResult, rdiiSeries } = useCalibrationData();

  if (!flowData || !dwfResult || !rdiiSeries) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <LineChartIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Complete DWF separation and RDII extraction first.</p>
        </CardContent>
      </Card>
    );
  }

  const n = flowData.timestamps.length;
  let totalGWI = 0;
  let totalDWF = 0;
  let totalRDII = 0;
  let totalFlow = 0;

  for (let i = 0; i < n; i++) {
    const gwi = dwfResult.meanGWI;
    const dwf = Math.max(0, (dwfResult.baseFlow[i] || 0) - gwi);
    const rdii = rdiiSeries.values[i];
    totalGWI += gwi;
    totalDWF += dwf;
    totalRDII += rdii;
    totalFlow += flowData.values[i];
  }

  const gwiPct = totalFlow > 0 ? (totalGWI / totalFlow) * 100 : 0;
  const dwfPct = totalFlow > 0 ? (totalDWF / totalFlow) * 100 : 0;
  const rdiiPct = totalFlow > 0 ? (totalRDII / totalFlow) * 100 : 0;

  const step = Math.max(1, Math.floor(n / 500));
  const chartData: { time: string; gwi: number; dwf: number; rdii: number }[] = [];
  for (let i = 0; i < n; i += step) {
    const gwi = dwfResult.meanGWI;
    const dwf = Math.max(0, (dwfResult.baseFlow[i] || 0) - gwi);
    const rdii = rdiiSeries.values[i];
    chartData.push({
      time: flowData.timestamps[i].toLocaleDateString(),
      gwi,
      dwf,
      rdii,
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">GWI Component</p>
            <p className="text-2xl font-bold font-mono" data-testid="text-gwi-pct">{gwiPct.toFixed(1)}%</p>
            <Badge variant="outline" className="mt-1">Groundwater Infiltration</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">DWF Component</p>
            <p className="text-2xl font-bold font-mono" data-testid="text-dwf-pct">{dwfPct.toFixed(1)}%</p>
            <Badge variant="outline" className="mt-1">Dry Weather Flow</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">RDII Component</p>
            <p className="text-2xl font-bold font-mono" data-testid="text-rdii-pct">{rdiiPct.toFixed(1)}%</p>
            <Badge variant={rdiiPct > 30 ? "destructive" : rdiiPct > 15 ? "secondary" : "default"} className="mt-1">
              Rainfall-Derived I/I
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Stacked Flow Decomposition</CardTitle>
          <CardDescription className="text-xs">GWI (bottom) + DWF (middle) + RDII (top) = Total Flow</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              gwi: { label: "GWI", color: "hsl(var(--chart-4))" },
              dwf: { label: "DWF", color: "hsl(var(--chart-2))" },
              rdii: { label: "RDII", color: "hsl(var(--chart-3))" },
            }}
            className="h-[400px] w-full"
          >
            <ResponsiveContainer>
              <AreaChart data={chartData} stackOffset="none">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Area type="monotone" dataKey="gwi" stackId="1" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.6} name="GWI" />
                <Area type="monotone" dataKey="dwf" stackId="1" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.5} name="DWF" />
                <Area type="monotone" dataKey="rdii" stackId="1" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.5} name="RDII" />
                <Brush dataKey="time" height={20} stroke="hsl(var(--primary))" travellerWidth={8} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <ConvolutionVisualizer />

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
