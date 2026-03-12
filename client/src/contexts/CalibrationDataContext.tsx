import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type {
  GapFillResult, OutlierResult, DryDay, MNFResult, GWIModelResult,
  BSFResult, DWFPattern, RValueResult, VolumeBalance, GoodnessOfFit,
  SensitivityResult, EventCharacterization, RainfallEvent, TimeSeriesPoint,
} from "@/lib/flowDecomposition";

export interface ParsedTimeSeriesData {
  timestamps: Date[];
  values: number[];
  units: string;
  seriesName: string;
  format: string;
  metadata?: Record<string, unknown>;
}

export interface DetectedEvent {
  id: number;
  startIndex: number;
  endIndex: number;
  startDate: string;
  endDate: string;
  rainDepth: number;
  rdiiVolume: number;
  peakRDII: number;
  duration: number;
  selected: boolean;
}

export interface OptimizationResult {
  parameters: {
    R1: number; T1: number; K1: number;
    R2: number; T2: number; K2: number;
    R3: number; T3: number; K3: number;
  };
  rmse: number;
  volumeError: number;
  peakError: number;
  nse: number;
  simulatedFlow?: number[];
  label?: string;
}

export interface DWFResult {
  baseFlow: number[];
  gwiFlow: number[];
  dwfPattern: number[];
  meanDWF: number;
  meanGWI: number;
}

export interface RDIISeries {
  timestamps: Date[];
  values: number[];
  totalVolume: number;
}

export interface QAQCResult {
  totalPoints: number;
  missingCount: number;
  outlierCount: number;
  gapCount: number;
  duplicateCount: number;
  negativeCount: number;
  issues: QAQCIssue[];
  passed: boolean;
}

export interface QAQCIssue {
  type: "missing" | "outlier" | "gap" | "duplicate" | "negative" | "flat";
  index: number;
  timestamp: string;
  value?: number;
  message: string;
  severity: "warning" | "error";
}

interface CalibrationDataContextType {
  flowData: ParsedTimeSeriesData | null;
  setFlowData: (data: ParsedTimeSeriesData | null) => void;
  rainfallData: ParsedTimeSeriesData | null;
  setRainfallData: (data: ParsedTimeSeriesData | null) => void;
  detectedEvents: DetectedEvent[];
  setDetectedEvents: (events: DetectedEvent[]) => void;
  optimizationResults: OptimizationResult[];
  setOptimizationResults: (results: OptimizationResult[]) => void;
  selectedSolutionIndex: number;
  setSelectedSolutionIndex: (index: number) => void;
  dwfResult: DWFResult | null;
  setDWFResult: (result: DWFResult | null) => void;
  rdiiSeries: RDIISeries | null;
  setRDIISeries: (series: RDIISeries | null) => void;
  qaqcFlowResult: QAQCResult | null;
  setQaqcFlowResult: (result: QAQCResult | null) => void;
  qaqcRainfallResult: QAQCResult | null;
  setQaqcRainfallResult: (result: QAQCResult | null) => void;
  sampleDataLoaded: boolean;
  loadSampleData: () => Promise<void>;
  gapFillResult: GapFillResult | null;
  setGapFillResult: (r: GapFillResult | null) => void;
  outlierResult: OutlierResult | null;
  setOutlierResult: (r: OutlierResult | null) => void;
  dryDays: DryDay[];
  setDryDays: (d: DryDay[]) => void;
  rainfallEvents: RainfallEvent[];
  setRainfallEvents: (e: RainfallEvent[]) => void;
  mnfResult: MNFResult | null;
  setMnfResult: (r: MNFResult | null) => void;
  gwiModel: GWIModelResult | null;
  setGwiModel: (r: GWIModelResult | null) => void;
  bsfResult: BSFResult | null;
  setBsfResult: (r: BSFResult | null) => void;
  dwfPattern: DWFPattern | null;
  setDwfPattern: (p: DWFPattern | null) => void;
  rValueResult: RValueResult | null;
  setRValueResult: (r: RValueResult | null) => void;
  volumeBalance: VolumeBalance | null;
  setVolumeBalance: (v: VolumeBalance | null) => void;
  sensitivityResults: SensitivityResult[];
  setSensitivityResults: (r: SensitivityResult[]) => void;
  eventCharacterizations: EventCharacterization[];
  setEventCharacterizations: (e: EventCharacterization[]) => void;
  moistureIndex: TimeSeriesPoint[];
  setMoistureIndex: (m: TimeSeriesPoint[]) => void;
}

const CalibrationDataContext = createContext<CalibrationDataContextType | null>(null);

export function useCalibrationData() {
  const ctx = useContext(CalibrationDataContext);
  if (!ctx) throw new Error("useCalibrationData must be used within CalibrationDataProvider");
  return ctx;
}

function parseCSV(text: string, seriesName: string, units: string): ParsedTimeSeriesData {
  const lines = text.trim().split("\n");
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const tsIdx = header.findIndex((h) => h.includes("date") || h.includes("time") || h.includes("timestamp"));
  const valIdx = header.findIndex((h, i) => i !== tsIdx && !h.includes("date") && !h.includes("time"));

  const timestamps: Date[] = [];
  const values: number[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < 2) continue;
    const ts = new Date(cols[tsIdx >= 0 ? tsIdx : 0]);
    const val = parseFloat(cols[valIdx >= 0 ? valIdx : 1]);
    if (!isNaN(ts.getTime()) && !isNaN(val)) {
      timestamps.push(ts);
      values.push(val);
    }
  }

  return { timestamps, values, units, seriesName, format: "csv" };
}

export function CalibrationDataProvider({ children }: { children: ReactNode }) {
  const [flowData, setFlowData] = useState<ParsedTimeSeriesData | null>(null);
  const [rainfallData, setRainfallData] = useState<ParsedTimeSeriesData | null>(null);
  const [detectedEvents, setDetectedEvents] = useState<DetectedEvent[]>([]);
  const [optimizationResults, setOptimizationResults] = useState<OptimizationResult[]>([]);
  const [selectedSolutionIndex, setSelectedSolutionIndex] = useState(0);
  const [dwfResult, setDWFResult] = useState<DWFResult | null>(null);
  const [rdiiSeries, setRDIISeries] = useState<RDIISeries | null>(null);
  const [qaqcFlowResult, setQaqcFlowResult] = useState<QAQCResult | null>(null);
  const [qaqcRainfallResult, setQaqcRainfallResult] = useState<QAQCResult | null>(null);
  const [sampleDataLoaded, setSampleDataLoaded] = useState(false);
  const [gapFillResult, setGapFillResult] = useState<GapFillResult | null>(null);
  const [outlierResult, setOutlierResult] = useState<OutlierResult | null>(null);
  const [dryDays, setDryDays] = useState<DryDay[]>([]);
  const [rainfallEvents, setRainfallEvents] = useState<RainfallEvent[]>([]);
  const [mnfResult, setMnfResult] = useState<MNFResult | null>(null);
  const [gwiModel, setGwiModel] = useState<GWIModelResult | null>(null);
  const [bsfResult, setBsfResult] = useState<BSFResult | null>(null);
  const [dwfPattern, setDwfPattern] = useState<DWFPattern | null>(null);
  const [rValueResult, setRValueResult] = useState<RValueResult | null>(null);
  const [volumeBalance, setVolumeBalance] = useState<VolumeBalance | null>(null);
  const [sensitivityResults, setSensitivityResults] = useState<SensitivityResult[]>([]);
  const [eventCharacterizations, setEventCharacterizations] = useState<EventCharacterization[]>([]);
  const [moistureIndex, setMoistureIndex] = useState<TimeSeriesPoint[]>([]);

  const loadSampleData = useCallback(async () => {
    try {
      const [flowResp, rainResp] = await Promise.all([
        fetch("/sample-data/flow-data.csv"),
        fetch("/sample-data/rainfall-data.csv"),
      ]);
      if (flowResp.ok && rainResp.ok) {
        const flowText = await flowResp.text();
        const rainText = await rainResp.text();
        const parsedFlow = parseCSV(flowText, "Flow", "MGD");
        const parsedRain = parseCSV(rainText, "Rainfall", "in");
        if (parsedFlow.timestamps.length > 0 && parsedRain.timestamps.length > 0) {
          setFlowData(parsedFlow);
          setRainfallData(parsedRain);
          setSampleDataLoaded(true);
        }
      }
    } catch {
    }
  }, []);

  return (
    <CalibrationDataContext.Provider
      value={{
        flowData, setFlowData,
        rainfallData, setRainfallData,
        detectedEvents, setDetectedEvents,
        optimizationResults, setOptimizationResults,
        selectedSolutionIndex, setSelectedSolutionIndex,
        dwfResult, setDWFResult,
        rdiiSeries, setRDIISeries,
        qaqcFlowResult, setQaqcFlowResult,
        qaqcRainfallResult, setQaqcRainfallResult,
        sampleDataLoaded, loadSampleData,
        gapFillResult, setGapFillResult,
        outlierResult, setOutlierResult,
        dryDays, setDryDays,
        rainfallEvents, setRainfallEvents,
        mnfResult, setMnfResult,
        gwiModel, setGwiModel,
        bsfResult, setBsfResult,
        dwfPattern, setDwfPattern,
        rValueResult, setRValueResult,
        volumeBalance, setVolumeBalance,
        sensitivityResults, setSensitivityResults,
        eventCharacterizations, setEventCharacterizations,
        moistureIndex, setMoistureIndex,
      }}
    >
      {children}
    </CalibrationDataContext.Provider>
  );
}
