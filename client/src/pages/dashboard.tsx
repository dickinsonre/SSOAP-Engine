import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Droplets,
  FolderOpen,
  Play,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
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
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  trend?: "up" | "down";
  trendValue?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
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

function RecentProjectCard({ project }: { project: Project }) {
  return (
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
  );
}

function SimulationProgressCard({ simulation }: { simulation: Simulation }) {
  const statusColors = {
    pending: "bg-muted text-muted-foreground",
    running: "bg-primary text-primary-foreground",
    completed: "bg-green-600 text-white",
    failed: "bg-destructive text-destructive-foreground",
  };

  return (
    <div className="flex items-center gap-4 p-3 rounded-md border bg-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
        <Play className="h-4 w-4" />
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

  return (
    <div className="flex items-center gap-4 p-3 rounded-md border bg-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10">
        <AlertTriangle className="h-4 w-4 text-destructive" />
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-9 rounded-md" />
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

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <Droplets className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Welcome to SSOAP Toolbox</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Get started by creating your first project. You can then run SWMM5 simulations,
          analyze RDII parameters, and assess sewer conditions.
        </p>
        <Link href="/projects">
          <Button data-testid="button-create-project">
            <FolderOpen className="mr-2 h-4 w-4" />
            Create First Project
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
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

      {!hasProjects ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Active Projects"
              value={stats?.totalProjects || 0}
              description="Total sewer analysis projects"
              icon={FolderOpen}
            />
            <StatCard
              title="Running Simulations"
              value={stats?.activeSimulations || 0}
              description="SWMM5 simulations in progress"
              icon={Play}
              trend="up"
              trendValue="+2 today"
            />
            <StatCard
              title="SSO Events"
              value={stats?.totalSSOEvents || 0}
              description="Overflow events recorded"
              icon={AlertTriangle}
              trend="down"
              trendValue="-15%"
            />
            <StatCard
              title="Average RDII"
              value={`${stats?.averageRDII || 0}%`}
              description="System-wide R value"
              icon={Activity}
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
