import { useState } from "react";
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  Info,
  ExternalLink,
  FileText,
  Github,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-settings-title">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure application preferences and view system information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Appearance</CardTitle>
          <CardDescription>Customize how the application looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Theme</Label>
              <RadioGroup
                value={theme}
                onValueChange={(value: "light" | "dark" | "system") => setTheme(value)}
                className="grid grid-cols-3 gap-4"
              >
                <div>
                  <RadioGroupItem
                    value="light"
                    id="light"
                    className="peer sr-only"
                    data-testid="radio-light"
                  />
                  <Label
                    htmlFor="light"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Sun className="h-6 w-6 mb-2" />
                    <span className="text-sm font-medium">Light</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem
                    value="dark"
                    id="dark"
                    className="peer sr-only"
                    data-testid="radio-dark"
                  />
                  <Label
                    htmlFor="dark"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Moon className="h-6 w-6 mb-2" />
                    <span className="text-sm font-medium">Dark</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem
                    value="system"
                    id="system"
                    className="peer sr-only"
                    data-testid="radio-system"
                  />
                  <Label
                    htmlFor="system"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Monitor className="h-6 w-6 mb-2" />
                    <span className="text-sm font-medium">System</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About SSOAP Toolbox</CardTitle>
          <CardDescription>
            Sanitary Sewer Overflow Analysis and Planning
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Version</p>
              <p className="text-sm text-muted-foreground">2.0.0 (Web Edition)</p>
            </div>
            <Badge variant="secondary">WebAssembly</Badge>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">SWMM Engine</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">SWMM 5.1</Badge>
              <span className="text-xs text-muted-foreground">
                Storm Water Management Model (EPA)
              </span>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">Description</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The SSOAP Toolbox is a suite of computer software tools developed by the
              U.S. Environmental Protection Agency for the quantification of RDII
              (Rainfall-Derived Infiltration and Inflow) and capacity analysis of
              sanitary sewer systems. This web-based version provides browser-based
              access to simulation capabilities using WebAssembly technology.
            </p>
          </div>
          <Separator />
          <div className="space-y-3">
            <p className="text-sm font-medium">Resources</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://www.epa.gov/water-research/sanitary-sewer-overflow-analysis-and-planning-ssoap-toolbox"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-epa"
                >
                  <ExternalLink className="mr-2 h-3 w-3" />
                  EPA SSOAP Page
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://www.epa.gov/water-research/storm-water-management-model-swmm"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-swmm"
                >
                  <ExternalLink className="mr-2 h-3 w-3" />
                  SWMM Documentation
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://github.com/USEPA/Stormwater-Management-Model"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-github"
                >
                  <Github className="mr-2 h-3 w-3" />
                  EPA GitHub
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">SSOAP Toolbox Components</CardTitle>
          <CardDescription>Available analysis tools in this application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-3 rounded-md border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">Database Management Tool</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Central command for data organization and quality control
              </p>
            </div>
            <div className="p-3 rounded-md border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-chart-1/10">
                  <Info className="h-4 w-4 text-chart-1" />
                </div>
                <span className="text-sm font-medium">RDII Analysis Tool</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Hydrograph decomposition and RTK parameter fitting
              </p>
            </div>
            <div className="p-3 rounded-md border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-chart-2/10">
                  <Info className="h-4 w-4 text-chart-2" />
                </div>
                <span className="text-sm font-medium">Hydrograph Generation Tool</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Generate RDII hydrographs from RTK parameters
              </p>
            </div>
            <div className="p-3 rounded-md border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-chart-3/10">
                  <Info className="h-4 w-4 text-chart-3" />
                </div>
                <span className="text-sm font-medium">SWMM5 Simulation Tool</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Dynamic flow routing via WebAssembly SWMM engine
              </p>
            </div>
            <div className="p-3 rounded-md border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-chart-4/10">
                  <Info className="h-4 w-4 text-chart-4" />
                </div>
                <span className="text-sm font-medium">Condition Assessment Tool</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Compare pre/post rehabilitation RDII parameters
              </p>
            </div>
            <div className="p-3 rounded-md border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-chart-5/10">
                  <Info className="h-4 w-4 text-chart-5" />
                </div>
                <span className="text-sm font-medium">SSO Event Tracker</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Document and analyze overflow incidents
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground pt-4">
        <p>
          Based on EPA SSOAP Toolbox. Original software developed by EPA Office of Research and Development.
        </p>
        <p className="mt-1">
          Web version powered by SWMM-JS WebAssembly engine.
        </p>
      </div>
    </div>
  );
}
