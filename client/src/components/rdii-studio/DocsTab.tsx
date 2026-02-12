import { BookOpen, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DocsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">RDII Calibration Workflow</CardTitle>
          </div>
          <CardDescription className="text-xs">Step-by-step guide for the RTK calibration process</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-3">
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0">1</Badge>
              <div>
                <p className="font-medium">Data Import</p>
                <p className="text-xs text-muted-foreground">Load flow monitoring and rainfall data from CSV or SWMM5 format files. Verify time series alignment.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0">2</Badge>
              <div>
                <p className="font-medium">QA/QC</p>
                <p className="text-xs text-muted-foreground">Check data quality: missing values, outliers, time gaps, negative flows, and duplicate timestamps.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0">3</Badge>
              <div>
                <p className="font-medium">DWF & GWI Separation</p>
                <p className="text-xs text-muted-foreground">Identify dry weather flow patterns and groundwater infiltration baseline from dry-day analysis.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0">4</Badge>
              <div>
                <p className="font-medium">RDII Series Extraction</p>
                <p className="text-xs text-muted-foreground">Compute RDII = Total Flow - DWF - GWI. Negative values are clamped to zero.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0">5</Badge>
              <div>
                <p className="font-medium">Storm Event Detection</p>
                <p className="text-xs text-muted-foreground">Automatically detect storm events from rainfall data using inter-event time separation.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0">6</Badge>
              <div>
                <p className="font-medium">RTK Calibration</p>
                <p className="text-xs text-muted-foreground">Optimize RTK parameters using multi-objective genetic algorithm (NSGA-II) to match observed hydrographs.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="shrink-0">7</Badge>
              <div>
                <p className="font-medium">Compare & Export</p>
                <p className="text-xs text-muted-foreground">Compare Pareto-optimal solutions and export calibrated parameters in SWMM5 format.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">RTK Unit Hydrograph Method</CardTitle>
          <CardDescription className="text-xs">Three-triangle approach for RDII simulation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            The RTK method uses three triangular unit hydrographs to represent the fast (inflow-dominated),
            medium (mixed), and slow (infiltration-dominated) response components of RDII. Each triangle is
            defined by three parameters:
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Fast</TableHead>
                <TableHead>Medium</TableHead>
                <TableHead>Slow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono font-medium">R</TableCell>
                <TableCell className="text-xs">Fraction of rainfall volume entering sewer</TableCell>
                <TableCell className="font-mono text-xs">R1</TableCell>
                <TableCell className="font-mono text-xs">R2</TableCell>
                <TableCell className="font-mono text-xs">R3</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono font-medium">T</TableCell>
                <TableCell className="text-xs">Time to peak of unit hydrograph (hours)</TableCell>
                <TableCell className="font-mono text-xs">T1</TableCell>
                <TableCell className="font-mono text-xs">T2</TableCell>
                <TableCell className="font-mono text-xs">T3</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono font-medium">K</TableCell>
                <TableCell className="text-xs">Ratio of recession limb to time to peak</TableCell>
                <TableCell className="font-mono text-xs">K1</TableCell>
                <TableCell className="font-mono text-xs">K2</TableCell>
                <TableCell className="font-mono text-xs">K3</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            The total RDII hydrograph is the sum of three convolutions of rainfall with each unit hydrograph,
            scaled by the respective R fraction and catchment area.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Calibration Objectives</CardTitle>
          <CardDescription className="text-xs">Multi-objective optimization metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono font-medium">RMSE</TableCell>
                <TableCell className="text-xs">Root Mean Square Error between observed and simulated flows</TableCell>
                <TableCell className="text-xs font-mono">Minimize</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono font-medium">Volume Bias</TableCell>
                <TableCell className="text-xs">Percentage difference in total simulated vs observed volume</TableCell>
                <TableCell className="text-xs font-mono">Minimize |%|</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono font-medium">Peak Error</TableCell>
                <TableCell className="text-xs">Percentage error in peak flow reproduction</TableCell>
                <TableCell className="text-xs font-mono">Minimize |%|</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono font-medium">NSE</TableCell>
                <TableCell className="text-xs">Nash-Sutcliffe Efficiency (1 = perfect, 0 = mean, negative = worse than mean)</TableCell>
                <TableCell className="text-xs font-mono">Maximize (target &gt; 0.7)</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Tips for Good Calibration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-foreground">1.</span>
              Use at least 3-5 storm events for reliable calibration. More events provide better parameter estimates.
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-foreground">2.</span>
              Ensure flow and rainfall data are time-aligned with consistent intervals.
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-foreground">3.</span>
              Verify DWF separation before calibrating. Poor DWF estimates will propagate errors into RDII.
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-foreground">4.</span>
              Check parameter constraints: R1+R2+R3 should not exceed 1.0 (typically 0.05-0.30 total).
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-foreground">5.</span>
              Time parameters should follow T1 &lt; T2 &lt; T3 to represent fast, medium, and slow responses.
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-foreground">6.</span>
              A good calibration typically achieves NSE &gt; 0.6, volume error &lt; 15%, and peak error &lt; 25%.
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-medium text-foreground">7.</span>
              Consider running multiple calibrations and comparing Pareto-optimal solutions for trade-off analysis.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
