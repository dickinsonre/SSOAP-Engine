import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Play,
  Square,
  Upload,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  Database,
  AlertTriangle,
  BarChart3,
  Gauge,
  FileDown,
} from "lucide-react";
import { ICMImportDialog } from "@/components/icm-import-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Simulation, Project, NodeResult, LinkResult } from "@shared/schema";

function FileUploadZone({
  onFileSelect,
  isUploading,
}: {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);

  const handleLoadSample = useCallback(async () => {
    setLoadingSample(true);
    try {
      const response = await fetch("/sample-data/Greenville_SI.inp");
      const blob = await response.blob();
      const file = new File([blob], "Greenville_SI.inp", { type: "application/octet-stream" });
      onFileSelect(file);
    } catch (err) {
      console.error("Failed to load sample model:", err);
    } finally {
      setLoadingSample(false);
    }
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".inp") || file.name.endsWith(".rpt"))) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  return (
    <Card
      className={`border-dashed transition-colors ${
        isDragging ? "border-primary bg-primary/5" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <h3 className="text-lg font-semibold mb-2">Upload SWMM Input File</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
          Drag and drop your .inp file here, or click to browse. The file will be
          processed using the SWMM5 WebAssembly engine.
        </p>
        <input
          type="file"
          accept=".inp,.rpt"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
          disabled={isUploading}
        />
        <div className="flex items-center gap-3">
          <label htmlFor="file-upload">
            <Button asChild disabled={isUploading} data-testid="button-upload-file">
              <span>
                <FileText className="mr-2 h-4 w-4" />
                {isUploading ? "Uploading..." : "Select File"}
              </span>
            </Button>
          </label>
          <span className="text-xs text-muted-foreground">or</span>
          <Button
            variant="outline"
            onClick={handleLoadSample}
            disabled={isUploading || loadingSample}
            data-testid="button-load-sample-model"
          >
            <Database className="mr-2 h-4 w-4" />
            {loadingSample ? "Loading..." : "Load Sample Model"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Sample: Greenville SWMM5 model (SI units, 14K lines, all features)
        </p>
      </CardContent>
    </Card>
  );
}

function SimulationStatusIcon({ status }: { status: Simulation["status"] }) {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
  }
}

function SimulationCard({
  simulation,
  onRun,
  onStop,
  onDelete,
  isSelected,
  onSelect,
}: {
  simulation: Simulation;
  onRun: () => void;
  onStop: () => void;
  onDelete: () => void;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusColors = {
    pending: "bg-muted text-muted-foreground",
    running: "bg-primary/10 text-primary",
    completed: "bg-green-500/10 text-green-600 dark:text-green-400",
    failed: "bg-destructive/10 text-destructive",
  };

  return (
    <Card
      className={`cursor-pointer transition-colors ${
        isSelected ? "ring-2 ring-primary" : "hover-elevate"
      }`}
      onClick={onSelect}
      data-testid={`card-simulation-${simulation.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <SimulationStatusIcon status={simulation.status} />
            <div>
              <CardTitle className="text-sm">{simulation.name}</CardTitle>
              <CardDescription className="text-xs">
                {simulation.inputFile.split("/").pop()}
              </CardDescription>
            </div>
          </div>
          <Badge className={statusColors[simulation.status]} variant="secondary">
            {simulation.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {simulation.status === "running" && (
          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-xs">
              <span>Progress</span>
              <span>{simulation.progress}%</span>
            </div>
            <Progress value={simulation.progress} className="h-1.5" />
          </div>
        )}
        <div className="flex items-center gap-2">
          {simulation.status === "pending" && (
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onRun(); }} data-testid={`button-run-${simulation.id}`}>
              <Play className="mr-1 h-3 w-3" />
              Run
            </Button>
          )}
          {simulation.status === "running" && (
            <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); onStop(); }} data-testid={`button-stop-${simulation.id}`}>
              <Square className="mr-1 h-3 w-3" />
              Stop
            </Button>
          )}
          {simulation.status === "completed" && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onRun(); }} data-testid={`button-rerun-${simulation.id}`}>
              <RefreshCw className="mr-1 h-3 w-3" />
              Re-run
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="ml-auto"
            data-testid={`button-delete-${simulation.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NodeResultsTable({ results }: { results: NodeResult[] }) {
  if (!results || results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No node results available</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Node ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Max Depth (ft)</TableHead>
            <TableHead className="text-right">Max HGL (ft)</TableHead>
            <TableHead className="text-right">Time Flooded (hr)</TableHead>
            <TableHead className="text-right">Flood Volume (MG)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((node) => (
            <TableRow key={node.id} data-testid={`row-node-${node.id}`}>
              <TableCell className="font-medium">{node.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{node.type}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono">
                {node.maxDepth.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {node.maxHGL.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {node.timeFlooded.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {node.floodVolume.toFixed(4)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function LinkResultsTable({ results }: { results: LinkResult[] }) {
  if (!results || results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No link results available</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Link ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Max Flow (cfs)</TableHead>
            <TableHead className="text-right">Max Velocity (fps)</TableHead>
            <TableHead className="text-right">Max Depth (ft)</TableHead>
            <TableHead className="text-right">Capacity Limited (hr)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((link) => (
            <TableRow key={link.id} data-testid={`row-link-${link.id}`}>
              <TableCell className="font-medium">{link.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{link.type}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono">
                {link.maxFlow.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {link.maxVelocity.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {link.maxDepth.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {link.capacityLimited.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function RunSummaryPanel({ simulation, outputData }: { simulation: Simulation; outputData: Simulation["outputData"] & {} }) {
  const continuityError = outputData.totalInflow > 0
    ? Math.abs((outputData.totalInflow - outputData.totalOutflow) / outputData.totalInflow * 100)
    : 0;
  const continuityStatus = continuityError < 0.5 ? "good" : continuityError < 1.0 ? "warning" : "critical";

  return (
    <Card data-testid="card-run-summary">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Run Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Continuity Error</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono font-semibold">{continuityError.toFixed(2)}%</span>
              <Badge variant={continuityStatus === "good" ? "default" : continuityStatus === "warning" ? "secondary" : "destructive"} className="text-xs">
                {continuityStatus === "good" ? "OK" : continuityStatus === "warning" ? "Warning" : "High"}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <span className="text-lg font-mono font-semibold">{simulation.duration}s</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Inflow</p>
            <span className="text-lg font-mono font-semibold">{outputData.totalInflow.toLocaleString()}</span>
            <p className="text-xs text-muted-foreground">MG</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Outflow</p>
            <span className="text-lg font-mono font-semibold">{outputData.totalOutflow.toLocaleString()}</span>
            <p className="text-xs text-muted-foreground">MG</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Peak Flow</p>
            <span className="text-lg font-mono font-semibold">{outputData.peakFlow.toFixed(1)} CFS</span>
            <p className="text-xs text-muted-foreground">at {outputData.peakTime}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nodes / Links</p>
            <span className="text-lg font-mono font-semibold">{outputData.nodeResults.length} / {outputData.linkResults.length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FloodingSummaryPanel({ nodeResults }: { nodeResults: NodeResult[] }) {
  const floodedNodes = nodeResults.filter(n => n.floodVolume > 0).sort((a, b) => b.floodVolume - a.floodVolume);
  const totalFloodVolume = floodedNodes.reduce((s, n) => s + n.floodVolume, 0);
  const totalFloodHours = floodedNodes.reduce((s, n) => s + n.timeFlooded, 0);

  const chartData = floodedNodes.slice(0, 10).map(n => ({
    name: n.name,
    volume: Number(n.floodVolume.toFixed(4)),
    hours: Number(n.timeFlooded.toFixed(2)),
  }));

  const floodChartConfig = {
    volume: { label: "Flood Volume (MG)", color: "hsl(var(--destructive))" },
  };

  return (
    <Card data-testid="card-flooding-summary">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-base">Flooding Summary</CardTitle>
          {floodedNodes.length > 0 && (
            <Badge variant="destructive" className="ml-auto">{floodedNodes.length} flooded</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {floodedNodes.length === 0 ? (
          <div className="flex items-center gap-2 p-4 bg-green-500/10 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">No flooding detected</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-destructive/10 rounded-lg text-center">
                <p className="text-xl font-mono font-semibold text-destructive">{floodedNodes.length}</p>
                <p className="text-xs text-muted-foreground">Flooded Nodes</p>
              </div>
              <div className="p-3 bg-destructive/10 rounded-lg text-center">
                <p className="text-xl font-mono font-semibold text-destructive">{totalFloodVolume.toFixed(3)}</p>
                <p className="text-xs text-muted-foreground">Total Vol (MG)</p>
              </div>
              <div className="p-3 bg-destructive/10 rounded-lg text-center">
                <p className="text-xl font-mono font-semibold text-destructive">{totalFloodHours.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Total Flood Hrs</p>
              </div>
            </div>
            {chartData.length > 0 && (
              <ChartContainer config={floodChartConfig} className="h-[180px] w-full">
                <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={55} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="volume" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CapacityAnalysisPanel({ linkResults }: { linkResults: LinkResult[] }) {
  const critical = linkResults.filter(l => l.capacityLimited > 0.5);
  const warning = linkResults.filter(l => l.capacityLimited > 0 && l.capacityLimited <= 0.5);
  const ok = linkResults.filter(l => l.capacityLimited === 0);

  const topCapacity = [...linkResults]
    .sort((a, b) => b.capacityLimited - a.capacityLimited)
    .slice(0, 8)
    .filter(l => l.capacityLimited > 0);

  const capChartConfig = {
    hours: { label: "Capacity Limited (hr)", color: "hsl(var(--chart-1))" },
  };

  return (
    <Card data-testid="card-capacity-analysis">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Capacity Analysis</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-destructive/10 rounded-lg text-center">
            <p className="text-xl font-mono font-semibold text-destructive">{critical.length}</p>
            <p className="text-xs text-muted-foreground">Critical (&gt;0.5 hr)</p>
          </div>
          <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
            <p className="text-xl font-mono font-semibold text-yellow-600 dark:text-yellow-400">{warning.length}</p>
            <p className="text-xs text-muted-foreground">Warning</p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg text-center">
            <p className="text-xl font-mono font-semibold text-green-600 dark:text-green-400">{ok.length}</p>
            <p className="text-xs text-muted-foreground">OK</p>
          </div>
        </div>
        {topCapacity.length > 0 && (
          <ChartContainer config={capChartConfig} className="h-[180px] w-full">
            <BarChart data={topCapacity.map(l => ({ name: l.name, hours: Number(l.capacityLimited.toFixed(2)) }))} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={55} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="hours" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ExportPanel({ simulation }: { simulation: Simulation }) {
  const handleExportCSV = useCallback(() => {
    if (!simulation.outputData) return;
    const { nodeResults, linkResults } = simulation.outputData;
    let csv = "Type,ID,Name,MaxDepth,MaxHGL,TimeFlooded,FloodVolume,MaxFlow,MaxVelocity,CapacityLimited\n";
    nodeResults.forEach(n => {
      csv += `Node,${n.id},${n.name},${n.maxDepth},${n.maxHGL},${n.timeFlooded},${n.floodVolume},,, \n`;
    });
    linkResults.forEach(l => {
      csv += `Link,${l.id},${l.name},${l.maxDepth},,,,${l.maxFlow},${l.maxVelocity},${l.capacityLimited}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${simulation.name.replace(/\s+/g, "_")}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [simulation]);

  const handleExportJSON = useCallback(() => {
    if (!simulation.outputData) return;
    const blob = new Blob([JSON.stringify(simulation.outputData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${simulation.name.replace(/\s+/g, "_")}_results.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [simulation]);

  return (
    <Card data-testid="card-export">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileDown className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Export Results</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJSON} data-testid="button-export-json">
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SimulationResults({ simulation }: { simulation: Simulation }) {
  if (!simulation.outputData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            {simulation.status === "running"
              ? "Simulation in progress..."
              : simulation.status === "failed"
              ? "Simulation failed. Check logs for details."
              : "Run the simulation to see results."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { outputData } = simulation;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <RunSummaryPanel simulation={simulation} outputData={outputData} />
        <FloodingSummaryPanel nodeResults={outputData.nodeResults} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CapacityAnalysisPanel linkResults={outputData.linkResults} />
        <ExportPanel simulation={simulation} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detailed Results</CardTitle>
          <CardDescription>Node and link simulation results</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="nodes">
            <TabsList>
              <TabsTrigger value="nodes" data-testid="tab-nodes">Node Results</TabsTrigger>
              <TabsTrigger value="links" data-testid="tab-links">Link Results</TabsTrigger>
            </TabsList>
            <TabsContent value="nodes">
              <NodeResultsTable results={outputData.nodeResults} />
            </TabsContent>
            <TabsContent value="links">
              <LinkResultsTable results={outputData.linkResults} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SimulationPage() {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedSimulation, setSelectedSimulation] = useState<Simulation | null>(null);
  const { toast } = useToast();

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: simulations, isLoading } = useQuery<Simulation[]>({
    queryKey: [`/api/simulations?projectId=${selectedProject}`],
    enabled: !!selectedProject,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", selectedProject);
      const response = await fetch("/api/simulations/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/simulations?projectId=${selectedProject}`] });
      toast({ title: "File uploaded", description: "Simulation created successfully." });
    },
    onError: () => {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const runMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/simulations/${id}/run`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/simulations?projectId=${selectedProject}`] });
      toast({ title: "Simulation started" });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/simulations/${id}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/simulations?projectId=${selectedProject}`] });
      toast({ title: "Simulation stopped" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/simulations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/simulations?projectId=${selectedProject}`] });
      setSelectedSimulation(null);
      toast({ title: "Simulation deleted" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-simulation-title">
            SWMM5 Simulation
          </h1>
          <p className="text-sm text-muted-foreground">
            Run hydraulic simulations using the WebAssembly SWMM5 engine
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            SWMM 5.1 WASM
          </Badge>
          <ICMImportDialog />
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
      </div>

      {!selectedProject ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              Select a project to view and run simulations
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <FileUploadZone
              onFileSelect={(file) => uploadMutation.mutate(file)}
              isUploading={uploadMutation.isPending}
            />

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-3">
                      <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-20" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : simulations && simulations.length > 0 ? (
              <div className="space-y-3">
                {simulations.map((sim) => (
                  <SimulationCard
                    key={sim.id}
                    simulation={sim}
                    onRun={() => runMutation.mutate(sim.id)}
                    onStop={() => stopMutation.mutate(sim.id)}
                    onDelete={() => deleteMutation.mutate(sim.id)}
                    isSelected={selectedSimulation?.id === sim.id}
                    onSelect={() => setSelectedSimulation(sim)}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground text-center">
                    No simulations yet. Upload a SWMM input file to get started.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2">
            {selectedSimulation ? (
              <SimulationResults simulation={selectedSimulation} />
            ) : (
              <Card className="h-full">
                <CardContent className="flex flex-col items-center justify-center h-full min-h-[400px]">
                  <Play className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground text-center">
                    Select a simulation to view results
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
