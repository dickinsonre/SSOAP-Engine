import { useState, useEffect, useCallback } from "react";
import {
  Upload,
  ShieldCheck,
  Waves,
  Activity,
  CloudRain,
  SlidersHorizontal,
  GitCompare,
  FileOutput,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface TutorialStep {
  title: string;
  description: string;
  icon: typeof Upload;
  tabValue?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "Welcome to RDII Studio",
    description:
      "RDII Studio guides you through a complete Rainfall-Derived Inflow & Infiltration calibration workflow. Follow the tabs from left to right to import data, analyze it, calibrate parameters, and export results.",
    icon: Sparkles,
  },
  {
    title: "Step 1: Data Import",
    description:
      "Start by importing your flow monitoring and rainfall data. You can upload CSV files or load the built-in sample dataset to explore the tool. Supported formats include CSV, DAT, and TXT.",
    icon: Upload,
    tabValue: "data",
  },
  {
    title: "Step 2: QA/QC, DWF & RDII",
    description:
      "Run quality checks to identify gaps, outliers, and missing data. Then separate Dry Weather Flow (DWF) and Groundwater Infiltration (GWI) from total flow to isolate the RDII signal.",
    icon: ShieldCheck,
    tabValue: "qaqc",
  },
  {
    title: "Step 3: Events & Calibrate",
    description:
      "Detect storm events from rainfall data, then calibrate the RTK unit hydrograph parameters (R, T, K for three triangles) using a genetic algorithm optimizer to match observed RDII.",
    icon: SlidersHorizontal,
    tabValue: "calibrate",
  },
  {
    title: "Step 4: Compare & Analyze",
    description:
      "Compare calibration solutions side-by-side using goodness-of-fit metrics like NSE, RMSE, and volume error. Select the best-fit parameter set for your model.",
    icon: GitCompare,
    tabValue: "compare",
  },
  {
    title: "Step 5: Export Results",
    description:
      "Export your calibrated RTK parameters and simulated hydrographs. Generate reports and download results in formats compatible with hydraulic modeling software.",
    icon: FileOutput,
    tabValue: "export",
  },
];

const STORAGE_KEY = "rdii-studio-tutorial-seen";

interface InteractiveTutorialProps {
  open: boolean;
  onClose: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export function InteractiveTutorial({ open, onClose, onNavigateToTab }: InteractiveTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (open) {
      setCurrentStep(0);
    }
  }, [open]);

  const handleNext = useCallback(() => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleFinish();
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const handleFinish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    onClose();
  }, [onClose]);

  const handleGoToTab = useCallback(() => {
    const step = tutorialSteps[currentStep];
    if (step.tabValue && onNavigateToTab) {
      onNavigateToTab(step.tabValue);
    }
    handleFinish();
  }, [currentStep, onNavigateToTab, handleFinish]);

  if (!open) return null;

  const step = tutorialSteps[currentStep];
  const StepIcon = step.icon;
  const isLast = currentStep === tutorialSteps.length - 1;
  const progressPercent = ((currentStep + 1) / tutorialSteps.length) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="tutorial-overlay"
    >
      <Card className="w-full max-w-lg mx-4 shadow-lg" data-testid="tutorial-card">
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
              <StepIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg" data-testid="tutorial-step-title">
                {step.title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs" data-testid="tutorial-step-badge">
                  {currentStep + 1} of {tutorialSteps.length}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleFinish}
            data-testid="button-tutorial-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="tutorial-step-description">
            {step.description}
          </p>
          <Progress value={progressPercent} className="h-1.5" data-testid="tutorial-progress" />
          <div className="flex justify-center gap-1.5">
            {tutorialSteps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full border-0 cursor-pointer transition-colors ${
                  i === currentStep ? "bg-primary" : "bg-muted-foreground/30"
                }`}
                data-testid={`tutorial-dot-${i}`}
              />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2 pt-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentStep === 0}
            data-testid="button-tutorial-prev"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {step.tabValue && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoToTab}
                data-testid="button-tutorial-go-to-tab"
              >
                Go to {step.title.replace(/Step \d+: /, "")}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              data-testid="button-tutorial-next"
            >
              {isLast ? "Get Started" : "Next"}
              {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export function useTutorialState() {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setShowTutorial(true);
    }
  }, []);

  const openTutorial = useCallback(() => {
    setShowTutorial(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  return { showTutorial, openTutorial, closeTutorial };
}
