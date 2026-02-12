import { useState } from "react";
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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalibrationDataProvider } from "@/contexts/CalibrationDataContext";
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

export default function RDIIStudioPage() {
  const [activeTab, setActiveTab] = useState("data");

  return (
    <CalibrationDataProvider>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-rdii-studio-title">RDII Studio</h1>
          <p className="text-sm text-muted-foreground">
            Complete RDII calibration workflow — Import, QA/QC, Separate, Calibrate, Export
          </p>
        </div>

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
    </CalibrationDataProvider>
  );
}
