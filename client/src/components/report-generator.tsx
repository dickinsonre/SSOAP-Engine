import { useState, useCallback } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import type { Project, Simulation, RDIIParameters, DWFPattern, SSOEvent, ConditionAssessment } from "@shared/schema";

function escapeHTML(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function generateHTMLReport(
  project: Project,
  sections: Record<string, boolean>,
  simulations: Simulation[],
  rdiiParams: RDIIParameters[],
  dwfPatterns: DWFPattern[],
  ssoEvents: SSOEvent[],
  assessments: ConditionAssessment[],
): string {
  const now = new Date().toLocaleDateString();
  const completedSims = simulations.filter(s => s.status === "completed");

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RDII Toolbox Report - ${escapeHTML(project.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'IBM Plex Sans', -apple-system, sans-serif; color: #1a1a2e; line-height: 1.6; padding: 2rem; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; color: #0f172a; }
  h2 { font-size: 1.3rem; margin: 2rem 0 0.75rem; padding-bottom: 0.3rem; border-bottom: 2px solid #e2e8f0; color: #1e293b; }
  h3 { font-size: 1.05rem; margin: 1rem 0 0.5rem; color: #334155; }
  table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.85rem; }
  th, td { padding: 0.5rem 0.75rem; text-align: left; border: 1px solid #e2e8f0; }
  th { background: #f1f5f9; font-weight: 600; }
  tr:nth-child(even) { background: #f8fafc; }
  .header { border-bottom: 3px solid #3b82f6; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  .meta { color: #64748b; font-size: 0.85rem; }
  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-yellow { background: #fef9c3; color: #854d0e; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin: 1rem 0; }
  .stat-card { padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; }
  .stat-value { font-size: 1.5rem; font-weight: 700; font-family: 'IBM Plex Mono', monospace; }
  .stat-label { font-size: 0.8rem; color: #64748b; }
  .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 0.75rem; }
</style>
</head>
<body>
<div class="header">
  <h1>RDII Toolbox Analysis Report</h1>
  <p class="meta">Project: <strong>${escapeHTML(project.name)}</strong> | Generated: ${now}</p>
  <p class="meta">${escapeHTML(project.description)}</p>
</div>`;

  if (sections.projectSummary) {
    html += `
<h2>1. Project Summary</h2>
<div class="stat-grid">
  <div class="stat-card">
    <div class="stat-value">${project.sewershedCount}</div>
    <div class="stat-label">Sewersheds</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${project.totalArea.toLocaleString()}</div>
    <div class="stat-label">Total Area (acres)</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${simulations.length}</div>
    <div class="stat-label">Simulations</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${ssoEvents.length}</div>
    <div class="stat-label">SSO Events</div>
  </div>
</div>
<table>
  <tr><th>Property</th><th>Value</th></tr>
  <tr><td>Project Name</td><td>${escapeHTML(project.name)}</td></tr>
  <tr><td>Status</td><td>${project.status}</td></tr>
  <tr><td>Created</td><td>${new Date(project.createdAt).toLocaleDateString()}</td></tr>
  <tr><td>Last Updated</td><td>${new Date(project.updatedAt).toLocaleDateString()}</td></tr>
</table>`;
  }

  if (sections.dwfResults && dwfPatterns.length > 0) {
    html += `
<h2>2. Dry Weather Flow Analysis</h2>
<table>
  <tr><th>Sewershed</th><th>Mean Flow</th><th>Min Flow</th><th>Max Flow</th><th>Std Dev</th><th>GWI</th><th>Dry Days</th></tr>`;
    dwfPatterns.forEach(p => {
      html += `<tr><td>${escapeHTML(p.sewershedName)}</td><td>${p.meanFlow.toFixed(3)}</td><td>${p.minFlow.toFixed(3)}</td><td>${p.maxFlow.toFixed(3)}</td><td>${p.standardDeviation.toFixed(3)}</td><td>${p.groundwaterFlow.toFixed(3)}</td><td>${p.dryDaysCount}</td></tr>`;
    });
    html += `</table>`;
  }

  if (sections.rdiiResults && rdiiParams.length > 0) {
    html += `
<h2>3. RDII Quantification</h2>
<table>
  <tr><th>Sewershed</th><th>Area (ac)</th><th>R1</th><th>R2</th><th>R3</th><th>Total R</th><th>T1</th><th>T2</th><th>T3</th><th>Response</th></tr>`;
    rdiiParams.forEach(p => {
      html += `<tr><td>${escapeHTML(p.sewershedName)}</td><td>${p.area}</td><td>${p.r1.toFixed(4)}</td><td>${p.r2.toFixed(4)}</td><td>${p.r3.toFixed(4)}</td><td>${p.totalR.toFixed(4)}</td><td>${p.t1.toFixed(1)}</td><td>${p.t2.toFixed(1)}</td><td>${p.t3.toFixed(1)}</td><td>${p.dominantResponse}</td></tr>`;
    });
    html += `</table>`;
  }

  if (sections.capacityAnalysis && completedSims.length > 0) {
    html += `
<h2>4. Capacity Analysis</h2>`;
    completedSims.forEach(sim => {
      if (!sim.outputData) return;
      const { outputData } = sim;
      const floodedNodes = outputData.nodeResults.filter(n => n.floodVolume > 0);
      const capacityLinks = outputData.linkResults.filter(l => l.capacityLimited > 0);

      html += `
<h3>${sim.name}</h3>
<div class="stat-grid">
  <div class="stat-card">
    <div class="stat-value">${outputData.peakFlow.toFixed(1)}</div>
    <div class="stat-label">Peak Flow (CFS)</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${floodedNodes.length}</div>
    <div class="stat-label">Flooded Nodes</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${capacityLinks.length}</div>
    <div class="stat-label">Capacity-Limited Links</div>
  </div>
</div>`;
      if (floodedNodes.length > 0) {
        html += `<table><tr><th>Node</th><th>Type</th><th>Flood Volume (MG)</th><th>Time Flooded (hr)</th></tr>`;
        floodedNodes.sort((a, b) => b.floodVolume - a.floodVolume).forEach(n => {
          html += `<tr><td>${escapeHTML(n.name)}</td><td>${n.type}</td><td>${n.floodVolume.toFixed(4)}</td><td>${n.timeFlooded.toFixed(2)}</td></tr>`;
        });
        html += `</table>`;
      }
    });
  }

  if (sections.ssoRisk && ssoEvents.length > 0) {
    const locationCounts: Record<string, { count: number; totalVolume: number; maxSeverity: string }> = {};
    ssoEvents.forEach(e => {
      if (!locationCounts[e.location]) {
        locationCounts[e.location] = { count: 0, totalVolume: 0, maxSeverity: "minor" };
      }
      locationCounts[e.location].count++;
      locationCounts[e.location].totalVolume += e.volume;
      if (e.severity === "major" || (e.severity === "moderate" && locationCounts[e.location].maxSeverity !== "major")) {
        locationCounts[e.location].maxSeverity = e.severity;
      }
    });

    const sorted = Object.entries(locationCounts).sort((a, b) => b[1].count - a[1].count);

    html += `
<h2>5. SSO Risk Ranking</h2>
<table>
  <tr><th>Location</th><th>Events</th><th>Total Volume (gal)</th><th>Max Severity</th><th>Risk</th></tr>`;
    sorted.forEach(([loc, data]) => {
      const risk = data.count >= 3 ? "High" : data.count >= 2 ? "Medium" : "Low";
      const badgeClass = risk === "High" ? "badge-red" : risk === "Medium" ? "badge-yellow" : "badge-green";
      html += `<tr><td>${escapeHTML(loc)}</td><td>${data.count}</td><td>${data.totalVolume.toLocaleString()}</td><td>${data.maxSeverity}</td><td><span class="badge ${badgeClass}">${risk}</span></td></tr>`;
    });
    html += `</table>`;
  }

  if (sections.rehabPriority && assessments.length > 0) {
    html += `
<h2>6. Rehabilitation Priorities</h2>
<table>
  <tr><th>Sewershed</th><th>Priority</th><th>Status</th><th>RDII Reduction</th><th>Notes</th></tr>`;
    assessments.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    }).forEach(a => {
      const badgeClass = a.priority === "high" ? "badge-red" : a.priority === "medium" ? "badge-yellow" : "badge-green";
      html += `<tr><td>${escapeHTML(a.sewershedName)}</td><td><span class="badge ${badgeClass}">${a.priority}</span></td><td>${a.status}</td><td>${a.rdiiReduction}%</td><td>${escapeHTML(a.notes)}</td></tr>`;
    });
    html += `</table>`;
  }

  html += `
<div class="footer">
  <p>Generated by RDII Toolbox v2.0 | ${now}</p>
</div>
</body>
</html>`;

  return html;
}

export function ReportGeneratorDialog({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState({
    projectSummary: true,
    dwfResults: true,
    rdiiResults: true,
    capacityAnalysis: true,
    ssoRisk: true,
    rehabPriority: true,
  });

  const { data: simulations = [] } = useQuery<Simulation[]>({
    queryKey: [`/api/simulations?projectId=${project.id}`],
    enabled: open,
  });

  const { data: rdiiParams = [] } = useQuery<RDIIParameters[]>({
    queryKey: [`/api/rdii-parameters?projectId=${project.id}`],
    enabled: open,
  });

  const { data: dwfPatterns = [] } = useQuery<DWFPattern[]>({
    queryKey: [`/api/dwf-patterns?projectId=${project.id}`],
    enabled: open,
  });

  const { data: ssoEvents = [] } = useQuery<SSOEvent[]>({
    queryKey: [`/api/sso-events?projectId=${project.id}`],
    enabled: open,
  });

  const { data: assessments = [] } = useQuery<ConditionAssessment[]>({
    queryKey: [`/api/condition-assessments?projectId=${project.id}`],
    enabled: open,
  });

  const handleGenerate = useCallback(() => {
    setGenerating(true);
    try {
      const html = generateHTMLReport(project, sections, simulations, rdiiParams, dwfPatterns, ssoEvents, assessments);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RDII_Report_${project.name.replace(/\s+/g, "_")}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }, [project, sections, simulations, rdiiParams, dwfPatterns, ssoEvents, assessments]);

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const sectionLabels: Record<string, string> = {
    projectSummary: "Project Summary",
    dwfResults: "DWF Analysis Results",
    rdiiResults: "RDII Quantification",
    capacityAnalysis: "Capacity Analysis",
    ssoRisk: "SSO Risk Ranking",
    rehabPriority: "Rehabilitation Priorities",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-report-${project.id}`}>
          <FileText className="mr-2 h-4 w-4" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Analysis Report</DialogTitle>
          <DialogDescription>
            Select sections to include in the HTML report for {project.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {Object.entries(sectionLabels).map(([key, label]) => (
            <div key={key} className="flex items-center space-x-3">
              <Checkbox
                id={`section-${key}`}
                checked={sections[key as keyof typeof sections]}
                onCheckedChange={() => toggleSection(key as keyof typeof sections)}
                data-testid={`checkbox-section-${key}`}
              />
              <Label htmlFor={`section-${key}`} className="text-sm">{label}</Label>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            {simulations.length} sims
          </Badge>
          <Badge variant="outline">
            {rdiiParams.length} RDII params
          </Badge>
          <Badge variant="outline">
            {ssoEvents.length} SSO events
          </Badge>
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="w-full mt-4" data-testid="button-generate-report">
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {generating ? "Generating..." : "Download HTML Report"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
