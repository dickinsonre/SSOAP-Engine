import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Droplets,
  FileUp,
  FileSpreadsheet,
  FolderOpen,
  Gauge,
  Play,
  Plus,
  Settings,
  TrendingDown,
  TrendingUp,
  Upload,
  Waves,
  Loader2,
} from "lucide-react";
import { ICMImportDialog } from "@/components/icm-import-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Project, Simulation, SSOEvent } from "@shared/schema";

interface DashboardStats {
  totalProjects: number;
  activeSimulations: number;
  totalSSOEvents: number;
  averageRDII: number;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendValue,
  accentColor,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  trend?: "up" | "down";
  trendValue?: string;
  accentColor?: string;
}) {
  return (
    <Card className="relative overflow-visible">
      <div className={`absolute top-0 left-0 w-1 h-full rounded-l-md ${accentColor || 'bg-primary'}`} />
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentColor ? accentColor.replace('bg-', 'bg-').split(' ')[0] + '/10' : 'bg-primary/10'}`}>
          <Icon className={`h-5 w-5 ${accentColor ? accentColor.replace('bg-', 'text-').split(' ')[0] : 'text-primary'}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">{description}</p>
          {trend && trendValue && (
            <Badge variant={trend === "up" ? "default" : "secondary"} className="text-xs">
              {trend === "up" ? (
                <TrendingUp className="mr-1 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3" />
              )}
              {trendValue}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  onClick,
  variant = "default",
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "primary" | "accent";
}) {
  const content = (
    <Card className="hover-elevate cursor-pointer h-full transition-all">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
          variant === "primary" 
            ? "bg-primary text-primary-foreground" 
            : variant === "accent"
            ? "bg-blue-500 text-white"
            : "bg-muted"
        }`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );

  if (onClick) {
    return <div onClick={onClick} data-testid={`action-${title.toLowerCase().replace(/\s+/g, '-')}`}>{content}</div>;
  }

  return (
    <Link href={href || "/"} data-testid={`action-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      {content}
    </Link>
  );
}

function ImportSWMMDialog({
  open,
  onOpenChange,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects?: Project[];
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".inp") || file.name.endsWith(".rpt"))) {
        await handleFileUpload(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a .inp or .rpt file",
          variant: "destructive",
        });
      }
    },
    [selectedProject]
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await handleFileUpload(file);
      }
    },
    [selectedProject]
  );

  const handleFileUpload = async (file: File) => {
    const projectId = selectedProject || projects?.[0]?.id;
    if (!projectId) {
      toast({
        title: "No project selected",
        description: "Please select a project first or create one.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      const response = await fetch("/api/simulations/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      queryClient.invalidateQueries({ queryKey: ["/api/simulations/recent"] });
      queryClient.invalidateQueries({ queryKey: [`/api/simulations?projectId=${projectId}`] });
      toast({
        title: "SWMM model imported",
        description: `${file.name} has been uploaded successfully.`,
      });
      onOpenChange(false);
      navigate("/simulation");
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import SWMM Model</DialogTitle>
          <DialogDescription>
            Upload your SWMM5 input file (.inp) or report file (.rpt) to begin analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <label className="text-sm font-medium">Target Project</label>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger data-testid="select-import-project">
              <SelectValue placeholder="Select a project..." />
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

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading model...</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold mb-1">Drag and drop your file here</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Supports SWMM5 input files (.inp) and report files (.rpt)
              </p>
              <label>
                <input
                  type="file"
                  accept=".inp,.rpt"
                  className="hidden"
                  onChange={handleFileInput}
                  data-testid="input-file-upload"
                />
                <Button variant="outline" className="cursor-pointer" asChild>
                  <span>
                    <FileUp className="mr-2 h-4 w-4" />
                    Browse Files
                  </span>
                </Button>
              </label>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Files are processed using the SWMM5 WebAssembly engine for fast, browser-based simulation
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecentProjectCard({ project }: { project: Project }) {
  return (
    <Link href="/projects">
      <Card className="hover-elevate cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base">{project.name}</CardTitle>
              <CardDescription className="text-xs line-clamp-2">
                {project.description}
              </CardDescription>
            </div>
            <Badge
              variant={
                project.status === "active"
                  ? "default"
                  : project.status === "completed"
                  ? "secondary"
                  : "outline"
              }
            >
              {project.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{project.sewershedCount} sewersheds</span>
            <span>{project.totalArea.toLocaleString()} acres</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SimulationProgressCard({ simulation }: { simulation: Simulation }) {
  const statusColors = {
    pending: "bg-muted text-muted-foreground",
    running: "bg-blue-500 text-white",
    completed: "bg-green-600 text-white",
    failed: "bg-destructive text-destructive-foreground",
  };

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card hover-elevate cursor-pointer">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
        simulation.status === "running" ? "bg-blue-500/10" : "bg-muted"
      }`}>
        {simulation.status === "running" ? (
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
        ) : (
          <Play className={`h-4 w-4 ${simulation.status === "completed" ? "text-green-600" : "text-muted-foreground"}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-medium truncate">{simulation.name}</span>
          <Badge className={statusColors[simulation.status]}>
            {simulation.status}
          </Badge>
        </div>
        {simulation.status === "running" && (
          <Progress value={simulation.progress} className="h-1.5" />
        )}
        {simulation.status === "completed" && (
          <span className="text-xs text-muted-foreground">
            Completed in {simulation.duration}s
          </span>
        )}
      </div>
    </div>
  );
}

function RecentSSOEventCard({ event }: { event: SSOEvent }) {
  const severityColors = {
    minor: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    moderate: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    major: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  const severityIconBg = {
    minor: "bg-yellow-500/10",
    moderate: "bg-orange-500/10",
    major: "bg-red-500/10",
  };

  const severityIconColor = {
    minor: "text-yellow-600 dark:text-yellow-400",
    moderate: "text-orange-600 dark:text-orange-400",
    major: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="flex items-center gap-4 p-3 rounded-md border bg-card">
      <div className={`flex h-10 w-10 items-center justify-center rounded-md shrink-0 ${severityIconBg[event.severity]}`}>
        <AlertTriangle className={`h-4 w-4 ${severityIconColor[event.severity]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{event.location}</span>
          <Badge className={severityColors[event.severity]}>{event.severity}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          <span>{event.volume.toLocaleString()} gal</span>
          <span>{event.duration} min</span>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-10 rounded-lg" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WelcomeHero({ onImportClick, onICMImportClick }: { onImportClick: () => void; onICMImportClick?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="relative">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Welcome to SSOAP Toolbox</h2>
            <p className="text-muted-foreground max-w-xl">
              Comprehensive sanitary sewer overflow analysis and planning tools powered by SWMM5 WebAssembly engine.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onImportClick} size="lg" data-testid="button-import-swmm">
              <Upload className="mr-2 h-4 w-4" />
              Import SWMM Model
            </Button>
            <Button onClick={onICMImportClick} variant="outline" size="lg" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20" data-testid="button-import-icm">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Import from ICM
            </Button>
            <Link href="/projects">
              <Button variant="outline" size="lg" data-testid="button-new-project">
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onImportClick }: { onImportClick: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
          <Droplets className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Get Started with SSOAP</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
          Import your first SWMM model or create a new project to begin analyzing your sewer system.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={onImportClick} size="lg" data-testid="button-import-first">
            <Upload className="mr-2 h-4 w-4" />
            Import SWMM Model
          </Button>
          <Link href="/projects">
            <Button variant="outline" size="lg" data-testid="button-create-project">
              <FolderOpen className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [icmImportDialogOpen, setIcmImportDialogOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: simulations, isLoading: simulationsLoading } = useQuery<Simulation[]>({
    queryKey: ["/api/simulations/recent"],
  });

  const { data: ssoEvents, isLoading: eventsLoading } = useQuery<SSOEvent[]>({
    queryKey: ["/api/sso-events/recent"],
  });

  const isLoading = statsLoading || projectsLoading || simulationsLoading || eventsLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your sewer analysis projects and simulations
          </p>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  const hasProjects = projects && projects.length > 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your sewer analysis projects and simulations
        </p>
      </div>

      <ImportSWMMDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} projects={projects} />
      <ICMImportDialog open={icmImportDialogOpen} onOpenChange={setIcmImportDialogOpen} />

      {!hasProjects ? (
        <EmptyState onImportClick={() => setImportDialogOpen(true)} />
      ) : (
        <>
          <WelcomeHero 
            onImportClick={() => setImportDialogOpen(true)} 
            onICMImportClick={() => setIcmImportDialogOpen(true)} 
          />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Active Projects"
              value={stats?.totalProjects || 0}
              description="Total sewer analysis projects"
              icon={FolderOpen}
              accentColor="bg-blue-500"
            />
            <StatCard
              title="Running Simulations"
              value={stats?.activeSimulations || 0}
              description="SWMM5 simulations in progress"
              icon={Play}
              trend="up"
              trendValue="+2 today"
              accentColor="bg-green-500"
            />
            <StatCard
              title="SSO Events"
              value={stats?.totalSSOEvents || 0}
              description="Overflow events recorded"
              icon={AlertTriangle}
              trend="down"
              trendValue="-15%"
              accentColor="bg-orange-500"
            />
            <StatCard
              title="Average RDII"
              value={`${stats?.averageRDII || 0}%`}
              description="System-wide R value"
              icon={Activity}
              accentColor="bg-purple-500"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <QuickActionCard
              title="Run Simulation"
              description="Execute SWMM5 analysis"
              icon={Play}
              href="/simulation"
              variant="primary"
            />
            <QuickActionCard
              title="RDII Analysis"
              description="Configure RTK parameters"
              icon={Waves}
              href="/rdii-analysis"
              variant="accent"
            />
            <QuickActionCard
              title="DWF Analysis"
              description="Dry weather flow & GWI"
              icon={Droplets}
              href="/dwf-analysis"
            />
            <QuickActionCard
              title="View Hydrographs"
              description="Visualize flow data"
              icon={BarChart3}
              href="/hydrograph"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Recent Projects</CardTitle>
                  <CardDescription>Your latest sewer analysis projects</CardDescription>
                </div>
                <Link href="/projects">
                  <Button variant="outline" size="sm" data-testid="button-view-all-projects">
                    View All
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {projects?.slice(0, 3).map((project) => (
                  <RecentProjectCard key={project.id} project={project} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Simulations</CardTitle>
                  <CardDescription>Recent SWMM5 simulation runs</CardDescription>
                </div>
                <Link href="/simulation">
                  <Button variant="outline" size="sm" data-testid="button-view-all-simulations">
                    View All
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {simulations && simulations.length > 0 ? (
                  simulations.slice(0, 4).map((sim) => (
                    <SimulationProgressCard key={sim.id} simulation={sim} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No simulations yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Recent SSO Events</CardTitle>
                <CardDescription>Sanitary sewer overflow incidents</CardDescription>
              </div>
              <Link href="/sso-events">
                <Button variant="outline" size="sm" data-testid="button-view-all-events">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {ssoEvents && ssoEvents.length > 0 ? (
                  ssoEvents.slice(0, 6).map((event) => (
                    <RecentSSOEventCard key={event.id} event={event} />
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center py-8">
                    <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No SSO events recorded</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
