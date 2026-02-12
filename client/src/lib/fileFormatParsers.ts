import type { ParsedTimeSeriesData } from "@/contexts/CalibrationDataContext";

export type FileFormat = "swmm5" | "icm-swmm" | "icm-infoworks" | "csv" | "unknown";

export function detectFileFormat(content: string, filename: string): FileFormat {
  const upper = content.substring(0, 2000).toUpperCase();
  if (upper.includes("[TIMESERIES]") || upper.includes("EPA STORM WATER")) return "swmm5";
  if (upper.includes("INNOVYZE") || (upper.includes("ICM") && upper.includes("SWMM"))) return "icm-swmm";
  if (upper.includes("INFOWORKS") || filename.toLowerCase().endsWith(".prn")) return "icm-infoworks";
  if (filename.toLowerCase().endsWith(".csv") || filename.toLowerCase().endsWith(".tsv")) return "csv";
  return "unknown";
}

function parseSWMM5TimeSeries(content: string): ParsedTimeSeriesData[] {
  const results: ParsedTimeSeriesData[] = [];
  const lines = content.split("\n");
  let inTimeseries = false;
  let currentName = "";
  let timestamps: Date[] = [];
  let values: number[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === "[TIMESERIES]") {
      inTimeseries = true;
      continue;
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      if (inTimeseries && timestamps.length > 0) {
        results.push({ timestamps: [...timestamps], values: [...values], units: "varies", seriesName: currentName || "SWMM5 Series", format: "swmm5" });
        timestamps = [];
        values = [];
      }
      inTimeseries = false;
      continue;
    }
    if (!inTimeseries || trimmed.startsWith(";") || trimmed === "") continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 3) {
      const name = parts[0];
      if (name !== currentName && timestamps.length > 0) {
        results.push({ timestamps: [...timestamps], values: [...values], units: "varies", seriesName: currentName, format: "swmm5" });
        timestamps = [];
        values = [];
      }
      currentName = name;
      const dateStr = parts[1];
      const timeStr = parts[2];
      const val = parseFloat(parts[parts.length - 1]);
      const ts = new Date(`${dateStr} ${timeStr}`);
      if (!isNaN(ts.getTime()) && !isNaN(val)) {
        timestamps.push(ts);
        values.push(val);
      }
    } else if (parts.length === 2) {
      const ts = new Date(parts[0]);
      const val = parseFloat(parts[1]);
      if (!isNaN(ts.getTime()) && !isNaN(val)) {
        timestamps.push(ts);
        values.push(val);
      }
    }
  }

  if (timestamps.length > 0) {
    results.push({ timestamps, values, units: "varies", seriesName: currentName || "SWMM5 Series", format: "swmm5" });
  }

  return results;
}

function parseCSVGeneric(content: string, filename: string): ParsedTimeSeriesData[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const separator = lines[0].includes("\t") ? "\t" : ",";
  const header = lines[0].split(separator).map((h) => h.trim().replace(/^["']|["']$/g, ""));

  const tsIdx = header.findIndex((h) => {
    const lower = h.toLowerCase();
    return lower.includes("date") || lower.includes("time") || lower.includes("timestamp");
  });

  if (tsIdx < 0) return [];

  const valueCols = header
    .map((h, i) => ({ name: h, index: i }))
    .filter((c) => c.index !== tsIdx);

  const results: ParsedTimeSeriesData[] = valueCols.map((col) => ({
    timestamps: [],
    values: [],
    units: guessUnits(col.name),
    seriesName: col.name,
    format: "csv" as const,
  }));

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length < 2) continue;
    const ts = new Date(cols[tsIdx]);
    if (isNaN(ts.getTime())) continue;

    valueCols.forEach((col, j) => {
      const val = parseFloat(cols[col.index]);
      if (!isNaN(val)) {
        results[j].timestamps.push(ts);
        results[j].values.push(val);
      }
    });
  }

  return results.filter((r) => r.timestamps.length > 0);
}

function guessUnits(columnName: string): string {
  const lower = columnName.toLowerCase();
  if (lower.includes("mgd") || lower.includes("flow")) return "MGD";
  if (lower.includes("cfs")) return "CFS";
  if (lower.includes("rain") || lower.includes("precip")) return "in";
  if (lower.includes("mm")) return "mm";
  return "units";
}

export async function parseFile(file: File): Promise<{ format: FileFormat; data: ParsedTimeSeriesData[] }> {
  const content = await file.text();
  const format = detectFileFormat(content, file.name);

  switch (format) {
    case "swmm5":
      return { format, data: parseSWMM5TimeSeries(content) };
    case "csv":
    default:
      return { format: format === "unknown" ? "csv" : format, data: parseCSVGeneric(content, file.name) };
  }
}
