import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity,
  Plus,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Info,
  Save,
  Dna,
} from "lucide-react";
import { GACalibrationDialog } from "@/components/ga-calibration-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Project, RDIIParameters, InsertRDIIParameters } from "@shared/schema";
import { insertRDIIParametersSchema } from "@shared/schema";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

function RTKParameterCard({ 
  label, 
  rValue, 
  tValue, 
  kValue,
  description,
  color,
}: { 
  label: string;
  rValue: number;
  tValue: number;
  kValue: number;
  description: string;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[200px]">
              <p className="text-xs">{description}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">R (fraction)</span>
          <span className="text-sm font-mono font-medium" style={{ color }}>
            {rValue.toFixed(4)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">T (hours)</span>
          <span className="text-sm font-mono font-medium">{tValue.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">K (ratio)</span>
          <span className="text-sm font-mono font-medium">{kValue.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function RDIIParameterEditor({
  parameters,
  onSave,
  isSaving,
  showCalibration = true,
}: {
  parameters: RDIIParameters;
  onSave: (data: Partial<InsertRDIIParameters>) => void;
  isSaving: boolean;
  showCalibration?: boolean;
}) {
  const [r1, setR1] = useState(parameters.r1);
  const [r2, setR2] = useState(parameters.r2);
  const [r3, setR3] = useState(parameters.r3);
  const [t1, setT1] = useState(parameters.t1);
  const [t2, setT2] = useState(parameters.t2);
  const [t3, setT3] = useState(parameters.t3);
  const [k1, setK1] = useState(parameters.k1);
  const [k2, setK2] = useState(parameters.k2);
  const [k3, setK3] = useState(parameters.k3);

  const totalR = r1 + r2 + r3;

  const handleSave = () => {
    onSave({ r1, r2, r3, t1, t2, t3, k1, k2, k3 });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{parameters.sewershedName}</h3>
          <p className="text-sm text-muted-foreground">
            Area: {parameters.area.toLocaleString()} acres
          </p>
        </div>
        <Badge variant={totalR > 0.3 ? "destructive" : totalR > 0.15 ? "secondary" : "default"}>
          Total R: {(totalR * 100).toFixed(1)}%
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Fast Response (R1, T1, K1)</CardTitle>
            <CardDescription className="text-xs">
              Quick runoff - typically inflow-driven
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>R1 (fraction)</span>
                <span className="font-mono">{r1.toFixed(4)}</span>
              </div>
              <Slider
                value={[r1]}
                onValueChange={([v]) => setR1(v)}
                min={0}
                max={0.5}
                step={0.001}
                data-testid="slider-r1"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>T1 (hours)</span>
                <span className="font-mono">{t1.toFixed(2)}</span>
              </div>
              <Slider
                value={[t1]}
                onValueChange={([v]) => setT1(v)}
                min={0.5}
                max={6}
                step={0.1}
                data-testid="slider-t1"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>K1 (ratio)</span>
                <span className="font-mono">{k1.toFixed(2)}</span>
              </div>
              <Slider
                value={[k1]}
                onValueChange={([v]) => setK1(v)}
                min={1}
                max={6}
                step={0.1}
                data-testid="slider-k1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Medium Response (R2, T2, K2)</CardTitle>
            <CardDescription className="text-xs">
              Delayed response - mixed inflow/infiltration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>R2 (fraction)</span>
                <span className="font-mono">{r2.toFixed(4)}</span>
              </div>
              <Slider
                value={[r2]}
                onValueChange={([v]) => setR2(v)}
                min={0}
                max={0.5}
                step={0.001}
                data-testid="slider-r2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>T2 (hours)</span>
                <span className="font-mono">{t2.toFixed(2)}</span>
              </div>
              <Slider
                value={[t2]}
                onValueChange={([v]) => setT2(v)}
                min={2}
                max={24}
                step={0.5}
                data-testid="slider-t2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>K2 (ratio)</span>
                <span className="font-mono">{k2.toFixed(2)}</span>
              </div>
              <Slider
                value={[k2]}
                onValueChange={([v]) => setK2(v)}
                min={1}
                max={6}
                step={0.1}
                data-testid="slider-k2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Slow Response (R3, T3, K3)</CardTitle>
            <CardDescription className="text-xs">
              Prolonged response - primarily infiltration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>R3 (fraction)</span>
                <span className="font-mono">{r3.toFixed(4)}</span>
              </div>
              <Slider
                value={[r3]}
                onValueChange={([v]) => setR3(v)}
                min={0}
                max={0.5}
                step={0.001}
                data-testid="slider-r3"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>T3 (hours)</span>
                <span className="font-mono">{t3.toFixed(2)}</span>
              </div>
              <Slider
                value={[t3]}
                onValueChange={([v]) => setT3(v)}
                min={12}
                max={96}
                step={1}
                data-testid="slider-t3"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>K3 (ratio)</span>
                <span className="font-mono">{k3.toFixed(2)}</span>
              </div>
              <Slider
                value={[k3]}
                onValueChange={([v]) => setK3(v)}
                min={1}
                max={6}
                step={0.1}
                data-testid="slider-k3"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-3">
        {showCalibration && (
          <GACalibrationDialog
            parameters={parameters}
            trigger={
              <Button variant="outline" data-testid="button-ga-calibration">
                <Dna className="mr-2 h-4 w-4" />
                GA Calibration
              </Button>
            }
          />
        )}
        <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-rdii">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save Parameters"}
        </Button>
      </div>
    </div>
  );
}

function RDIIComparisonTable({ parameters }: { parameters: RDIIParameters[] }) {
  return (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sewershed</TableHead>
            <TableHead className="text-right">Area (ac)</TableHead>
            <TableHead className="text-right">R1</TableHead>
            <TableHead className="text-right">R2</TableHead>
            <TableHead className="text-right">R3</TableHead>
            <TableHead className="text-right">Total R</TableHead>
            <TableHead>Response Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parameters.map((param) => (
            <TableRow key={param.id} data-testid={`row-rdii-${param.id}`}>
              <TableCell className="font-medium">{param.sewershedName}</TableCell>
              <TableCell className="text-right font-mono">
                {param.area.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono text-chart-1">
                {(param.r1 * 100).toFixed(2)}%
              </TableCell>
              <TableCell className="text-right font-mono text-chart-2">
                {(param.r2 * 100).toFixed(2)}%
              </TableCell>
              <TableCell className="text-right font-mono text-chart-3">
                {(param.r3 * 100).toFixed(2)}%
              </TableCell>
              <TableCell className="text-right font-mono font-medium">
                {(param.totalR * 100).toFixed(2)}%
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    param.dominantResponse === "inflow"
                      ? "default"
                      : param.dominantResponse === "infiltration"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {param.dominantResponse === "inflow" && <TrendingUp className="mr-1 h-3 w-3" />}
                  {param.dominantResponse === "infiltration" && <TrendingDown className="mr-1 h-3 w-3" />}
                  {param.dominantResponse}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function generateHydrographData(params: RDIIParameters) {
  const data = [];
  const maxTime = Math.max(params.t1 * (1 + params.k1), params.t2 * (1 + params.k2), params.t3 * (1 + params.k3));
  
  for (let t = 0; t <= maxTime; t += 0.5) {
    const q1 = t <= params.t1 
      ? (params.r1 / params.t1) * t 
      : t <= params.t1 * (1 + params.k1) 
        ? params.r1 * (1 - (t - params.t1) / (params.k1 * params.t1))
        : 0;
    
    const q2 = t <= params.t2 
      ? (params.r2 / params.t2) * t 
      : t <= params.t2 * (1 + params.k2) 
        ? params.r2 * (1 - (t - params.t2) / (params.k2 * params.t2))
        : 0;
    
    const q3 = t <= params.t3 
      ? (params.r3 / params.t3) * t 
      : t <= params.t3 * (1 + params.k3) 
        ? params.r3 * (1 - (t - params.t3) / (params.k3 * params.t3))
        : 0;

    data.push({
      time: t,
      fast: Math.max(0, q1 * 100),
      medium: Math.max(0, q2 * 100),
      slow: Math.max(0, q3 * 100),
      total: Math.max(0, (q1 + q2 + q3) * 100),
    });
  }
  
  return data;
}

const chartConfig = {
  fast: { label: "Fast (R1)", color: "hsl(var(--chart-1))" },
  medium: { label: "Medium (R2)", color: "hsl(var(--chart-2))" },
  slow: { label: "Slow (R3)", color: "hsl(var(--chart-3))" },
};

export default function RDIIAnalysisPage() {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedParameter, setSelectedParameter] = useState<RDIIParameters | null>(null);
  const { toast } = useToast();

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: rdiiParams, isLoading } = useQuery<RDIIParameters[]>({
    queryKey: [`/api/rdii-parameters?projectId=${selectedProject}`],
    enabled: !!selectedProject,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertRDIIParameters> }) => {
      return apiRequest("PATCH", `/api/rdii-parameters/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rdii-parameters?projectId=${selectedProject}`] });
      toast({ title: "Parameters saved", description: "RTK parameters updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save parameters.", variant: "destructive" });
    },
  });

  const hydrographData = selectedParameter ? generateHydrographData(selectedParameter) : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-rdii-title">
            RDII Analysis
          </h1>
          <p className="text-sm text-muted-foreground">
            Analyze rainfall-derived infiltration and inflow using the RTK method
          </p>
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-[200px]" data-testid="select-project">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedProject ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Select a project to analyze RDII parameters
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !rdiiParams || rdiiParams.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No RDII Parameters</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Run a flow monitoring analysis or import RDII parameters to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="parameters">
          <TabsList>
            <TabsTrigger value="parameters" data-testid="tab-parameters">
              Parameter Editor
            </TabsTrigger>
            <TabsTrigger value="comparison" data-testid="tab-comparison">
              Comparison Table
            </TabsTrigger>
            <TabsTrigger value="hydrograph" data-testid="tab-hydrograph">
              Unit Hydrograph
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parameters" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-4">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Sewersheds</h3>
                {rdiiParams.map((param) => (
                  <Card
                    key={param.id}
                    className={`cursor-pointer transition-colors ${
                      selectedParameter?.id === param.id ? "ring-2 ring-primary" : "hover-elevate"
                    }`}
                    onClick={() => setSelectedParameter(param)}
                    data-testid={`card-sewershed-${param.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{param.sewershedName}</span>
                        <Badge variant="outline" className="text-xs">
                          {(param.totalR * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="lg:col-span-3">
                {selectedParameter ? (
                  <RDIIParameterEditor
                    parameters={selectedParameter}
                    onSave={(data) =>
                      updateMutation.mutate({ id: selectedParameter.id, data })
                    }
                    isSaving={updateMutation.isPending}
                  />
                ) : (
                  <Card className="h-full">
                    <CardContent className="flex flex-col items-center justify-center h-full min-h-[400px]">
                      <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Select a sewershed to edit RTK parameters
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="comparison" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">RDII Parameter Comparison</CardTitle>
                <CardDescription>
                  Compare RTK parameters across all sewersheds
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RDIIComparisonTable parameters={rdiiParams} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hydrograph" className="mt-6">
            {selectedParameter ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Unit Hydrograph - {selectedParameter.sewershedName}
                  </CardTitle>
                  <CardDescription>
                    Synthetic unit hydrograph based on RTK parameters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[400px] w-full">
                    <ResponsiveContainer>
                      <AreaChart data={hydrographData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="time"
                          label={{ value: "Time (hours)", position: "bottom" }}
                          className="text-xs"
                        />
                        <YAxis
                          label={{
                            value: "RDII Response (%)",
                            angle: -90,
                            position: "insideLeft",
                          }}
                          className="text-xs"
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="fast"
                          stackId="1"
                          stroke="hsl(var(--chart-1))"
                          fill="hsl(var(--chart-1))"
                          fillOpacity={0.6}
                          name="Fast Response"
                        />
                        <Area
                          type="monotone"
                          dataKey="medium"
                          stackId="1"
                          stroke="hsl(var(--chart-2))"
                          fill="hsl(var(--chart-2))"
                          fillOpacity={0.6}
                          name="Medium Response"
                        />
                        <Area
                          type="monotone"
                          dataKey="slow"
                          stackId="1"
                          stroke="hsl(var(--chart-3))"
                          fill="hsl(var(--chart-3))"
                          fillOpacity={0.6}
                          name="Slow Response"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">
                    Select a sewershed to view unit hydrograph
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
