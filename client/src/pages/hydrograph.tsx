import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Download,
  Calendar,
  Droplets,
  TrendingUp,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Bar,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { Project, Hydrograph as HydrographType, RainfallData } from "@shared/schema";

const chartConfig = {
  observed: { label: "Observed Flow", color: "hsl(var(--chart-1))" },
  simulated: { label: "Simulated Flow", color: "hsl(var(--chart-2))" },
  rdii: { label: "RDII Component", color: "hsl(var(--chart-3))" },
  dwf: { label: "Dry Weather Flow", color: "hsl(var(--chart-4))" },
  rainfall: { label: "Rainfall", color: "hsl(var(--chart-5))" },
};

function HydrographChart({ 
  hydrographs, 
  rainfall 
}: { 
  hydrographs: HydrographType[];
  rainfall?: RainfallData;
}) {
  const combinedData: any[] = [];
  
  const observed = hydrographs.find(h => h.type === "observed");
  const simulated = hydrographs.find(h => h.type === "simulated");
  const rdii = hydrographs.find(h => h.type === "rdii");
  const dwf = hydrographs.find(h => h.type === "dwf");

  const allTimes = new Set<string>();
  hydrographs.forEach(h => h.data.forEach(d => allTimes.add(d.time)));
  
  const sortedTimes = Array.from(allTimes).sort();
  
  sortedTimes.forEach(time => {
    const point: any = { time };
    
    const obsPoint = observed?.data.find(d => d.time === time);
    const simPoint = simulated?.data.find(d => d.time === time);
    const rdiiPoint = rdii?.data.find(d => d.time === time);
    const dwfPoint = dwf?.data.find(d => d.time === time);
    const rainPoint = rainfall?.data.find(d => d.timestamp === time);
    
    if (obsPoint) point.observed = obsPoint.flow;
    if (simPoint) point.simulated = simPoint.flow;
    if (rdiiPoint) point.rdii = rdiiPoint.flow;
    if (dwfPoint) point.dwf = dwfPoint.flow;
    if (rainPoint) point.rainfall = rainPoint.intensity * 10;
    
    combinedData.push(point);
  });

  return (
    <ChartContainer config={chartConfig} className="h-[500px] w-full">
      <ResponsiveContainer>
        <ComposedChart data={combinedData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="time" 
            className="text-xs"
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }}
          />
          <YAxis 
            yAxisId="flow"
            className="text-xs"
            label={{ value: 'Flow (MGD)', angle: -90, position: 'insideLeft' }}
          />
          <YAxis 
            yAxisId="rain"
            orientation="right"
            className="text-xs"
            label={{ value: 'Rainfall (in/hr)', angle: 90, position: 'insideRight' }}
            reversed
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend />
          <Bar 
            yAxisId="rain"
            dataKey="rainfall" 
            fill="hsl(var(--chart-5))" 
            opacity={0.4}
            name="Rainfall"
          />
          <Area
            yAxisId="flow"
            type="monotone"
            dataKey="dwf"
            stroke="hsl(var(--chart-4))"
            fill="hsl(var(--chart-4))"
            fillOpacity={0.3}
            name="Dry Weather Flow"
          />
          <Area
            yAxisId="flow"
            type="monotone"
            dataKey="rdii"
            stroke="hsl(var(--chart-3))"
            fill="hsl(var(--chart-3))"
            fillOpacity={0.3}
            name="RDII Component"
          />
          <Line
            yAxisId="flow"
            type="monotone"
            dataKey="observed"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={false}
            name="Observed Flow"
          />
          <Line
            yAxisId="flow"
            type="monotone"
            dataKey="simulated"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Simulated Flow"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function HydrographMetrics({ hydrograph }: { hydrograph: HydrographType }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Peak Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold font-mono">
            {hydrograph.peakFlow.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">MGD</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Total Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold font-mono">
            {hydrograph.totalVolume.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">Million Gallons</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Duration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold font-mono">
            {((new Date(hydrograph.endTime).getTime() - new Date(hydrograph.startTime).getTime()) / 3600000).toFixed(1)}
          </div>
          <p className="text-xs text-muted-foreground">Hours</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Data Interval</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold font-mono">
            {hydrograph.interval}
          </div>
          <p className="text-xs text-muted-foreground">Minutes</p>
        </CardContent>
      </Card>
    </div>
  );
}

function HydrographCard({ 
  hydrograph, 
  isSelected, 
  onSelect 
}: { 
  hydrograph: HydrographType;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const typeColors = {
    observed: "bg-chart-1/10 text-chart-1 border-chart-1/20",
    simulated: "bg-chart-2/10 text-chart-2 border-chart-2/20",
    rdii: "bg-chart-3/10 text-chart-3 border-chart-3/20",
    dwf: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  };

  return (
    <Card
      className={`cursor-pointer transition-colors ${
        isSelected ? "ring-2 ring-primary" : "hover-elevate"
      }`}
      onClick={onSelect}
      data-testid={`card-hydrograph-${hydrograph.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium truncate">{hydrograph.name}</span>
          <Badge className={typeColors[hydrograph.type]}>{hydrograph.type}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {hydrograph.peakFlow.toFixed(1)} MGD
          </div>
          <div className="flex items-center gap-1">
            <Droplets className="h-3 w-3" />
            {hydrograph.totalVolume.toLocaleString()} MG
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HydrographPage() {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedSewershed, setSelectedSewershed] = useState<string>("");
  const [selectedHydrographs, setSelectedHydrographs] = useState<string[]>([]);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: hydrographs, isLoading } = useQuery<HydrographType[]>({
    queryKey: [`/api/hydrographs?projectId=${selectedProject}${selectedSewershed ? `&sewershedId=${selectedSewershed}` : ''}`],
    enabled: !!selectedProject,
  });

  const { data: rainfall } = useQuery<RainfallData>({
    queryKey: [`/api/rainfall?projectId=${selectedProject}`],
    enabled: !!selectedProject,
  });

  const toggleHydrograph = (id: string) => {
    setSelectedHydrographs(prev => 
      prev.includes(id) 
        ? prev.filter(h => h !== id) 
        : [...prev, id]
    );
  };

  const displayedHydrographs = hydrographs?.filter(h => 
    selectedHydrographs.length === 0 || selectedHydrographs.includes(h.id)
  ) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-hydrograph-title">
            Hydrograph Analysis
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualize and analyze flow hydrographs with rainfall overlay
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[180px]" data-testid="select-project">
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
          <Button variant="outline" size="icon" data-testid="button-export">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!selectedProject ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LineChart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Select a project to view hydrograph data
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-[400px] w-full" />
            </CardContent>
          </Card>
        </div>
      ) : !hydrographs || hydrographs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LineChart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Hydrograph Data</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Import flow monitoring data or run a SWMM simulation to generate hydrographs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {displayedHydrographs.length > 0 && (
            <HydrographMetrics hydrograph={displayedHydrographs[0]} />
          )}

          <div className="grid gap-6 lg:grid-cols-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Hydrographs</h3>
                <Badge variant="outline" className="text-xs">
                  {selectedHydrographs.length || hydrographs.length} selected
                </Badge>
              </div>
              {hydrographs.map((hydrograph) => (
                <HydrographCard
                  key={hydrograph.id}
                  hydrograph={hydrograph}
                  isSelected={selectedHydrographs.includes(hydrograph.id)}
                  onSelect={() => toggleHydrograph(hydrograph.id)}
                />
              ))}
            </div>

            <div className="lg:col-span-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Flow Hydrograph</CardTitle>
                    <CardDescription>
                      Observed vs simulated flow with RDII decomposition
                    </CardDescription>
                  </div>
                  {rainfall && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Droplets className="h-3 w-3" />
                      {rainfall.totalRainfall.toFixed(2)}" total
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <HydrographChart 
                    hydrographs={displayedHydrographs} 
                    rainfall={rainfall || undefined}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
