import { useState, useCallback } from "react";
import { Upload, FileText, ArrowRight, Database, Calendar, Hash, AlertCircle, CheckCircle2, TableProperties, ChevronDown, ChevronRight, Copy, Check, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";
import type { ParsedTimeSeriesData } from "@/contexts/CalibrationDataContext";
import { parseFile } from "@/lib/fileFormatParsers";
import { ColumnMappingDialog } from "@/components/column-mapping-dialog";
import type { MappedData } from "@/components/column-mapping-dialog";
import { ICM_RUBY_SCRIPTS, ICM_WORKFLOW_GUIDE } from "@/lib/icmRubyScripts";
import type { ICMScript } from "@/lib/icmRubyScripts";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Brush,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const ALLOWED_EXTENSIONS = [".csv", ".dat", ".inp", ".tsv", ".txt", ".prn"];
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

interface DataImportTabProps {
  onNext?: () => void;
}

function ScriptBlock({ script }: { script: ICMScript }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(script.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [script.code]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border rounded-md">
        <CollapsibleTrigger asChild>
          <button
            className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
            data-testid={`button-toggle-${script.id}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{script.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{script.description}</p>
              </div>
            </div>
            {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs font-mono">Ruby</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 text-xs gap-1.5"
                data-testid={`button-copy-${script.id}`}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy Script"}
              </Button>
            </div>
            <pre className="bg-muted/50 rounded-md p-3 text-xs font-mono overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre leading-relaxed">
              {script.code}
            </pre>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function DataImportTab({ onNext }: DataImportTabProps) {
  const { flowData, setFlowData, rainfallData, setRainfallData, loadSampleData, sampleDataLoaded } = useCalibrationData();
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [columnMappingOpen, setColumnMappingOpen] = useState(false);
  const [icmSectionOpen, setIcmSectionOpen] = useState(false);

  const handleMappedImport = useCallback((data: MappedData[], fileName: string) => {
    const timestamps = data.map(d => d.timestamp);
    const values = data.map(d => d.flow);

    const hasRainfall = data.some(d => d.rainfall !== undefined);

    setFlowData({
      seriesName: `Flow - ${fileName}`,
      timestamps,
      values,
      units: "MGD",
      format: "csv",
    });

    if (hasRainfall) {
      setRainfallData({
        seriesName: `Rainfall - ${fileName}`,
        timestamps,
        values: data.map(d => d.rainfall ?? 0),
        units: "in/hr",
        format: "csv",
      });
    }

    setImportSuccess(`Imported ${data.length} rows from ${fileName} via column mapping`);
    setTimeout(() => setImportSuccess(null), 4000);
  }, [setFlowData, setRainfallData]);

  const validateFile = useCallback((file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    }
    return null;
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setImporting(true);
    setFileError(null);
    setImportSuccess(null);
    try {
      const fileArr = Array.from(files);
      for (const file of fileArr) {
        const error = validateFile(file);
        if (error) {
          setFileError(error);
          return;
        }
      }
      let seriesCount = 0;
      for (const file of fileArr) {
        const result = await parseFile(file);
        for (const series of result.data) {
          const name = series.seriesName.toLowerCase();
          if (name.includes("rain") || name.includes("precip")) {
            setRainfallData(series);
          } else {
            setFlowData(series);
          }
          seriesCount++;
        }
      }
      setImportSuccess(`Imported ${seriesCount} series from ${fileArr.length} file${fileArr.length > 1 ? "s" : ""}`);
      setTimeout(() => setImportSuccess(null), 4000);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setImporting(false);
    }
  }, [setFlowData, setRainfallData, validateFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const handleLoadSample = useCallback(async () => {
    setLoadingSample(true);
    try {
      await loadSampleData();
    } finally {
      setLoadingSample(false);
    }
  }, [loadSampleData]);

  const formatDate = (d: Date | undefined) => {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const buildChartData = (data: ParsedTimeSeriesData) => {
    if (!data.timestamps.length) return [];
    const step = Math.max(1, Math.floor(data.timestamps.length / 500));
    const result: { time: string; value: number }[] = [];
    for (let i = 0; i < data.timestamps.length; i += step) {
      const ts = data.timestamps[i];
      result.push({
        time: ts instanceof Date && !isNaN(ts.getTime()) ? ts.toLocaleDateString() : `${i}`,
        value: data.values[i],
      });
    }
    return result;
  };

  return (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200 ${
          dragOver
            ? "border-primary bg-primary/10 scale-[1.01] shadow-lg"
            : importing
              ? "border-primary/50 bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/40"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        data-testid="drop-zone"
      >
        <Upload className={`h-10 w-10 mx-auto mb-4 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-sm font-medium mb-1">
          {dragOver ? "Drop files to import" : "Drag & drop CSV, SWMM5, ICM SWMM, or InfoWorks files"}
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Supports {ALLOWED_EXTENSIONS.join(", ")} formats (max {MAX_FILE_SIZE_MB}MB)
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button variant="outline" asChild disabled={importing} data-testid="button-browse-files">
            <label className="cursor-pointer">
              <FileText className="mr-2 h-4 w-4" />
              {importing ? "Importing..." : "Browse Files"}
              <input type="file" className="hidden" multiple accept=".csv,.dat,.inp,.tsv,.txt" onChange={handleFileInput} />
            </label>
          </Button>
          <Button variant="outline" onClick={handleLoadSample} disabled={loadingSample || sampleDataLoaded} data-testid="button-load-sample">
            <Database className="mr-2 h-4 w-4" />
            {loadingSample ? "Loading..." : sampleDataLoaded ? "Sample Loaded" : "Load Sample Data"}
          </Button>
          <Button variant="outline" onClick={() => setColumnMappingOpen(true)} data-testid="button-column-mapping">
            <TableProperties className="mr-2 h-4 w-4" />
            Column Mapping
          </Button>
        </div>
      </div>

      {fileError && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-file-error">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {fileError}
        </div>
      )}

      {importSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm" data-testid="text-import-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {importSuccess}
        </div>
      )}

      {(flowData || rainfallData) && (
        <div className="grid gap-4 md:grid-cols-2">
          {flowData && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">Flow Data</CardTitle>
                  <Badge variant="outline">{flowData.format.toUpperCase()}</Badge>
                </div>
                <CardDescription className="text-xs">{flowData.seriesName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Points:</span>
                    <span className="font-mono" data-testid="text-flow-points">{flowData.timestamps.length.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">From:</span>
                    <span className="font-mono" data-testid="text-flow-start">{formatDate(flowData.timestamps[0])}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Units:</span>
                    <span className="font-mono" data-testid="text-flow-units">{flowData.units}</span>
                  </div>
                </div>
                <ChartContainer config={{ value: { label: "Flow", color: "hsl(var(--chart-1))" } }} className="h-[150px] w-full">
                  <ResponsiveContainer>
                    <AreaChart data={buildChartData(flowData)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} strokeWidth={1.5} name="Flow" />
                      {buildChartData(flowData).length > 20 && <Brush dataKey="time" height={20} stroke="hsl(var(--primary))" travellerWidth={8} />}
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {rainfallData && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">Rainfall Data</CardTitle>
                  <Badge variant="outline">{rainfallData.format.toUpperCase()}</Badge>
                </div>
                <CardDescription className="text-xs">{rainfallData.seriesName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Points:</span>
                    <span className="font-mono" data-testid="text-rain-points">{rainfallData.timestamps.length.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">From:</span>
                    <span className="font-mono" data-testid="text-rain-start">{formatDate(rainfallData.timestamps[0])}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Units:</span>
                    <span className="font-mono" data-testid="text-rain-units">{rainfallData.units}</span>
                  </div>
                </div>
                <ChartContainer config={{ value: { label: "Rainfall", color: "hsl(var(--chart-2))" } }} className="h-[150px] w-full">
                  <ResponsiveContainer>
                    <AreaChart data={buildChartData(rainfallData)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} strokeWidth={1.5} name="Rainfall" />
                      {buildChartData(rainfallData).length > 20 && <Brush dataKey="time" height={20} stroke="hsl(var(--primary))" travellerWidth={8} />}
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!flowData && !rainfallData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No data loaded yet. Upload files or load sample data to begin.</p>
          </CardContent>
        </Card>
      )}

      <Collapsible open={icmSectionOpen} onOpenChange={setIcmSectionOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Import from ICM — Ruby Exchange Scripts
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    6 Ruby scripts for extracting and importing RTK data between ICM InfoWorks/SWMM and SSOAP 2026
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{ICM_RUBY_SCRIPTS.length} Scripts</Badge>
                  {icmSectionOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="bg-muted/30 rounded-md p-3 text-xs text-muted-foreground font-mono whitespace-pre-wrap" data-testid="text-icm-workflow-guide">
                {ICM_WORKFLOW_GUIDE}
              </div>
              <div className="space-y-2">
                {ICM_RUBY_SCRIPTS.map((script) => (
                  <ScriptBlock key={script.id} script={script} />
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {(flowData || rainfallData) && onNext && (
        <div className="flex justify-end">
          <Button onClick={onNext} data-testid="button-next-step">
            Next Step
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      <ColumnMappingDialog
        open={columnMappingOpen}
        onOpenChange={setColumnMappingOpen}
        onImport={handleMappedImport}
      />
    </div>
  );
}
