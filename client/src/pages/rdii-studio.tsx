import { useState, useMemo } from "react";
import {
  Upload,
  ShieldCheck,
  Waves,
  Activity,
  CloudRain,
  SlidersHorizontal,
  GitCompare,
  LineChart,
  FileOutput,
  BookOpen,
  Check,
  Circle,
  Lock,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CalibrationDataProvider, useCalibrationData } from "@/contexts/CalibrationDataContext";
import { InteractiveTutorial, useTutorialState } from "@/components/rdii-studio/InteractiveTutorial";
import { DataImportTab } from "@/components/rdii-studio/DataImportTab";
import { QAQCTab } from "@/components/rdii-studio/QAQCTab";
import { DWFGWITab } from "@/components/rdii-studio/DWFGWITab";
import { RDIISeriesTab } from "@/components/rdii-studio/RDIISeriesTab";
import { EventsTab } from "@/components/rdii-studio/EventsTab";
import { CalibrateTab } from "@/components/rdii-studio/CalibrateTab";
import { CompareTab } from "@/components/rdii-studio/CompareTab";
import { TimeSeriesTab } from "@/components/rdii-studio/TimeSeriesTab";
import { ExportTab } from "@/components/rdii-studio/ExportTab";
import { DocsTab } from "@/components/rdii-studio/DocsTab";

const tabs = [
  { value: "data", label: "Data Import", icon: Upload },
  { value: "qaqc", label: "QA/QC", icon: ShieldCheck },
  { value: "dwf", label: "DWF & GWI", icon: Waves },
  { value: "rdii", label: "RDII Series", icon: Activity },
  { value: "events", label: "Events", icon: CloudRain },
  { value: "calibrate", label: "Calibrate", icon: SlidersHorizontal },
  { value: "compare", label: "Compare", icon: GitCompare },
  { value: "timeseries", label: "Time Series", icon: LineChart },
  { value: "export", label: "Export", icon: FileOutput },
  { value: "docs", label: "Docs", icon: BookOpen },
];

const stepHints: Record<string, string> = {
  data: "Import flow and rainfall data to begin",
  qaqc: "Run QA/QC checks on your data",
  dwf: "Separate dry weather flow components",
  rdii: "Extract the RDII series from flow data",
  events: "Detect and select storm events",
  calibrate: "Calibrate RTK parameters",
  compare: "Compare and select best solution",
  timeseries: "Review time series results",
  export: "Export calibration results",
  docs: "View documentation",
};

function WorkflowProgressTracker({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const {
    flowData,
    rainfallData,
    qaqcFlowResult,
    dwfResult,
    rdiiSeries,
    detectedEvents,
    optimizationResults,
    selectedSolutionIndex,
  } = useCalibrationData();

  const stepStatus = useMemo(() => {
    const status: Record<string, "complete" | "pending" | "locked"> = {};

    status.data = flowData && rainfallData ? "complete" : "pending";
    status.qaqc = qaqcFlowResult ? "complete" : status.data === "complete" ? "pending" : "locked";
    status.dwf = dwfResult ? "complete" : status.qaqc === "complete" ? "pending" : "locked";
    status.rdii = rdiiSeries ? "complete" : status.dwf === "complete" ? "pending" : "locked";
    status.events = detectedEvents.length > 0 ? "complete" : status.rdii === "complete" ? "pending" : "locked";
    status.calibrate = optimizationResults.length > 0 ? "complete" : status.events === "complete" ? "pending" : "locked";
    status.compare = selectedSolutionIndex >= 0 && optimizationResults.length > 0 ? "complete" : status.calibrate === "complete" ? "pending" : "locked";
    status.timeseries = flowData && dwfResult && rdiiSeries ? "complete" : status.rdii === "complete" ? "pending" : "locked";
    status.export = optimizationResults.length > 0 ? "complete" : status.calibrate === "complete" ? "pending" : "locked";
    status.docs = "complete";

    return status;
  }, [flowData, rainfallData, qaqcFlowResult, dwfResult, rdiiSeries, detectedEvents, optimizationResults, selectedSolutionIndex]);

  const completedCount = Object.values(stepStatus).filter((s) => s === "complete").length;
  const progressPercent = Math.round((completedCount / tabs.length) * 100);

  const nextAction = useMemo(() => {
    for (const tab of tabs) {
      if (stepStatus[tab.value] === "pending") {
        return { tab: tab.value, label: tab.label, hint: stepHints[tab.value] };
      }
    }
    if (completedCount === tabs.length) {
      return { tab: "", label: "All Complete", hint: "Workflow complete — all steps finished" };
    }
    return null;
  }, [stepStatus, completedCount]);

  return (
    <div className="space-y-3" data-testid="workflow-progress-tracker">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" data-testid="text-progress-percent">{progressPercent}% Complete</span>
          <span className="text-xs text-muted-foreground">({completedCount}/{tabs.length} steps)</span>
        </div>
        {nextAction && nextAction.tab && (
          <button
            onClick={() => onTabChange(nextAction.tab)}
            className="flex items-center gap-1.5 text-xs text-primary cursor-pointer bg-transparent border-0 p-0"
            data-testid="button-next-action"
          >
            <ArrowRight className="h-3 w-3" />
            <span>Next: {nextAction.hint}</span>
          </button>
        )}
        {nextAction && !nextAction.tab && (
          <span className="text-xs text-muted-foreground" data-testid="text-workflow-complete">{nextAction.hint}</span>
        )}
      </div>
      <Progress value={progressPercent} className="h-2" data-testid="progress-bar" />
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {tabs.map((tab, index) => {
          const status = stepStatus[tab.value];
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs whitespace-nowrap cursor-pointer border-0 transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : status === "complete"
                    ? "bg-transparent text-muted-foreground"
                    : status === "pending"
                      ? "bg-transparent text-muted-foreground/70"
                      : "bg-transparent text-muted-foreground/40"
              }`}
              data-testid={`step-indicator-${tab.value}`}
            >
              {status === "complete" ? (
                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
              ) : status === "pending" ? (
                <Circle className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Lock className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="hidden md:inline">{tab.label}</span>
              {index < tabs.length - 1 && (
                <span className="text-muted-foreground/30 ml-1 hidden md:inline">/</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RDIIStudioContent() {
  const [activeTab, setActiveTab] = useState("data");
  const { showTutorial, openTutorial, closeTutorial } = useTutorialState();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-rdii-studio-title">RDII Studio</h1>
          <p className="text-sm text-muted-foreground">
            Complete RDII calibration workflow — Import, QA/QC, Separate, Calibrate, Export
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={openTutorial}
          data-testid="button-show-tutorial"
        >
          <HelpCircle className="h-4 w-4 mr-1.5" />
          Show Tutorial
        </Button>
      </div>

      <InteractiveTutorial
        open={showTutorial}
        onClose={closeTutorial}
        onNavigateToTab={setActiveTab}
      />

      <WorkflowProgressTracker activeTab={activeTab} onTabChange={setActiveTab} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10 h-auto gap-1 bg-muted/50 p-1">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex flex-col items-center gap-1 py-2 px-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              data-testid={`tab-${tab.value}`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline truncate">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="data"><DataImportTab onNext={() => setActiveTab("qaqc")} /></TabsContent>
        <TabsContent value="qaqc"><QAQCTab onNext={() => setActiveTab("dwf")} /></TabsContent>
        <TabsContent value="dwf"><DWFGWITab onNext={() => setActiveTab("rdii")} /></TabsContent>
        <TabsContent value="rdii"><RDIISeriesTab onNext={() => setActiveTab("events")} /></TabsContent>
        <TabsContent value="events"><EventsTab onNext={() => setActiveTab("calibrate")} /></TabsContent>
        <TabsContent value="calibrate"><CalibrateTab onNext={() => setActiveTab("compare")} /></TabsContent>
        <TabsContent value="compare"><CompareTab onNext={() => setActiveTab("timeseries")} /></TabsContent>
        <TabsContent value="timeseries"><TimeSeriesTab onNext={() => setActiveTab("export")} /></TabsContent>
        <TabsContent value="export"><ExportTab /></TabsContent>
        <TabsContent value="docs"><DocsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

export default function RDIIStudioPage() {
  return (
    <CalibrationDataProvider>
      <RDIIStudioContent />
    </CalibrationDataProvider>
  );
}
