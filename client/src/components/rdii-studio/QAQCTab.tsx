import { useState, useCallback } from "react";
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, ArrowRight, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";
import type { ParsedTimeSeriesData, QAQCResult, QAQCIssue } from "@/contexts/CalibrationDataContext";

interface QAQCTabProps {
  onNext?: () => void;
}

function runQAQCChecks(data: ParsedTimeSeriesData): QAQCResult {
  const issues: QAQCIssue[] = [];
  let missingCount = 0;
  let outlierCount = 0;
  let gapCount = 0;
  let duplicateCount = 0;
  let negativeCount = 0;

  const mean = data.values.reduce((a, b) => a + b, 0) / data.values.length;
  const variance = data.values.reduce((a, v) => a + (v - mean) ** 2, 0) / data.values.length;
  const stdDev = Math.sqrt(variance);
  const outlierThreshold = mean + 3 * stdDev;

  for (let i = 0; i < data.values.length; i++) {
    const ts = data.timestamps[i].toISOString();

    if (data.values[i] === null || data.values[i] === undefined || isNaN(data.values[i])) {
      missingCount++;
      issues.push({ type: "missing", index: i, timestamp: ts, message: "Missing or NaN value", severity: "error" });
    }

    if (data.values[i] > outlierThreshold) {
      outlierCount++;
      issues.push({ type: "outlier", index: i, timestamp: ts, value: data.values[i], message: `Value ${data.values[i].toFixed(2)} exceeds threshold ${outlierThreshold.toFixed(2)}`, severity: "warning" });
    }

    if (data.values[i] < 0) {
      negativeCount++;
      issues.push({ type: "negative", index: i, timestamp: ts, value: data.values[i], message: `Negative value: ${data.values[i].toFixed(4)}`, severity: "warning" });
    }

    if (i > 0) {
      const dt = data.timestamps[i].getTime() - data.timestamps[i - 1].getTime();
      if (i > 1) {
        const prevDt = data.timestamps[i - 1].getTime() - data.timestamps[i - 2].getTime();
        if (prevDt > 0 && dt > prevDt * 3) {
          gapCount++;
          issues.push({ type: "gap", index: i, timestamp: ts, message: `Time gap of ${(dt / 3600000).toFixed(1)} hours`, severity: "warning" });
        }
      }
      if (dt === 0) {
        duplicateCount++;
        issues.push({ type: "duplicate", index: i, timestamp: ts, value: data.values[i], message: "Duplicate timestamp", severity: "error" });
      }
    }
  }

  const passed = missingCount === 0 && outlierCount <= 5 && gapCount === 0 && negativeCount === 0 && duplicateCount === 0;

  return {
    totalPoints: data.values.length,
    missingCount,
    outlierCount,
    gapCount,
    duplicateCount,
    negativeCount,
    issues,
    passed,
  };
}

export function QAQCTab({ onNext }: QAQCTabProps) {
  const { flowData, rainfallData, qaqcFlowResult, setQaqcFlowResult, qaqcRainfallResult, setQaqcRainfallResult } = useCalibrationData();
  const [running, setRunning] = useState(false);

  const handleRunQAQC = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      if (flowData) setQaqcFlowResult(runQAQCChecks(flowData));
      if (rainfallData) setQaqcRainfallResult(runQAQCChecks(rainfallData));
      setRunning(false);
    }, 300);
  }, [flowData, rainfallData, setQaqcFlowResult, setQaqcRainfallResult]);

  const renderSummaryCard = (label: string, result: QAQCResult | null) => {
    if (!result) return null;
    const checks = [
      { name: "Missing Values", count: result.missingCount, ok: result.missingCount === 0 },
      { name: "Outliers", count: result.outlierCount, ok: result.outlierCount <= 5 },
      { name: "Time Gaps", count: result.gapCount, ok: result.gapCount === 0 },
      { name: "Negative Values", count: result.negativeCount, ok: result.negativeCount === 0 },
      { name: "Duplicates", count: result.duplicateCount, ok: result.duplicateCount === 0 },
    ];
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">{label}</CardTitle>
            <Badge variant={result.passed ? "default" : "destructive"} data-testid={`badge-qaqc-${label.toLowerCase().replace(/\s/g, "-")}`}>
              {result.passed ? "PASSED" : "ISSUES FOUND"}
            </Badge>
          </div>
          <CardDescription className="text-xs font-mono">{result.totalPoints.toLocaleString()} data points checked</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checks.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                  <span>{c.name}</span>
                </div>
                <span className="font-mono">{c.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const allIssues = [
    ...(qaqcFlowResult?.issues.map((i) => ({ ...i, source: "Flow" })) || []),
    ...(qaqcRainfallResult?.issues.map((i) => ({ ...i, source: "Rainfall" })) || []),
  ];

  if (!flowData && !rainfallData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Import data first to run quality checks.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleRunQAQC} disabled={running} data-testid="button-run-qaqc">
          <Play className="mr-2 h-4 w-4" />
          {running ? "Running..." : "Run QA/QC"}
        </Button>
      </div>

      {(qaqcFlowResult || qaqcRainfallResult) && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {renderSummaryCard("Flow Data", qaqcFlowResult)}
            {renderSummaryCard("Rainfall Data", qaqcRainfallResult)}
          </div>

          {allIssues.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Issues Detail</CardTitle>
                <CardDescription className="text-xs">{allIssues.length} issues found</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Source</TableHead>
                        <TableHead className="w-20">Severity</TableHead>
                        <TableHead className="w-24">Type</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allIssues.slice(0, 100).map((issue, idx) => (
                        <TableRow key={idx} data-testid={`row-issue-${idx}`}>
                          <TableCell className="text-xs">{issue.source}</TableCell>
                          <TableCell>
                            {issue.severity === "error" ? (
                              <Badge variant="destructive" className="text-xs">Error</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Warning</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{issue.type}</TableCell>
                          <TableCell className="text-xs font-mono">{new Date(issue.timestamp).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{issue.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {(qaqcFlowResult || qaqcRainfallResult) && onNext && (
        <div className="flex justify-end">
          <Button onClick={onNext} data-testid="button-next-step">
            Next Step
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
