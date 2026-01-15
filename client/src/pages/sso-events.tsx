import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Plus,
  MapPin,
  Clock,
  Droplets,
  Filter,
  Download,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Project, SSOEvent, InsertSSOEvent } from "@shared/schema";
import { insertSSOEventSchema } from "@shared/schema";

const chartConfig = {
  rainfall: { label: "Rainfall", color: "hsl(var(--chart-1))" },
  blockage: { label: "Blockage", color: "hsl(var(--chart-2))" },
  capacity: { label: "Capacity", color: "hsl(var(--chart-3))" },
  pump_failure: { label: "Pump Failure", color: "hsl(var(--chart-4))" },
  other: { label: "Other", color: "hsl(var(--chart-5))" },
};

const severityColors = {
  minor: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  moderate: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  major: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const causeColors = {
  rainfall: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  blockage: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  capacity: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  pump_failure: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  other: "bg-muted text-muted-foreground",
};

function SSOEventCard({ event }: { event: SSOEvent }) {
  return (
    <Card className="hover-elevate" data-testid={`card-event-${event.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <h4 className="text-sm font-medium">{event.location}</h4>
              <p className="text-xs text-muted-foreground">
                {new Date(event.startTime).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge className={severityColors[event.severity]}>{event.severity}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Volume</span>
            <p className="font-medium font-mono">{event.volume.toLocaleString()} gal</p>
          </div>
          <div>
            <span className="text-muted-foreground">Duration</span>
            <p className="font-medium font-mono">{event.duration} min</p>
          </div>
          <div>
            <span className="text-muted-foreground">Cause</span>
            <Badge className={causeColors[event.cause]} variant="secondary">
              {event.cause.replace("_", " ")}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateEventDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const { toast } = useToast();

  const form = useForm<InsertSSOEvent>({
    resolver: zodResolver(insertSSOEventSchema),
    defaultValues: {
      projectId,
      location: "",
      startTime: "",
      endTime: "",
      volume: 0,
      cause: "rainfall",
      severity: "minor",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertSSOEvent) => {
      return apiRequest("POST", "/api/sso-events", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sso-events?projectId=${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/sso-events/recent"] });
      toast({ title: "SSO event recorded" });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record event.", variant: "destructive" });
    },
  });

  const onSubmit = (data: InsertSSOEvent) => {
    createMutation.mutate({ ...data, projectId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Record SSO Event</DialogTitle>
          <DialogDescription>
            Document a sanitary sewer overflow incident for analysis.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Manhole ID or address" {...field} data-testid="input-location" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="input-start-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="input-end-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="volume"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Volume (gallons)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      data-testid="input-volume"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cause"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cause</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-cause">
                          <SelectValue placeholder="Select cause" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="rainfall">Rainfall</SelectItem>
                        <SelectItem value="blockage">Blockage</SelectItem>
                        <SelectItem value="capacity">Capacity</SelectItem>
                        <SelectItem value="pump_failure">Pump Failure</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-severity">
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="minor">Minor</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="major">Major</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                {createMutation.isPending ? "Recording..." : "Record Event"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CauseDistributionChart({ events }: { events: SSOEvent[] }) {
  const causeData = events.reduce((acc, event) => {
    acc[event.cause] = (acc[event.cause] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(causeData).map(([name, value]) => ({
    name: name.replace("_", " "),
    value,
  }));

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function EventsTable({ events }: { events: SSOEvent[] }) {
  return (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Location</TableHead>
            <TableHead>Date/Time</TableHead>
            <TableHead className="text-right">Volume (gal)</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead>Cause</TableHead>
            <TableHead>Severity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
              <TableCell className="font-medium">{event.location}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(event.startTime).toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono">
                {event.volume.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono">{event.duration} min</TableCell>
              <TableCell>
                <Badge className={causeColors[event.cause]} variant="secondary">
                  {event.cause.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={severityColors[event.severity]}>{event.severity}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

export default function SSOEventsPage() {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: events, isLoading } = useQuery<SSOEvent[]>({
    queryKey: [`/api/sso-events?projectId=${selectedProject}`],
    enabled: !!selectedProject,
  });

  const totalVolume = events?.reduce((sum, e) => sum + e.volume, 0) || 0;
  const majorEvents = events?.filter(e => e.severity === "major").length || 0;
  const avgDuration = events && events.length > 0
    ? events.reduce((sum, e) => sum + e.duration, 0) / events.length
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-events-title">SSO Events</h1>
          <p className="text-sm text-muted-foreground">
            Track and analyze sanitary sewer overflow incidents
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
          <Button
            onClick={() => setCreateDialogOpen(true)}
            disabled={!selectedProject}
            data-testid="button-add-event"
          >
            <Plus className="mr-2 h-4 w-4" />
            Record Event
          </Button>
        </div>
      </div>

      {!selectedProject ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Select a project to view SSO events
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
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
      ) : !events || events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No SSO Events</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              No overflow events have been recorded for this project.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-first-event">
              <Plus className="mr-2 h-4 w-4" />
              Record First Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{events.length}</div>
                <p className="text-xs text-muted-foreground">SSO incidents recorded</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold font-mono">
                  {totalVolume.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Gallons released</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Major Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-destructive">{majorEvents}</div>
                <p className="text-xs text-muted-foreground">High severity incidents</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Avg Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold font-mono">{avgDuration.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">Minutes per event</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cause Distribution</CardTitle>
                <CardDescription>SSO events by root cause</CardDescription>
              </CardHeader>
              <CardContent>
                <CauseDistributionChart events={events} />
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Event Log</CardTitle>
                    <CardDescription>Complete list of SSO incidents</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" data-testid="button-export">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  <EventsTable events={events} />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {selectedProject && (
        <CreateEventDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          projectId={selectedProject}
        />
      )}
    </div>
  );
}
