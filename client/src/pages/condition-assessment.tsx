import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ClipboardCheck,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Project, ConditionAssessment, RDIIParameters } from "@shared/schema";

const chartConfig = {
  preRehab: { label: "Pre-Rehabilitation", color: "hsl(var(--destructive))" },
  postRehab: { label: "Post-Rehabilitation", color: "hsl(var(--chart-2))" },
};

function PriorityBadge({ priority }: { priority: ConditionAssessment["priority"] }) {
  const colors = {
    high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    low: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  };

  return (
    <Badge className={colors[priority]}>
      {priority === "high" && <AlertCircle className="mr-1 h-3 w-3" />}
      {priority}
    </Badge>
  );
}

function StatusBadge({ status }: { status: ConditionAssessment["status"] }) {
  const colors = {
    pending: "bg-muted text-muted-foreground",
    "in-progress": "bg-primary/10 text-primary",
    completed: "bg-green-500/10 text-green-600 dark:text-green-400",
  };

  const icons = {
    pending: <Clock className="mr-1 h-3 w-3" />,
    "in-progress": <BarChart3 className="mr-1 h-3 w-3" />,
    completed: <CheckCircle className="mr-1 h-3 w-3" />,
  };

  return (
    <Badge className={colors[status]}>
      {icons[status]}
      {status}
    </Badge>
  );
}

function AssessmentCard({
  assessment,
  isSelected,
  onSelect,
}: {
  assessment: ConditionAssessment;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-colors ${
        isSelected ? "ring-2 ring-primary" : "hover-elevate"
      }`}
      onClick={onSelect}
      data-testid={`card-assessment-${assessment.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h4 className="text-sm font-medium">{assessment.sewershedName}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(assessment.assessmentDate).toLocaleDateString()}
            </p>
          </div>
          <PriorityBadge priority={assessment.priority} />
        </div>
        <div className="flex items-center justify-between">
          <StatusBadge status={assessment.status} />
          {assessment.rdiiReduction > 0 && (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <TrendingDown className="h-3 w-3" />
              {assessment.rdiiReduction.toFixed(1)}% reduction
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonChart({ assessment }: { assessment: ConditionAssessment }) {
  if (!assessment.preRehabRDII || !assessment.postRehabRDII) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px]">
        <p className="text-sm text-muted-foreground">
          {!assessment.preRehabRDII ? "Pre-rehabilitation data not available" : "Post-rehabilitation data not available"}
        </p>
      </div>
    );
  }

  const data = [
    {
      name: "R1 (Fast)",
      preRehab: assessment.preRehabRDII.r1 * 100,
      postRehab: assessment.postRehabRDII.r1 * 100,
    },
    {
      name: "R2 (Medium)",
      preRehab: assessment.preRehabRDII.r2 * 100,
      postRehab: assessment.postRehabRDII.r2 * 100,
    },
    {
      name: "R3 (Slow)",
      preRehab: assessment.preRehabRDII.r3 * 100,
      postRehab: assessment.postRehabRDII.r3 * 100,
    },
    {
      name: "Total R",
      preRehab: assessment.preRehabRDII.totalR * 100,
      postRehab: assessment.postRehabRDII.totalR * 100,
    },
  ];

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="name" className="text-xs" />
          <YAxis 
            className="text-xs"
            label={{ value: 'R Value (%)', angle: -90, position: 'insideLeft' }}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend />
          <Bar dataKey="preRehab" fill="hsl(var(--destructive))" name="Pre-Rehab" radius={[4, 4, 0, 0]} />
          <Bar dataKey="postRehab" fill="hsl(var(--chart-2))" name="Post-Rehab" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function AssessmentDetails({ 
  assessment,
  onUpdateNotes,
  isSaving,
}: { 
  assessment: ConditionAssessment;
  onUpdateNotes: (notes: string) => void;
  isSaving: boolean;
}) {
  const [notes, setNotes] = useState(assessment.notes);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{assessment.sewershedName}</h3>
          <p className="text-sm text-muted-foreground">
            Assessment Date: {new Date(assessment.assessmentDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PriorityBadge priority={assessment.priority} />
          <StatusBadge status={assessment.status} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pre-Rehab Total R</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold font-mono text-destructive">
              {assessment.preRehabRDII ? (assessment.preRehabRDII.totalR * 100).toFixed(2) : "N/A"}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Post-Rehab Total R</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold font-mono text-chart-2">
              {assessment.postRehabRDII ? (assessment.postRehabRDII.totalR * 100).toFixed(2) : "N/A"}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">RDII Reduction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-semibold font-mono text-green-600 dark:text-green-400">
                {assessment.rdiiReduction.toFixed(1)}%
              </div>
              {assessment.rdiiReduction > 0 && <TrendingDown className="h-5 w-5 text-green-600" />}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pre vs Post Rehabilitation Comparison</CardTitle>
          <CardDescription>RTK parameter changes after sewer rehabilitation</CardDescription>
        </CardHeader>
        <CardContent>
          <ComparisonChart assessment={assessment} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assessment Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about rehabilitation work, findings, or recommendations..."
            className="min-h-[100px]"
            data-testid="textarea-notes"
          />
          <Button 
            onClick={() => onUpdateNotes(notes)} 
            disabled={isSaving || notes === assessment.notes}
            data-testid="button-save-notes"
          >
            {isSaving ? "Saving..." : "Save Notes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTable({ assessments }: { assessments: ConditionAssessment[] }) {
  const sortedAssessments = [...assessments].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <ScrollArea className="h-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sewershed</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Pre-Rehab R</TableHead>
            <TableHead className="text-right">Post-Rehab R</TableHead>
            <TableHead className="text-right">Reduction</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAssessments.map((assessment) => (
            <TableRow key={assessment.id} data-testid={`row-assessment-${assessment.id}`}>
              <TableCell className="font-medium">{assessment.sewershedName}</TableCell>
              <TableCell>
                <PriorityBadge priority={assessment.priority} />
              </TableCell>
              <TableCell>
                <StatusBadge status={assessment.status} />
              </TableCell>
              <TableCell className="text-right font-mono">
                {assessment.preRehabRDII ? (assessment.preRehabRDII.totalR * 100).toFixed(2) + "%" : "-"}
              </TableCell>
              <TableCell className="text-right font-mono">
                {assessment.postRehabRDII ? (assessment.postRehabRDII.totalR * 100).toFixed(2) + "%" : "-"}
              </TableCell>
              <TableCell className="text-right">
                {assessment.rdiiReduction > 0 ? (
                  <span className="flex items-center justify-end gap-1 text-green-600 dark:text-green-400 font-mono">
                    <TrendingDown className="h-3 w-3" />
                    {assessment.rdiiReduction.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

export default function ConditionAssessmentPage() {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedAssessment, setSelectedAssessment] = useState<ConditionAssessment | null>(null);
  const { toast } = useToast();

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: assessments, isLoading } = useQuery<ConditionAssessment[]>({
    queryKey: [`/api/condition-assessments?projectId=${selectedProject}`],
    enabled: !!selectedProject,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return apiRequest("PATCH", `/api/condition-assessments/${id}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/condition-assessments?projectId=${selectedProject}`] });
      toast({ title: "Notes saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save notes.", variant: "destructive" });
    },
  });

  const priorityCounts = assessments?.reduce(
    (acc, a) => {
      acc[a.priority]++;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  ) || { high: 0, medium: 0, low: 0 };

  const completedCount = assessments?.filter(a => a.status === "completed").length || 0;
  const totalCount = assessments?.length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-assessment-title">
            Condition Assessment
          </h1>
          <p className="text-sm text-muted-foreground">
            Track sewer rehabilitation effectiveness and prioritize improvements
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
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Select a project to view condition assessments
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
      ) : !assessments || assessments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Assessments</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Create condition assessments by analyzing RDII parameters before and after rehabilitation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">High Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-red-600 dark:text-red-400">
                  {priorityCounts.high}
                </div>
                <p className="text-xs text-muted-foreground">Sewersheds need attention</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Medium Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-yellow-600 dark:text-yellow-400">
                  {priorityCounts.medium}
                </div>
                <p className="text-xs text-muted-foreground">Scheduled for review</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Low Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-green-600 dark:text-green-400">
                  {priorityCounts.low}
                </div>
                <p className="text-xs text-muted-foreground">Performing well</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Completion Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold mb-2">
                  {totalCount > 0 ? ((completedCount / totalCount) * 100).toFixed(0) : 0}%
                </div>
                <Progress value={totalCount > 0 ? (completedCount / totalCount) * 100 : 0} className="h-1.5" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Assessments</h3>
              {assessments.map((assessment) => (
                <AssessmentCard
                  key={assessment.id}
                  assessment={assessment}
                  isSelected={selectedAssessment?.id === assessment.id}
                  onSelect={() => setSelectedAssessment(assessment)}
                />
              ))}
            </div>

            <div className="lg:col-span-2">
              {selectedAssessment ? (
                <AssessmentDetails
                  assessment={selectedAssessment}
                  onUpdateNotes={(notes) =>
                    updateMutation.mutate({ id: selectedAssessment.id, notes })
                  }
                  isSaving={updateMutation.isPending}
                />
              ) : (
                <Card className="h-full">
                  <CardContent className="flex flex-col items-center justify-center h-full min-h-[400px]">
                    <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Select an assessment to view details
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
