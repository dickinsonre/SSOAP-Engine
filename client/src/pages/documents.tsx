import {
  FileText,
  ExternalLink,
  Download,
  BookOpen,
  Wrench,
  Droplets,
  BarChart3,
  Settings,
  Gauge,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface DocumentItem {
  title: string;
  description: string;
  url: string;
  type: "pdf" | "link";
  size?: string;
  publication?: string;
  year?: string;
}

const epaDocuments: DocumentItem[] = [
  {
    title: "Computer Tools for Sanitary Sewer System Capacity Analysis and Planning",
    description: "Main technical report documenting SSOAP toolbox capabilities, methods, and software architecture. Comprehensive guide covering SWMM5 integration, RDII analysis, and capacity planning.",
    url: "https://nepis.epa.gov/Exe/ZyPDF.cgi?Dockey=P1008BBP.PDF",
    type: "pdf",
    size: "3.7 MB",
    publication: "EPA/600/R-07/111",
    year: "2007",
  },
  {
    title: "SSOAP Toolbox Enhancements and Case Study",
    description: "Documents version 2.0 enhancements including improved RDII analysis, hydrograph generation, and practical case study demonstrating real-world application.",
    url: "https://cfpub.epa.gov/si/si_public_file_download.cfm?p_download_id=521899&Lab=NRMRL",
    type: "pdf",
    size: "2.6 MB",
    publication: "EPA/600/R-12/690",
    year: "2012",
  },
  {
    title: "Review of Sewer Design Criteria and RDII Predictions",
    description: "Overview of sanitary sewer hydrology with focus on unit hydrograph methods, RTK parameter estimation, and RDII prediction techniques.",
    url: "https://cfpub.epa.gov/si/si_public_file_download.cfm?p_download_id=470908&Lab=NRMRL",
    type: "pdf",
    size: "186 KB",
    publication: "EPA/600/R-08/010",
    year: "2008",
  },
  {
    title: "SSOAP Toolbox 2.0.0 Release Notes",
    description: "Technical release notes detailing version 2.0.0 enhancements, bug fixes, and modifications to the SSOAP software package.",
    url: "https://www.epa.gov/sites/default/files/2014-07/documents/ssoap-release-notes2.pdf",
    type: "pdf",
    year: "2014",
  },
];

interface AppDocSection {
  title: string;
  icon: React.ElementType;
  content: string[];
}

const appDocumentation: AppDocSection[] = [
  {
    title: "Getting Started",
    icon: BookOpen,
    content: [
      "Welcome to SSOAP Toolbox - a web-based sanitary sewer overflow analysis and planning application.",
      "To begin, create a new project from the Dashboard or Projects page. Each project represents a sewershed or collection system you want to analyze.",
      "Import your SWMM5 input files (.inp) directly from the Dashboard using the Import SWMM Model button, or navigate to the Simulation page.",
    ],
  },
  {
    title: "SWMM5 Simulation",
    icon: Gauge,
    content: [
      "The Simulation page allows you to upload SWMM5 input files and run hydraulic simulations using the WebAssembly-based SWMM5 engine.",
      "Supported file formats: .inp (SWMM input files) and .rpt (report files).",
      "After running a simulation, view detailed results including node depths, link flows, and system performance metrics.",
    ],
  },
  {
    title: "RDII Analysis",
    icon: Droplets,
    content: [
      "RDII (Rainfall-Derived Infiltration and Inflow) analysis uses the RTK method to quantify wet weather flows.",
      "The RTK method uses three unit hydrographs (R1-T1-K1, R2-T2-K2, R3-T3-K3) to represent fast, medium, and slow inflow responses.",
      "R values represent the fraction of rainfall that becomes RDII. T values are time-to-peak in hours. K values are recession constants.",
      "Use the interactive sliders to adjust parameters and view real-time hydrograph updates.",
    ],
  },
  {
    title: "Hydrograph Visualization",
    icon: BarChart3,
    content: [
      "The Hydrograph page displays flow data over time with rainfall overlay.",
      "Compare multiple hydrographs simultaneously by selecting different sewersheds.",
      "Export hydrograph data for use in reports or further analysis.",
    ],
  },
  {
    title: "Condition Assessment",
    icon: Activity,
    content: [
      "Track pipe condition before and after rehabilitation projects.",
      "Compare pre-rehabilitation and post-rehabilitation metrics including PACP ratings, structural defects, and I/I levels.",
      "Document improvement percentages and rehabilitation effectiveness.",
    ],
  },
  {
    title: "SSO Event Tracking",
    icon: Wrench,
    content: [
      "Log and track sanitary sewer overflow events with location, duration, and volume data.",
      "Classify events by severity (minor, moderate, major) and cause (rainfall, blockage, pump failure).",
      "View statistics and trends to identify problem areas in your collection system.",
    ],
  },
  {
    title: "Settings & Preferences",
    icon: Settings,
    content: [
      "Customize your experience with light, dark, or system theme options.",
      "Access application information and version details.",
      "Theme preferences are saved locally and persist between sessions.",
    ],
  },
];

function EPADocumentCard({ doc }: { doc: DocumentItem }) {
  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-500/10 shrink-0">
              <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base leading-tight">{doc.title}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {doc.publication && (
                  <Badge variant="outline" className="text-xs">
                    {doc.publication}
                  </Badge>
                )}
                {doc.year && (
                  <span className="text-xs text-muted-foreground">{doc.year}</span>
                )}
                {doc.size && (
                  <span className="text-xs text-muted-foreground">{doc.size}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardDescription className="text-sm">{doc.description}</CardDescription>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => window.open(doc.url, "_blank")}
          data-testid={`button-download-${doc.publication?.replace(/\//g, '-') || 'doc'}`}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          View Document
        </Button>
      </CardContent>
    </Card>
  );
}

function AppDocSection({ section }: { section: AppDocSection }) {
  const Icon = section.icon;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold">{section.title}</h3>
      </div>
      <div className="space-y-2 pl-11">
        {section.content.map((paragraph, i) => (
          <p key={i} className="text-sm text-muted-foreground leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-documents-title">
          Documentation
        </h1>
        <p className="text-sm text-muted-foreground">
          EPA SSOAP technical documents and application user guide
        </p>
      </div>

      <Tabs defaultValue="epa" className="space-y-6">
        <TabsList>
          <TabsTrigger value="epa" data-testid="tab-epa-docs">
            EPA Documents
          </TabsTrigger>
          <TabsTrigger value="app" data-testid="tab-app-docs">
            App Documentation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="epa" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                EPA SSOAP Technical Documents
              </CardTitle>
              <CardDescription>
                Official EPA publications and technical reports for the SSOAP Toolbox. These documents provide comprehensive guidance on sanitary sewer analysis methods, RDII quantification, and capacity planning.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {epaDocuments.map((doc) => (
                  <EPADocumentCard key={doc.title} doc={doc} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Resources</CardTitle>
              <CardDescription>
                External links to EPA water research and SWMM documentation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => window.open("https://www.epa.gov/water-research/sanitary-sewer-overflow-analysis-and-planning-ssoap-toolbox", "_blank")}
                data-testid="link-epa-ssoap-page"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                EPA SSOAP Toolbox Official Page
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => window.open("https://www.epa.gov/water-research/storm-water-management-model-swmm", "_blank")}
                data-testid="link-epa-swmm-page"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                EPA SWMM Official Page
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => window.open("https://www.openswmm.org/", "_blank")}
                data-testid="link-openswmm"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                OpenSWMM Community Forum
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="app" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                SSOAP Toolbox Web Application Guide
              </CardTitle>
              <CardDescription>
                Learn how to use the web-based SSOAP Toolbox application for sanitary sewer analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-8">
                  {appDocumentation.map((section, index) => (
                    <div key={section.title}>
                      <AppDocSection section={section} />
                      {index < appDocumentation.length - 1 && (
                        <Separator className="mt-6" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technical Specifications</CardTitle>
              <CardDescription>
                Application architecture and technology stack
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Frontend</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>React with TypeScript</li>
                    <li>Vite build system</li>
                    <li>Tailwind CSS styling</li>
                    <li>shadcn/ui components</li>
                    <li>Recharts visualization</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Backend</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Node.js with Express</li>
                    <li>TypeScript</li>
                    <li>RESTful API</li>
                    <li>File upload with Multer</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Simulation Engine</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>SWMM5 WebAssembly</li>
                    <li>Browser-based execution</li>
                    <li>.inp/.rpt file support</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Design System</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Carbon Design System inspired</li>
                    <li>IBM Plex fonts</li>
                    <li>Dark/Light theme support</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
