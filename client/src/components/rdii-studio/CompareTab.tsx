import { GitCompare, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

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
