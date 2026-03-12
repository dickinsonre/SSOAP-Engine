import { useState, useCallback, useMemo } from "react";
import { Upload, ArrowRight, Eye, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ColumnMapping {
  timestamp: string;
  flow: string;
  depth?: string;
  velocity?: string;
  rainfall?: string;
}

export interface MappedData {
  timestamp: Date;
  flow: number;
  depth?: number;
  velocity?: number;
  rainfall?: number;
}

const TARGET_FIELDS = [
  { key: "skip", label: "(skip)" },
  { key: "timestamp", label: "Timestamp" },
  { key: "flow", label: "Flow" },
  { key: "depth", label: "Depth" },
  { key: "velocity", label: "Velocity" },
  { key: "rainfall", label: "Rainfall" },
];

const FLOW_UNITS = ["MGD", "CFS", "GPM", "LPS", "CMS"];
const DEPTH_UNITS = ["ft", "in", "m", "mm"];

function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lowerHeaders = headers.map(h => h.toLowerCase());

  for (let i = 0; i < lowerHeaders.length; i++) {
    const h = lowerHeaders[i];
    if (!mapping.timestamp && (h.includes("date") || h.includes("time") || h.includes("timestamp"))) {
      mapping[headers[i]] = "timestamp";
    } else if (!mapping.flow && (h.includes("flow") || h === "q" || h.includes("discharge"))) {
      mapping[headers[i]] = "flow";
    } else if (!mapping.depth && (h.includes("depth") || h.includes("level") || h === "d")) {
      mapping[headers[i]] = "depth";
    } else if (!mapping.velocity && (h.includes("velocity") || h.includes("vel") || h === "v")) {
      mapping[headers[i]] = "velocity";
    } else if (!mapping.rainfall && (h.includes("rain") || h.includes("precip"))) {
      mapping[headers[i]] = "rainfall";
    }
  }

  return mapping;
}

export function ColumnMappingDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: MappedData[], fileName: string) => void;
}) {
  const [fileContent, setFileContent] = useState<string[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [flowUnit, setFlowUnit] = useState("MGD");
  const [depthUnit, setDepthUnit] = useState("ft");
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "tsv", "txt", "dat"].includes(ext || "")) {
      setError("Unsupported file type. Use CSV, TSV, TXT, or DAT files.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("File exceeds 50MB limit.");
      return;
    }

    const text = await file.text();
    const delimiter = text.includes("\t") ? "\t" : ",";
    const lines = text.trim().split("\n").map(l => l.split(delimiter).map(c => c.trim().replace(/^"|"$/g, "")));

    if (lines.length < 2) {
      setError("File must have at least a header row and one data row.");
      return;
    }

    const hdrs = lines[0];
    setHeaders(hdrs);
    setFileContent(lines.slice(1));
    setFileName(file.name);

    const autoMap = autoDetectMapping(hdrs);
    const initialMapping: Record<string, string> = {};
    hdrs.forEach(h => {
      initialMapping[h] = autoMap[h] || "skip";
    });
    setColumnMapping(initialMapping);
  }, []);

  const previewRows = useMemo(() => {
    if (!fileContent) return [];
    return fileContent.slice(0, 5);
  }, [fileContent]);

  const mappingValid = useMemo(() => {
    const values = Object.values(columnMapping);
    return values.includes("timestamp") && values.includes("flow");
  }, [columnMapping]);

  const handleImport = useCallback(() => {
    if (!fileContent || !mappingValid) return;

    const reverseMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const target = columnMapping[h];
      if (target && target !== "skip") {
        reverseMap[target] = i;
      }
    });

    const mapped: MappedData[] = [];
    for (const row of fileContent) {
      const tsIdx = reverseMap.timestamp;
      const flowIdx = reverseMap.flow;
      if (tsIdx === undefined || flowIdx === undefined) continue;

      const ts = new Date(row[tsIdx]);
      const flowVal = parseFloat(row[flowIdx]);
      if (isNaN(ts.getTime()) || isNaN(flowVal)) continue;

      const entry: MappedData = { timestamp: ts, flow: flowVal };

      if (reverseMap.depth !== undefined) {
        const d = parseFloat(row[reverseMap.depth]);
        if (!isNaN(d)) entry.depth = d;
      }
      if (reverseMap.velocity !== undefined) {
        const v = parseFloat(row[reverseMap.velocity]);
        if (!isNaN(v)) entry.velocity = v;
      }
      if (reverseMap.rainfall !== undefined) {
        const r = parseFloat(row[reverseMap.rainfall]);
        if (!isNaN(r)) entry.rainfall = r;
      }

      mapped.push(entry);
    }

    onImport(mapped, fileName);
    onOpenChange(false);
    setFileContent(null);
    setHeaders([]);
    setColumnMapping({});
  }, [fileContent, headers, columnMapping, mappingValid, fileName, onImport, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Monitoring Data</DialogTitle>
          <DialogDescription>
            Upload a CSV file and map columns to the required fields
          </DialogDescription>
        </DialogHeader>

        {!fileContent ? (
          <div className="space-y-4 py-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById("col-map-file")?.click()}
              data-testid="dropzone-column-mapping"
            >
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Click to select a file</p>
              <p className="text-xs text-muted-foreground mt-1">CSV, TSV, TXT, or DAT (max 50MB)</p>
            </div>
            <input
              type="file"
              id="col-map-file"
              accept=".csv,.tsv,.txt,.dat"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{fileName}</span>
              <Badge variant="outline" className="text-xs">{fileContent.length} rows</Badge>
              <Badge variant="outline" className="text-xs">{headers.length} columns</Badge>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Column Mapping</p>
              <div className="grid gap-2">
                {headers.map((header) => (
                  <div key={header} className="flex items-center gap-3">
                    <span className="text-sm font-mono w-40 truncate" title={header}>{header}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Select
                      value={columnMapping[header] || "skip"}
                      onValueChange={(val) => setColumnMapping(prev => ({ ...prev, [header]: val }))}
                    >
                      <SelectTrigger className="w-40" data-testid={`select-mapping-${header}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_FIELDS.map(f => (
                          <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Flow Units</p>
                <Select value={flowUnit} onValueChange={setFlowUnit}>
                  <SelectTrigger className="w-24" data-testid="select-flow-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLOW_UNITS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Depth Units</p>
                <Select value={depthUnit} onValueChange={setDepthUnit}>
                  <SelectTrigger className="w-24" data-testid="select-depth-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPTH_UNITS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {previewRows.length > 0 && (
              <div>
                <p className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4" />
                  Preview (first 5 rows)
                </p>
                <ScrollArea className="h-[160px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {headers.map(h => (
                          <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => (
                            <TableCell key={j} className="text-xs font-mono py-1 whitespace-nowrap">{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-sm">
                {mappingValid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-green-700 dark:text-green-400">Timestamp and Flow mapped</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-destructive">Map at least Timestamp and Flow</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setFileContent(null); setHeaders([]); }} data-testid="button-back-column-mapping">
                  Back
                </Button>
                <Button onClick={handleImport} disabled={!mappingValid} data-testid="button-import-mapped-data">
                  Import {fileContent.length} Rows
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
