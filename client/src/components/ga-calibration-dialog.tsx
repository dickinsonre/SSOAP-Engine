import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Dna,
  Loader2,
  Play,
  Settings2,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RDIIParameters } from "@shared/schema";

interface GAConfig {
  populationSize: number;
  maxGenerations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteCount: number;
  parameterRanges: {
    r1: { min: number; max: number };
    t1: { min: number; max: number };
    k1: { min: number; max: number };
    r2: { min: number; max: number };
    t2: { min: number; max: number };
    k2: { min: number; max: number };
    r3: { min: number; max: number };
    t3: { min: number; max: number };
    k3: { min: number; max: number };
  };
}

interface RTKParameters {
  r1: number; t1: number; k1: number;
  r2: number; t2: number; k2: number;
  r3: number; t3: number; k3: number;
}

interface GenerationResult {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  bestIndividual: RTKParameters;
}

interface CalibrationResult {
  optimizedParameters: RTKParameters;
  finalFitness: number;
  generationHistory: GenerationResult[];
  simulatedFlow: number[];
  observedFlow: number[];
  timestamps: number[];
  statistics: {
    nashSutcliffe: number;
    rmse: number;
    correlationCoefficient: number;
    peakFlowError: number;
    volumeError: number;
  };
}

interface GACalibrationDialogProps {
  parameters: RDIIParameters;
  trigger?: React.ReactNode;
}

export function GACalibrationDialog({ parameters, trigger }: GACalibrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("config");
  const { toast } = useToast();
  
  const [config, setConfig] = useState<GAConfig>({
    populationSize: 50,
    maxGenerations: 100,
    mutationRate: 0.1,
    crossoverRate: 0.8,
    eliteCount: 2,
    parameterRanges: {
      r1: { min: 0.0001, max: 0.2 },
      t1: { min: 0.5, max: 4 },
      k1: { min: 1.5, max: 4 },
      r2: { min: 0.0001, max: 0.15 },
      t2: { min: 2, max: 12 },
      k2: { min: 2, max: 6 },
      r3: { min: 0.0001, max: 0.1 },
      t3: { min: 6, max: 48 },
      k3: { min: 2, max: 8 },
    },
  });

  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null);
  const [originalParams, setOriginalParams] = useState<RTKParameters | null>(null);

  const runCalibration = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/calibration/run", {
        rdiiParameterId: parameters.id,
        gaConfig: config,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setCalibrationResult(data.result);
        setOriginalParams(data.originalParameters);
        setActiveTab("results");
        toast({
          title: "Calibration Complete",
          description: `Nash-Sutcliffe: ${(data.result.statistics.nashSutcliffe * 100).toFixed(1)}%`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Calibration Failed",
        description: "An error occurred during calibration",
        variant: "destructive",
      });
    },
  });

  const applyCalibration = useMutation({
    mutationFn: async () => {
      if (!calibrationResult) return;
      const response = await apiRequest("POST", "/api/calibration/apply", {
        rdiiParameterId: parameters.id,
        optimizedParameters: calibrationResult.optimizedParameters,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rdii-parameters"] });
      toast({
        title: "Parameters Applied",
        description: "Optimized RTK parameters have been saved",
      });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "Failed to Apply",
        description: "Could not save optimized parameters",
        variant: "destructive",
      });
    },
  });

  const fitnessChartData = calibrationResult?.generationHistory.map((gen) => ({
    generation: gen.generation,
    bestFitness: gen.bestFitness * 100,
    avgFitness: gen.averageFitness * 100,
  })) || [];

  const flowComparisonData = calibrationResult ? 
    calibrationResult.timestamps.slice(0, 96).map((t, i) => ({
      time: i,
      observed: calibrationResult.observedFlow[i] || 0,
      simulated: calibrationResult.simulatedFlow[i] || 0,
    })) : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" data-testid="button-ga-calibration">
            <Dna className="mr-2 h-4 w-4" />
            GA Calibration
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dna className="h-5 w-5 text-primary" />
            Genetic Algorithm Calibration
          </DialogTitle>
          <DialogDescription>
            Automatically optimize RTK parameters using evolutionary algorithms for {parameters.sewershedName}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config" data-testid="tab-config">
              <Settings2 className="mr-2 h-4 w-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="results" disabled={!calibrationResult} data-testid="tab-results">
              <TrendingUp className="mr-2 h-4 w-4" />
              Results
            </TabsTrigger>
            <TabsTrigger value="comparison" disabled={!calibrationResult} data-testid="tab-comparison">
              <Activity className="mr-2 h-4 w-4" />
              Comparison
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="config" className="mt-0 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Algorithm Settings</CardTitle>
                  <CardDescription className="text-xs">
                    Configure genetic algorithm parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Population Size</Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[config.populationSize]}
                          onValueChange={([v]) => setConfig(c => ({ ...c, populationSize: v }))}
                          min={20}
                          max={200}
                          step={10}
                          className="flex-1"
                          data-testid="slider-population"
                        />
                        <span className="w-12 text-right font-mono text-sm">{config.populationSize}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Max Generations</Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[config.maxGenerations]}
                          onValueChange={([v]) => setConfig(c => ({ ...c, maxGenerations: v }))}
                          min={20}
                          max={500}
                          step={10}
                          className="flex-1"
                          data-testid="slider-generations"
                        />
                        <span className="w-12 text-right font-mono text-sm">{config.maxGenerations}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Mutation Rate</Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[config.mutationRate * 100]}
                          onValueChange={([v]) => setConfig(c => ({ ...c, mutationRate: v / 100 }))}
                          min={1}
                          max={30}
                          step={1}
                          className="flex-1"
                          data-testid="slider-mutation"
                        />
                        <span className="w-12 text-right font-mono text-sm">{(config.mutationRate * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Crossover Rate</Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[config.crossoverRate * 100]}
                          onValueChange={([v]) => setConfig(c => ({ ...c, crossoverRate: v / 100 }))}
                          min={50}
                          max={100}
                          step={5}
                          className="flex-1"
                          data-testid="slider-crossover"
                        />
                        <span className="w-12 text-right font-mono text-sm">{(config.crossoverRate * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Elite Count</Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[config.eliteCount]}
                          onValueChange={([v]) => setConfig(c => ({ ...c, eliteCount: v }))}
                          min={1}
                          max={10}
                          step={1}
                          className="flex-1"
                          data-testid="slider-elite"
                        />
                        <span className="w-12 text-right font-mono text-sm">{config.eliteCount}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Parameter Ranges</CardTitle>
                  <CardDescription className="text-xs">
                    Define min/max bounds for RTK optimization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Parameter</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right w-24">Min</TableHead>
                        <TableHead className="text-right w-24">Max</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(['r1', 't1', 'k1', 'r2', 't2', 'k2', 'r3', 't3', 'k3'] as const).map((param) => {
                        const descriptions: Record<string, string> = {
                          r1: "Fast response fraction",
                          t1: "Fast time to peak (hrs)",
                          k1: "Fast recession ratio",
                          r2: "Medium response fraction",
                          t2: "Medium time to peak (hrs)",
                          k2: "Medium recession ratio",
                          r3: "Slow response fraction",
                          t3: "Slow time to peak (hrs)",
                          k3: "Slow recession ratio",
                        };
                        return (
                          <TableRow key={param}>
                            <TableCell className="font-mono font-medium">{param.toUpperCase()}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{descriptions[param]}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step={param.startsWith('r') ? 0.001 : 0.1}
                                value={config.parameterRanges[param].min}
                                onChange={(e) => setConfig(c => ({
                                  ...c,
                                  parameterRanges: {
                                    ...c.parameterRanges,
                                    [param]: { ...c.parameterRanges[param], min: parseFloat(e.target.value) || 0 }
                                  }
                                }))}
                                className="w-20 h-8 text-right font-mono text-xs"
                                data-testid={`input-${param}-min`}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step={param.startsWith('r') ? 0.001 : 0.1}
                                value={config.parameterRanges[param].max}
                                onChange={(e) => setConfig(c => ({
                                  ...c,
                                  parameterRanges: {
                                    ...c.parameterRanges,
                                    [param]: { ...c.parameterRanges[param], max: parseFloat(e.target.value) || 0 }
                                  }
                                }))}
                                className="w-20 h-8 text-right font-mono text-xs"
                                data-testid={`input-${param}-max`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={() => runCalibration.mutate()}
                  disabled={runCalibration.isPending}
                  size="lg"
                  data-testid="button-run-calibration"
                >
                  {runCalibration.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running Calibration...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Calibration
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="results" className="mt-0 space-y-6">
              {calibrationResult && (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">
                            {(calibrationResult.statistics.nashSutcliffe * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Nash-Sutcliffe</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {calibrationResult.statistics.rmse.toFixed(3)}
                          </div>
                          <div className="text-xs text-muted-foreground">RMSE</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {(calibrationResult.statistics.correlationCoefficient * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Correlation</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${Math.abs(calibrationResult.statistics.volumeError) < 10 ? 'text-green-600' : 'text-amber-600'}`}>
                            {calibrationResult.statistics.volumeError > 0 ? '+' : ''}{calibrationResult.statistics.volumeError.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Volume Error</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Fitness Evolution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{
                          bestFitness: { label: "Best Fitness", color: "hsl(var(--primary))" },
                          avgFitness: { label: "Average Fitness", color: "hsl(var(--muted-foreground))" },
                        }}
                        className="h-[200px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={fitnessChartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="generation" tick={{ fontSize: 10 }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="bestFitness"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={false}
                              name="Best Fitness"
                            />
                            <Line
                              type="monotone"
                              dataKey="avgFitness"
                              stroke="hsl(var(--muted-foreground))"
                              strokeWidth={1}
                              strokeDasharray="4 4"
                              dot={false}
                              name="Avg Fitness"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Optimized Parameters</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Triangle</TableHead>
                            <TableHead className="text-right">R (fraction)</TableHead>
                            <TableHead className="text-right">T (hours)</TableHead>
                            <TableHead className="text-right">K (ratio)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">Fast Response</TableCell>
                            <TableCell className="text-right font-mono">{calibrationResult.optimizedParameters.r1.toFixed(4)}</TableCell>
                            <TableCell className="text-right font-mono">{calibrationResult.optimizedParameters.t1.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">{calibrationResult.optimizedParameters.k1.toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Medium Response</TableCell>
                            <TableCell className="text-right font-mono">{calibrationResult.optimizedParameters.r2.toFixed(4)}</TableCell>
                            <TableCell className="text-right font-mono">{calibrationResult.optimizedParameters.t2.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">{calibrationResult.optimizedParameters.k2.toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Slow Response</TableCell>
                            <TableCell className="text-right font-mono">{calibrationResult.optimizedParameters.r3.toFixed(4)}</TableCell>
                            <TableCell className="text-right font-mono">{calibrationResult.optimizedParameters.t3.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">{calibrationResult.optimizedParameters.k3.toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50">
                            <TableCell className="font-medium">Total R</TableCell>
                            <TableCell className="text-right font-mono font-bold" colSpan={3}>
                              {((calibrationResult.optimizedParameters.r1 + calibrationResult.optimizedParameters.r2 + calibrationResult.optimizedParameters.r3) * 100).toFixed(2)}%
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setActiveTab("comparison")} data-testid="button-view-comparison">
                      View Comparison
                    </Button>
                    <Button
                      onClick={() => applyCalibration.mutate()}
                      disabled={applyCalibration.isPending}
                      data-testid="button-apply-calibration"
                    >
                      {applyCalibration.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Apply Optimized Parameters
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="comparison" className="mt-0 space-y-6">
              {calibrationResult && originalParams && (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Flow Comparison</CardTitle>
                      <CardDescription className="text-xs">
                        Observed vs. Simulated RDII Flow
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{
                          observed: { label: "Observed", color: "hsl(var(--primary))" },
                          simulated: { label: "Simulated", color: "hsl(var(--chart-2))" },
                        }}
                        className="h-[250px]"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={flowComparisonData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="time" tick={{ fontSize: 10 }} label={{ value: 'Time (hrs)', position: 'insideBottom', offset: -5 }} />
                            <YAxis tick={{ fontSize: 10 }} label={{ value: 'Flow', angle: -90, position: 'insideLeft' }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="observed"
                              stroke="hsl(var(--primary))"
                              fill="hsl(var(--primary))"
                              fillOpacity={0.3}
                              strokeWidth={2}
                              name="Observed"
                            />
                            <Area
                              type="monotone"
                              dataKey="simulated"
                              stroke="hsl(var(--chart-2))"
                              fill="hsl(var(--chart-2))"
                              fillOpacity={0.3}
                              strokeWidth={2}
                              name="Simulated"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Parameter Comparison</CardTitle>
                      <CardDescription className="text-xs">
                        Original vs. Optimized RTK Values
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Parameter</TableHead>
                            <TableHead className="text-right">Original</TableHead>
                            <TableHead className="text-right">Optimized</TableHead>
                            <TableHead className="text-right">Change</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(['r1', 't1', 'k1', 'r2', 't2', 'k2', 'r3', 't3', 'k3'] as const).map((param) => {
                            const orig = originalParams[param];
                            const opt = calibrationResult.optimizedParameters[param];
                            const change = ((opt - orig) / (orig || 1)) * 100;
                            const isR = param.startsWith('r');
                            
                            return (
                              <TableRow key={param}>
                                <TableCell className="font-mono font-medium">{param.toUpperCase()}</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                  {isR ? orig.toFixed(4) : orig.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {isR ? opt.toFixed(4) : opt.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={Math.abs(change) < 10 ? "secondary" : "default"} className="font-mono">
                                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => applyCalibration.mutate()}
                      disabled={applyCalibration.isPending}
                      data-testid="button-apply-from-comparison"
                    >
                      {applyCalibration.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Apply Optimized Parameters
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
