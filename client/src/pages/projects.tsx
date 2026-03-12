import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Search,
  FolderOpen,
  MoreHorizontal,
  Trash2,
  Edit,
  MapPin,
  Calendar,
  Upload,
  CloudDownload,
  FileText,
  Check,
  ChevronRight,
  ChevronLeft,
  Droplets,
  CloudRain,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Project, InsertProject } from "@shared/schema";
import { insertProjectSchema } from "@shared/schema";
import { cn } from "@/lib/utils";
import { ReportGeneratorDialog } from "@/components/report-generator";

const WIZARD_STEPS = [
  { number: 1, label: "Project Info" },
  { number: 2, label: "Import Model" },
  { number: 3, label: "Monitoring Data" },
  { number: 4, label: "Review & Create" },
];

const REGULATORY_DRIVERS = ["CMOM", "Consent Decree", "CIP", "Capital Planning", "Other"] as const;

type ModelImportChoice = "upload-swmm" | "import-icm" | "from-scratch" | null;

interface WizardData {
  clientName: string;
  regulatoryDriver: string;
  modelImportChoice: ModelImportChoice;
  swmmFile: File | null;
  flowMonitoringFile: File | null;
  rainfallFile: File | null;
  monitoringStartDate: string;
  monitoringEndDate: string;
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between mb-6" data-testid="wizard-step-indicator">
      {WIZARD_STEPS.map((step, index) => (
        <div key={step.number} className="flex items-center flex-1">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                currentStep === step.number
                  ? "bg-primary text-primary-foreground"
                  : currentStep > step.number
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              )}
              data-testid={`wizard-step-${step.number}`}
            >
              {currentStep > step.number ? <Check className="h-4 w-4" /> : step.number}
            </div>
            <span
              className={cn(
                "text-xs whitespace-nowrap",
                currentStep === step.number
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
          {index < WIZARD_STEPS.length - 1 && (
            <div
              className={cn(
                "h-px flex-1 mx-2 mt-[-1.25rem]",
                currentStep > step.number ? "bg-primary/40" : "bg-muted"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Step1ProjectInfo({
  form,
  wizardData,
  setWizardData,
}: {
  form: ReturnType<typeof useForm<InsertProject>>;
  wizardData: WizardData;
  setWizardData: React.Dispatch<React.SetStateAction<WizardData>>;
}) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Project Name</FormLabel>
            <FormControl>
              <Input
                placeholder="Downtown Sewer Analysis"
                {...field}
                data-testid="input-project-name"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Brief description of the project scope and objectives..."
                className="resize-none"
                {...field}
                data-testid="input-project-description"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Client / Utility Name</label>
          <Input
            placeholder="City of Springfield"
            value={wizardData.clientName}
            onChange={(e) => setWizardData((prev) => ({ ...prev, clientName: e.target.value }))}
            data-testid="input-client-name"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Regulatory Driver</label>
          <Select
            value={wizardData.regulatoryDriver}
            onValueChange={(val) => setWizardData((prev) => ({ ...prev, regulatoryDriver: val }))}
          >
            <SelectTrigger data-testid="select-regulatory-driver">
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent>
              {REGULATORY_DRIVERS.map((driver) => (
                <SelectItem key={driver} value={driver} data-testid={`select-item-${driver}`}>
                  {driver}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function Step2ImportModel({
  wizardData,
  setWizardData,
}: {
  wizardData: WizardData;
  setWizardData: React.Dispatch<React.SetStateAction<WizardData>>;
}) {
  const options: {
    id: ModelImportChoice;
    icon: typeof Upload;
    title: string;
    description: string;
  }[] = [
    {
      id: "upload-swmm",
      icon: Upload,
      title: "Upload SWMM5 .inp File",
      description: "Import an existing SWMM5 model input file",
    },
    {
      id: "import-icm",
      icon: CloudDownload,
      title: "Import from ICM",
      description: "Connect and import from InfoWorks ICM",
    },
    {
      id: "from-scratch",
      icon: FileText,
      title: "Start from Scratch",
      description: "Create a new project without importing a model",
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose how you'd like to set up your hydraulic model.
      </p>
      <div className="grid gap-3">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = wizardData.modelImportChoice === option.id;
          return (
            <Card
              key={option.id}
              className={cn(
                "cursor-pointer transition-colors",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "hover-elevate"
              )}
              onClick={() =>
                setWizardData((prev) => ({
                  ...prev,
                  modelImportChoice: option.id,
                  swmmFile: option.id !== "upload-swmm" ? null : prev.swmmFile,
                }))
              }
              data-testid={`card-model-${option.id}`}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                    isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{option.title}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
                {isSelected && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {wizardData.modelImportChoice === "upload-swmm" && (
        <div className="space-y-2 pt-2">
          <label className="text-sm font-medium">Select SWMM5 .inp file</label>
          <Input
            type="file"
            accept=".inp"
            onChange={(e) =>
              setWizardData((prev) => ({
                ...prev,
                swmmFile: e.target.files?.[0] || null,
              }))
            }
            data-testid="input-swmm-file"
          />
          {wizardData.swmmFile && (
            <p className="text-xs text-muted-foreground" data-testid="text-swmm-filename">
              Selected: {wizardData.swmmFile.name}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Step3MonitoringData({
  wizardData,
  setWizardData,
}: {
  wizardData: WizardData;
  setWizardData: React.Dispatch<React.SetStateAction<WizardData>>;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Optionally import flow monitoring and rainfall data for your project.
      </p>
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Droplets className="h-4 w-4 text-muted-foreground" />
          Flow Monitoring CSV
        </label>
        <Input
          type="file"
          accept=".csv"
          onChange={(e) =>
            setWizardData((prev) => ({
              ...prev,
              flowMonitoringFile: e.target.files?.[0] || null,
            }))
          }
          data-testid="input-flow-monitoring-file"
        />
        {wizardData.flowMonitoringFile && (
          <p className="text-xs text-muted-foreground" data-testid="text-flow-filename">
            Selected: {wizardData.flowMonitoringFile.name}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <CloudRain className="h-4 w-4 text-muted-foreground" />
          Rainfall Data
        </label>
        <Input
          type="file"
          accept=".csv"
          onChange={(e) =>
            setWizardData((prev) => ({
              ...prev,
              rainfallFile: e.target.files?.[0] || null,
            }))
          }
          data-testid="input-rainfall-file"
        />
        {wizardData.rainfallFile && (
          <p className="text-xs text-muted-foreground" data-testid="text-rainfall-filename">
            Selected: {wizardData.rainfallFile.name}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Monitoring Start Date</label>
          <Input
            type="date"
            value={wizardData.monitoringStartDate}
            onChange={(e) =>
              setWizardData((prev) => ({ ...prev, monitoringStartDate: e.target.value }))
            }
            data-testid="input-monitoring-start-date"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Monitoring End Date</label>
          <Input
            type="date"
            value={wizardData.monitoringEndDate}
            onChange={(e) =>
              setWizardData((prev) => ({ ...prev, monitoringEndDate: e.target.value }))
            }
            data-testid="input-monitoring-end-date"
          />
        </div>
      </div>
    </div>
  );
}

function Step4Review({
  form,
  wizardData,
}: {
  form: ReturnType<typeof useForm<InsertProject>>;
  wizardData: WizardData;
}) {
  const values = form.getValues();
  const modelLabels: Record<string, string> = {
    "upload-swmm": "Upload SWMM5 .inp File",
    "import-icm": "Import from ICM",
    "from-scratch": "Start from Scratch",
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review your project details before creating.
      </p>
      <div className="space-y-3">
        <Card>
          <CardContent className="py-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Project Info
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium" data-testid="review-project-name">
                {values.name || "—"}
              </span>
              <span className="text-muted-foreground">Description</span>
              <span className="font-medium line-clamp-2" data-testid="review-project-description">
                {values.description || "—"}
              </span>
              {wizardData.clientName && (
                <>
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium" data-testid="review-client-name">
                    {wizardData.clientName}
                  </span>
                </>
              )}
              {wizardData.regulatoryDriver && (
                <>
                  <span className="text-muted-foreground">Regulatory Driver</span>
                  <span className="font-medium" data-testid="review-regulatory-driver">
                    {wizardData.regulatoryDriver}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Model Import
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium" data-testid="review-model-choice">
                {wizardData.modelImportChoice
                  ? modelLabels[wizardData.modelImportChoice]
                  : "Not selected"}
              </span>
              {wizardData.swmmFile && (
                <>
                  <span className="text-muted-foreground">File</span>
                  <span className="font-medium" data-testid="review-swmm-file">
                    {wizardData.swmmFile.name}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Monitoring Data
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">Flow Data</span>
              <span className="font-medium" data-testid="review-flow-file">
                {wizardData.flowMonitoringFile?.name || "None"}
              </span>
              <span className="text-muted-foreground">Rainfall Data</span>
              <span className="font-medium" data-testid="review-rainfall-file">
                {wizardData.rainfallFile?.name || "None"}
              </span>
              {(wizardData.monitoringStartDate || wizardData.monitoringEndDate) && (
                <>
                  <span className="text-muted-foreground">Period</span>
                  <span className="font-medium" data-testid="review-monitoring-period">
                    {wizardData.monitoringStartDate || "—"} to{" "}
                    {wizardData.monitoringEndDate || "—"}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    clientName: "",
    regulatoryDriver: "",
    modelImportChoice: null,
    swmmFile: null,
    flowMonitoringFile: null,
    rainfallFile: null,
    monitoringStartDate: "",
    monitoringEndDate: "",
  });

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      sewershedCount: 0,
      totalArea: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      return apiRequest("POST", "/api/projects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Project created",
        description: "Your new project has been created successfully.",
      });
      resetWizard();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetWizard = () => {
    form.reset();
    setCurrentStep(1);
    setWizardData({
      clientName: "",
      regulatoryDriver: "",
      modelImportChoice: null,
      swmmFile: null,
      flowMonitoringFile: null,
      rainfallFile: null,
      monitoringStartDate: "",
      monitoringEndDate: "",
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetWizard();
    }
    onOpenChange(newOpen);
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      const valid = await form.trigger(["name", "description"]);
      if (!valid) return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleCreate = () => {
    const values = form.getValues();
    createMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle data-testid="text-wizard-title">Create New Project</DialogTitle>
          <DialogDescription>
            Set up a new sanitary sewer analysis project step by step.
          </DialogDescription>
        </DialogHeader>
        <StepIndicator currentStep={currentStep} />
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (currentStep === 4) {
                handleCreate();
              }
            }}
          >
            <div className="min-h-[280px]">
              {currentStep === 1 && (
                <Step1ProjectInfo
                  form={form}
                  wizardData={wizardData}
                  setWizardData={setWizardData}
                />
              )}
              {currentStep === 2 && (
                <Step2ImportModel wizardData={wizardData} setWizardData={setWizardData} />
              )}
              {currentStep === 3 && (
                <Step3MonitoringData wizardData={wizardData} setWizardData={setWizardData} />
              )}
              {currentStep === 4 && <Step4Review form={form} wizardData={wizardData} />}
            </div>
            <DialogFooter className="mt-6 gap-2">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  data-testid="button-wizard-back"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
              )}
              {currentStep === 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
              )}
              <div className="flex-1" />
              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  data-testid="button-wizard-next"
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-create"
                >
                  {createMutation.isPending ? "Creating..." : "Create Project"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({ project, onDelete }: { project: Project; onDelete: (id: string) => void }) {
  const statusColors = {
    active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    completed: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    archived: "bg-muted text-muted-foreground border-muted",
  };

  return (
    <Card className="hover-elevate group" data-testid={`card-project-${project.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{project.name}</CardTitle>
              <CardDescription className="text-xs line-clamp-1 mt-0.5">
                {project.description}
              </CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-project-menu-${project.id}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem data-testid={`menu-item-edit-${project.id}`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Project
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(project.id)}
                data-testid={`menu-item-delete-${project.id}`}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Badge className={statusColors[project.status]}>{project.status}</Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {project.sewershedCount} sewersheds
          </div>
          <div className="text-xs text-muted-foreground">
            {project.totalArea.toLocaleString()} acres
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Updated {new Date(project.updatedAt).toLocaleDateString()}
          </div>
          <ReportGeneratorDialog project={project} />
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Projects Yet</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Create your first sewer analysis project to start running SWMM5 simulations
          and analyzing RDII parameters.
        </p>
        <Button onClick={onCreateClick} data-testid="button-create-first-project">
          <Plus className="mr-2 h-4 w-4" />
          Create Your First Project
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Project deleted",
        description: "The project has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredProjects = projects?.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-projects-title">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage your sanitary sewer analysis projects
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-project">
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {projects && projects.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-projects"
          />
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : !projects || projects.length === 0 ? (
        <EmptyState onCreateClick={() => setCreateDialogOpen(true)} />
      ) : filteredProjects && filteredProjects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-8 w-8 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              No projects found matching "{searchQuery}"
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects?.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      <CreateProjectDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}