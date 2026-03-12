export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface GapInfo {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  durationHours: number;
  type: 'missing' | 'flatline' | 'zero' | 'dropout';
}

export interface OutlierInfo {
  index: number;
  timestamp: number;
  value: number;
  method: string;
  reason: string;
  severity: 'warning' | 'critical';
}

export interface GapFillResult {
  filled: TimeSeriesPoint[];
  gaps: GapInfo[];
  recordsFilled: number;
  recordsFlagged: number;
}

export interface OutlierResult {
  cleaned: TimeSeriesPoint[];
  outliers: OutlierInfo[];
}

export interface AlignmentResult {
  flow: TimeSeriesPoint[];
  rainfall: TimeSeriesPoint[];
  commonStart: number;
  commonEnd: number;
  recordsAligned: number;
  recordsInterpolated: number;
}

export interface RainfallEvent {
  id: string;
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  totalDepth: number;
  duration: number;
  peakIntensity: number;
  antecedentDryPeriod: number;
  antecedentMoisture: number;
}

export interface DryDay {
  date: string;
  dayOfWeek: number;
  isWeekend: boolean;
  season: string;
  meanFlow: number;
  minFlow: number;
  maxFlow: number;
}

export interface MNFResult {
  meanMNF: number;
  medianMNF: number;
  minMNF: number;
  stdDevMNF: number;
  nightFlows: number[];
  monthlyMNF: number[];
  gwiEstimate: number;
  gwiPerInchMile: number;
}

export interface GWIModelResult {
  type: 'constant' | 'monthly' | 'sinusoidal';
  values: number[];
  mean: number;
  amplitude?: number;
  phaseDay?: number;
  monthlyValues?: number[];
}

export interface BSFResult {
  method: 'per_capita' | 'direct' | 'billing';
  bsf: number;
  gwi: number;
  totalDWF: number;
  population?: number;
  gpcd?: number;
}

export interface DWFPattern {
  hourlyMultipliers: number[];
  weekdayMultipliers: number[];
  weekendMultipliers: number[];
  peakHour: number;
  peakFactor: number;
  minHour: number;
  minFactor: number;
}

export interface RValueResult {
  totalR: number;
  rByEvent: { eventId: string; rValue: number; volume: number; rainfall: number }[];
  meanR: number;
  medianR: number;
  stdDevR: number;
}

export interface VolumeBalance {
  totalMonitored: number;
  totalDWF: number;
  totalGWI: number;
  totalBSF: number;
  totalRDII: number;
  rdiiPercent: number;
  gwiPercent: number;
  bsfPercent: number;
  closureError: number;
}

export interface GoodnessOfFit {
  nse: number;
  kge: number;
  r2: number;
  rmse: number;
  pbias: number;
  peakError: number;
  volumeError: number;
  mae: number;
  dIndex: number;
}

export interface SensitivityResult {
  parameter: string;
  baseValue: number;
  values: number[];
  objectives: number[];
  sensitivity: number;
}

export interface EventCharacterization {
  eventId: string;
  date: string;
  depth: number;
  duration: number;
  peakIntensity: number;
  adpDays: number;
  api: number;
  rdiiVolume: number;
  rValue: number;
  peakRDII: number;
  selected: boolean;
}

export interface CrossValidationResult {
  calibrationEvents: string[];
  validationEvents: string[];
  calibrationMetrics: GoodnessOfFit;
  validationMetrics: GoodnessOfFit;
  parameterStability: number;
  recommendation: string;
}

export function detectGaps(
  data: TimeSeriesPoint[],
  options: {
    flatlineThresholdHours?: number;
    zeroFlowThresholdHours?: number;
  } = {}
): GapInfo[] {
  const { flatlineThresholdHours = 6, zeroFlowThresholdHours = 2 } = options;
  const gaps: GapInfo[] = [];
  if (data.length < 2) return gaps;

  const expectedStep = data[1].timestamp - data[0].timestamp;

  for (let i = 1; i < data.length; i++) {
    const dt = data[i].timestamp - data[i - 1].timestamp;
    if (dt > expectedStep * 1.5) {
      gaps.push({
        startIndex: i - 1,
        endIndex: i,
        startTime: data[i - 1].timestamp,
        endTime: data[i].timestamp,
        durationHours: dt / 3600000,
        type: 'missing',
      });
    }
  }

  let flatStart = 0;
  for (let i = 1; i < data.length; i++) {
    if (Math.abs(data[i].value - data[flatStart].value) < 0.001) {
      const dur = (data[i].timestamp - data[flatStart].timestamp) / 3600000;
      if (dur >= flatlineThresholdHours && i === data.length - 1 || (i < data.length - 1 && Math.abs(data[i + 1].value - data[flatStart].value) >= 0.001)) {
        if (dur >= flatlineThresholdHours) {
          gaps.push({
            startIndex: flatStart,
            endIndex: i,
            startTime: data[flatStart].timestamp,
            endTime: data[i].timestamp,
            durationHours: dur,
            type: 'flatline',
          });
        }
        flatStart = i + 1;
      }
    } else {
      flatStart = i;
    }
  }

  let zeroStart = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].value <= 0.001) {
      if (zeroStart < 0) zeroStart = i;
    } else {
      if (zeroStart >= 0) {
        const dur = (data[i - 1].timestamp - data[zeroStart].timestamp) / 3600000;
        if (dur >= zeroFlowThresholdHours) {
          gaps.push({
            startIndex: zeroStart,
            endIndex: i - 1,
            startTime: data[zeroStart].timestamp,
            endTime: data[i - 1].timestamp,
            durationHours: dur,
            type: 'zero',
          });
        }
        zeroStart = -1;
      }
    }
  }

  return gaps;
}

export function fillGaps(
  data: TimeSeriesPoint[],
  gaps: GapInfo[],
  method: 'linear' | 'spline' | 'pattern' | 'none' = 'linear',
  maxGapHours: number = 4,
  dwfPattern?: number[]
): GapFillResult {
  const filled = data.map(p => ({ ...p }));
  let recordsFilled = 0;
  let recordsFlagged = 0;

  for (const gap of gaps) {
    if (gap.type !== 'missing') continue;
    if (gap.durationHours > maxGapHours) {
      recordsFlagged++;
      continue;
    }

    if (method === 'none') {
      recordsFlagged++;
      continue;
    }

    if (method === 'linear') {
      const startVal = filled[gap.startIndex].value;
      const endVal = filled[gap.endIndex].value;
      const startTime = filled[gap.startIndex].timestamp;
      const endTime = filled[gap.endIndex].timestamp;
      const step = data.length > 1 ? data[1].timestamp - data[0].timestamp : 3600000;

      for (let t = startTime + step; t < endTime; t += step) {
        const frac = (t - startTime) / (endTime - startTime);
        filled.push({ timestamp: t, value: startVal + frac * (endVal - startVal) });
        recordsFilled++;
      }
    } else if (method === 'pattern' && dwfPattern && dwfPattern.length === 24) {
      const step = data.length > 1 ? data[1].timestamp - data[0].timestamp : 3600000;
      const startTime = filled[gap.startIndex].timestamp;
      const endTime = filled[gap.endIndex].timestamp;
      const baseMean = filled[gap.startIndex].value;

      for (let t = startTime + step; t < endTime; t += step) {
        const hour = new Date(t).getHours();
        filled.push({ timestamp: t, value: baseMean * dwfPattern[hour] });
        recordsFilled++;
      }
    }
  }

  filled.sort((a, b) => a.timestamp - b.timestamp);
  return { filled, gaps, recordsFilled, recordsFlagged };
}

export function detectOutliers(
  data: TimeSeriesPoint[],
  options: {
    method?: 'zscore' | 'modified_zscore' | 'iqr';
    zScoreThreshold?: number;
    iqrMultiplier?: number;
    maxFlow?: number;
    maxDqDt?: number;
    checkNegative?: boolean;
  } = {}
): OutlierResult {
  const {
    method = 'zscore',
    zScoreThreshold = 3.0,
    iqrMultiplier = 1.5,
    maxFlow,
    maxDqDt,
    checkNegative = true,
  } = options;

  const values = data.map(d => d.value);
  const outliers: OutlierInfo[] = [];

  if (checkNegative) {
    data.forEach((d, i) => {
      if (d.value < 0) {
        outliers.push({
          index: i, timestamp: d.timestamp, value: d.value,
          method: 'physical', reason: 'Negative flow', severity: 'critical',
        });
      }
    });
  }

  if (maxFlow !== undefined) {
    data.forEach((d, i) => {
      if (d.value > maxFlow) {
        outliers.push({
          index: i, timestamp: d.timestamp, value: d.value,
          method: 'physical', reason: `Exceeds max capacity (${maxFlow})`, severity: 'critical',
        });
      }
    });
  }

  if (maxDqDt !== undefined) {
    for (let i = 1; i < data.length; i++) {
      const dt = (data[i].timestamp - data[i - 1].timestamp) / 60000;
      if (dt > 0) {
        const dq = Math.abs(data[i].value - data[i - 1].value) / dt;
        if (dq > maxDqDt) {
          outliers.push({
            index: i, timestamp: data[i].timestamp, value: data[i].value,
            method: 'physical', reason: `Rate of change ${dq.toFixed(2)} exceeds ${maxDqDt}`, severity: 'warning',
          });
        }
      }
    }
  }

  const mean = values.reduce((s, v) => s + v, 0) / values.length;

  if (method === 'zscore') {
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    if (std > 0) {
      data.forEach((d, i) => {
        const z = Math.abs((d.value - mean) / std);
        if (z > zScoreThreshold) {
          outliers.push({
            index: i, timestamp: d.timestamp, value: d.value,
            method: 'zscore', reason: `Z-score = ${z.toFixed(2)}`, severity: z > 5 ? 'critical' : 'warning',
          });
        }
      });
    }
  } else if (method === 'modified_zscore') {
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mad = sorted.map(v => Math.abs(v - median)).sort((a, b) => a - b)[Math.floor(sorted.length / 2)];
    if (mad > 0) {
      data.forEach((d, i) => {
        const mz = 0.6745 * Math.abs(d.value - median) / mad;
        if (mz > zScoreThreshold) {
          outliers.push({
            index: i, timestamp: d.timestamp, value: d.value,
            method: 'modified_zscore', reason: `Modified Z = ${mz.toFixed(2)}`, severity: mz > 5 ? 'critical' : 'warning',
          });
        }
      });
    }
  } else if (method === 'iqr') {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - iqrMultiplier * iqr;
    const upper = q3 + iqrMultiplier * iqr;
    data.forEach((d, i) => {
      if (d.value < lower || d.value > upper) {
        outliers.push({
          index: i, timestamp: d.timestamp, value: d.value,
          method: 'iqr', reason: `Outside IQR fence [${lower.toFixed(2)}, ${upper.toFixed(2)}]`, severity: 'warning',
        });
      }
    });
  }

  const outlierIndices = new Set(outliers.map(o => o.index));
  const cleaned = data.map((d, i) => {
    if (outlierIndices.has(i)) {
      const prev = i > 0 ? data[i - 1].value : d.value;
      const next = i < data.length - 1 ? data[i + 1].value : d.value;
      return { ...d, value: (prev + next) / 2 };
    }
    return { ...d };
  });

  return { cleaned, outliers };
}

export function alignTimeSeries(
  flow: TimeSeriesPoint[],
  rainfall: TimeSeriesPoint[],
  targetStepMinutes: number = 15,
  flowAggMethod: 'average' | 'instantaneous' = 'average',
  rainAggMethod: 'sum' | 'average' = 'sum'
): AlignmentResult {
  if (flow.length === 0 || rainfall.length === 0) {
    return { flow: [], rainfall: [], commonStart: 0, commonEnd: 0, recordsAligned: 0, recordsInterpolated: 0 };
  }

  const stepMs = targetStepMinutes * 60000;
  const commonStart = Math.max(flow[0].timestamp, rainfall[0].timestamp);
  const commonEnd = Math.min(flow[flow.length - 1].timestamp, rainfall[rainfall.length - 1].timestamp);

  const alignedFlow: TimeSeriesPoint[] = [];
  const alignedRain: TimeSeriesPoint[] = [];
  let recordsInterpolated = 0;

  for (let t = commonStart; t <= commonEnd; t += stepMs) {
    const fVal = interpolateAt(flow, t, flowAggMethod === 'average');
    alignedFlow.push({ timestamp: t, value: fVal.value });
    if (fVal.interpolated) recordsInterpolated++;

    const rVal = aggregateRainfallAt(rainfall, t, stepMs, rainAggMethod);
    alignedRain.push({ timestamp: t, value: rVal });
  }

  return {
    flow: alignedFlow,
    rainfall: alignedRain,
    commonStart,
    commonEnd,
    recordsAligned: alignedFlow.length,
    recordsInterpolated,
  };
}

function interpolateAt(data: TimeSeriesPoint[], t: number, doAverage: boolean): { value: number; interpolated: boolean } {
  const exactIdx = data.findIndex(d => d.timestamp === t);
  if (exactIdx >= 0) return { value: data[exactIdx].value, interpolated: false };

  let lo = 0, hi = data.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (data[mid].timestamp <= t) lo = mid;
    else hi = mid;
  }

  if (lo >= data.length - 1) return { value: data[data.length - 1].value, interpolated: true };
  const frac = (t - data[lo].timestamp) / (data[hi].timestamp - data[lo].timestamp);
  return { value: data[lo].value + frac * (data[hi].value - data[lo].value), interpolated: true };
}

function aggregateRainfallAt(data: TimeSeriesPoint[], t: number, stepMs: number, method: 'sum' | 'average'): number {
  const windowStart = t;
  const windowEnd = t + stepMs;
  const inWindow = data.filter(d => d.timestamp >= windowStart && d.timestamp < windowEnd);
  if (inWindow.length === 0) return 0;
  const total = inWindow.reduce((s, d) => s + d.value, 0);
  return method === 'sum' ? total : total / inWindow.length;
}

export function delineateRainfallEvents(
  rainfall: TimeSeriesPoint[],
  options: {
    minInterEventHours?: number;
    minDepth?: number;
    minDurationHours?: number;
    recoveryHours?: number;
  } = {}
): RainfallEvent[] {
  const {
    minInterEventHours = 6,
    minDepth = 0.10,
    minDurationHours = 1,
    recoveryHours = 12,
  } = options;

  const mitMs = minInterEventHours * 3600000;
  const events: RainfallEvent[] = [];

  const wetIndices = rainfall.reduce<number[]>((acc, r, i) => {
    if (r.value > 0.001) acc.push(i);
    return acc;
  }, []);

  if (wetIndices.length === 0) return events;

  let eventStart = wetIndices[0];
  let eventEnd = wetIndices[0];

  for (let i = 1; i < wetIndices.length; i++) {
    const gap = rainfall[wetIndices[i]].timestamp - rainfall[wetIndices[i - 1]].timestamp;
    if (gap > mitMs) {
      addEvent(eventStart, eventEnd);
      eventStart = wetIndices[i];
    }
    eventEnd = wetIndices[i];
  }
  addEvent(eventStart, eventEnd);

  function addEvent(si: number, ei: number) {
    const totalDepth = rainfall.slice(si, ei + 1).reduce((s, r) => s + r.value, 0);
    const duration = (rainfall[ei].timestamp - rainfall[si].timestamp) / 3600000;
    if (totalDepth < minDepth || duration < minDurationHours) return;

    const step = rainfall.length > 1 ? (rainfall[1].timestamp - rainfall[0].timestamp) / 3600000 : 1;
    const peakIntensity = Math.max(...rainfall.slice(si, ei + 1).map(r => r.value / step));

    let adp = 0;
    if (si > 0) {
      for (let j = si - 1; j >= 0; j--) {
        if (rainfall[j].value > 0.001) {
          adp = (rainfall[si].timestamp - rainfall[j].timestamp) / 3600000;
          break;
        }
        if (j === 0) adp = (rainfall[si].timestamp - rainfall[0].timestamp) / 3600000;
      }
    }

    events.push({
      id: `E${String(events.length + 1).padStart(2, '0')}`,
      startIndex: si,
      endIndex: ei,
      startTime: rainfall[si].timestamp,
      endTime: rainfall[ei].timestamp,
      totalDepth,
      duration,
      peakIntensity,
      antecedentDryPeriod: adp,
      antecedentMoisture: 0,
    });
  }

  return events;
}

export function selectDryDays(
  flow: TimeSeriesPoint[],
  rainfall: TimeSeriesPoint[],
  options: {
    antecedentDryHours?: number;
    subsequentDryHours?: number;
    excludeHolidays?: boolean;
    holidayDates?: string[];
    anomalyThreshold?: number;
  } = {}
): DryDay[] {
  const {
    antecedentDryHours = 48,
    subsequentDryHours = 12,
    anomalyThreshold = 1.5,
  } = options;

  const dayMap = new Map<string, { flows: number[]; hasRain: boolean }>();

  flow.forEach(f => {
    const d = new Date(f.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!dayMap.has(key)) dayMap.set(key, { flows: [], hasRain: false });
    dayMap.get(key)!.flows.push(f.value);
  });

  rainfall.forEach(r => {
    if (r.value > 0.001) {
      const d = new Date(r.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dayMap.has(key)) dayMap.get(key)!.hasRain = true;

      const antHours = antecedentDryHours / 24;
      const subHours = subsequentDryHours / 24;
      for (let dd = -Math.ceil(subHours); dd <= Math.ceil(antHours); dd++) {
        if (dd === 0) continue;
        const nd = new Date(r.timestamp + dd * 86400000);
        const nk = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`;
        if (dayMap.has(nk)) dayMap.get(nk)!.hasRain = true;
      }
    }
  });

  const allFlows = flow.map(f => f.value);
  const median = [...allFlows].sort((a, b) => a - b)[Math.floor(allFlows.length / 2)];

  const dryDays: DryDay[] = [];
  dayMap.forEach((data, key) => {
    if (data.hasRain || data.flows.length === 0) return;
    const mean = data.flows.reduce((s, v) => s + v, 0) / data.flows.length;
    if (mean > anomalyThreshold * median) return;

    const d = new Date(key + 'T12:00:00');
    const dow = d.getDay();
    const month = d.getMonth();
    const season = month <= 1 || month === 11 ? 'Winter' : month <= 4 ? 'Spring' : month <= 7 ? 'Summer' : 'Fall';

    dryDays.push({
      date: key,
      dayOfWeek: dow,
      isWeekend: dow === 0 || dow === 6,
      season,
      meanFlow: mean,
      minFlow: Math.min(...data.flows),
      maxFlow: Math.max(...data.flows),
    });
  });

  return dryDays.sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateAntecedentMoisture(
  rainfall: TimeSeriesPoint[],
  method: 'api' | '5day' | 'amc' = 'api',
  decayFactor: number = 0.90,
  lookbackDays: number = 5
): TimeSeriesPoint[] {
  const result: TimeSeriesPoint[] = [];
  const dayStep = 86400000;

  if (rainfall.length === 0) return result;

  const dailyRain = new Map<string, number>();
  rainfall.forEach(r => {
    const d = new Date(r.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dailyRain.set(key, (dailyRain.get(key) || 0) + r.value);
  });

  const days = Array.from(dailyRain.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  if (method === 'api') {
    let api = 0;
    days.forEach(([dateStr, rain]) => {
      api = decayFactor * api + rain;
      result.push({ timestamp: new Date(dateStr + 'T12:00:00').getTime(), value: api });
    });
  } else if (method === '5day') {
    days.forEach(([dateStr], i) => {
      let sum = 0;
      for (let j = Math.max(0, i - lookbackDays); j < i; j++) {
        sum += days[j][1];
      }
      result.push({ timestamp: new Date(dateStr + 'T12:00:00').getTime(), value: sum });
    });
  } else {
    days.forEach(([dateStr], i) => {
      let sum5 = 0;
      for (let j = Math.max(0, i - 5); j < i; j++) {
        sum5 += days[j][1];
      }
      const amc = sum5 < 0.5 ? 1 : sum5 <= 1.1 ? 2 : 3;
      result.push({ timestamp: new Date(dateStr + 'T12:00:00').getTime(), value: amc });
    });
  }

  return result;
}

export function analyzeMNF(
  flow: TimeSeriesPoint[],
  dryDays: DryDay[],
  options: {
    nightStart?: number;
    nightEnd?: number;
    method?: 'min' | 'mean' | 'median' | 'p10' | 'rolling_min';
    gwiFactor?: number;
    rollingWindow?: number;
    pipeInchMiles?: number;
  } = {}
): MNFResult {
  const {
    nightStart = 0,
    nightEnd = 5,
    method = 'median',
    gwiFactor = 0.90,
    pipeInchMiles = 100,
  } = options;

  const dryDaySet = new Set(dryDays.map(d => d.date));
  const nightFlows: number[] = [];
  const monthlyNight: number[][] = Array.from({ length: 12 }, () => []);

  flow.forEach(f => {
    const d = new Date(f.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!dryDaySet.has(key)) return;

    const hour = d.getHours();
    if ((nightStart <= nightEnd && hour >= nightStart && hour < nightEnd) ||
        (nightStart > nightEnd && (hour >= nightStart || hour < nightEnd))) {
      nightFlows.push(f.value);
      monthlyNight[d.getMonth()].push(f.value);
    }
  });

  if (nightFlows.length === 0) {
    return { meanMNF: 0, medianMNF: 0, minMNF: 0, stdDevMNF: 0, nightFlows: [], monthlyMNF: new Array(12).fill(0), gwiEstimate: 0, gwiPerInchMile: 0 };
  }

  const sorted = [...nightFlows].sort((a, b) => a - b);
  const meanMNF = nightFlows.reduce((s, v) => s + v, 0) / nightFlows.length;
  const medianMNF = sorted[Math.floor(sorted.length / 2)];
  const minMNF = sorted[0];
  const stdDevMNF = Math.sqrt(nightFlows.reduce((s, v) => s + (v - meanMNF) ** 2, 0) / nightFlows.length);

  let resultMNF: number;
  if (method === 'min') resultMNF = minMNF;
  else if (method === 'mean') resultMNF = meanMNF;
  else if (method === 'p10') resultMNF = sorted[Math.floor(sorted.length * 0.1)];
  else resultMNF = medianMNF;

  const monthlyMNF = monthlyNight.map(arr => {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  });

  const gwiEstimate = resultMNF * gwiFactor;
  const gwiPerInchMile = pipeInchMiles > 0 ? (gwiEstimate * 1e6) / pipeInchMiles : 0;

  return { meanMNF, medianMNF, minMNF, stdDevMNF, nightFlows, monthlyMNF, gwiEstimate, gwiPerInchMile };
}

export function buildGWIModel(
  mnfResult: MNFResult,
  modelType: 'constant' | 'monthly' | 'sinusoidal' = 'constant'
): GWIModelResult {
  if (modelType === 'constant') {
    return {
      type: 'constant',
      values: new Array(12).fill(mnfResult.gwiEstimate),
      mean: mnfResult.gwiEstimate,
    };
  }

  if (modelType === 'monthly') {
    const factor = mnfResult.gwiEstimate > 0 && mnfResult.medianMNF > 0 ? mnfResult.gwiEstimate / mnfResult.medianMNF : 0.9;
    const monthlyValues = mnfResult.monthlyMNF.map(v => v * factor || mnfResult.gwiEstimate);
    return {
      type: 'monthly',
      values: monthlyValues,
      mean: monthlyValues.reduce((s, v) => s + v, 0) / 12,
      monthlyValues,
    };
  }

  const vals = mnfResult.monthlyMNF.filter(v => v > 0);
  const gwiMean = mnfResult.gwiEstimate;
  let maxIdx = 0;
  let maxVal = 0;
  mnfResult.monthlyMNF.forEach((v, i) => {
    if (v > maxVal) { maxVal = v; maxIdx = i; }
  });

  const amplitude = vals.length > 0 ? (Math.max(...vals) - Math.min(...vals)) * 0.45 : gwiMean * 0.2;
  const phaseDay = maxIdx * 30 + 15;

  const sinValues = Array.from({ length: 12 }, (_, i) => {
    const dayOfYear = i * 30 + 15;
    return Math.max(0, gwiMean + amplitude * Math.sin(2 * Math.PI * (dayOfYear - phaseDay) / 365));
  });

  return {
    type: 'sinusoidal',
    values: sinValues,
    mean: gwiMean,
    amplitude,
    phaseDay,
  };
}

export function calculateBSF(
  meanDWF: number,
  gwi: number,
  method: 'per_capita' | 'direct' | 'billing' = 'direct',
  options: { population?: number; gpcd?: number; billedWater?: number; returnFactor?: number } = {}
): BSFResult {
  if (method === 'per_capita') {
    const pop = options.population || 10000;
    const gpcd = options.gpcd || 80;
    const bsf = (pop * gpcd) / 1e6;
    return { method, bsf, gwi, totalDWF: bsf + gwi, population: pop, gpcd };
  }

  if (method === 'billing') {
    const billed = options.billedWater || 1.0;
    const rf = options.returnFactor || 0.85;
    const bsf = billed * rf;
    return { method, bsf, gwi, totalDWF: bsf + gwi };
  }

  const bsf = Math.max(0, meanDWF - gwi);
  return { method, bsf, gwi, totalDWF: bsf + gwi };
}

export function extractDWFPattern(
  flow: TimeSeriesPoint[],
  dryDays: DryDay[],
  options: { separateWeekend?: boolean; percentile?: number } = {}
): DWFPattern {
  const { separateWeekend = true, percentile = 50 } = options;
  const dryDaySet = new Set(dryDays.map(d => d.date));

  const hourlyAll: number[][] = Array.from({ length: 24 }, () => []);
  const hourlyWd: number[][] = Array.from({ length: 24 }, () => []);
  const hourlyWe: number[][] = Array.from({ length: 24 }, () => []);

  flow.forEach(f => {
    const d = new Date(f.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!dryDaySet.has(key)) return;

    const hour = d.getHours();
    hourlyAll[hour].push(f.value);

    if (d.getDay() === 0 || d.getDay() === 6) {
      hourlyWe[hour].push(f.value);
    } else {
      hourlyWd[hour].push(f.value);
    }
  });

  function getPercentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * p / 100);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  const hourlyValues = hourlyAll.map(arr => getPercentile(arr, percentile));
  const totalMean = hourlyValues.reduce((s, v) => s + v, 0) / 24;
  const multipliers = hourlyValues.map(v => totalMean > 0 ? v / totalMean : 1);

  const wdValues = hourlyWd.map(arr => getPercentile(arr, percentile));
  const wdMean = wdValues.reduce((s, v) => s + v, 0) / 24;
  const wdMult = wdValues.map(v => wdMean > 0 ? v / wdMean : 1);

  const weValues = hourlyWe.map(arr => getPercentile(arr, percentile));
  const weMean = weValues.reduce((s, v) => s + v, 0) / 24;
  const weMult = weValues.map(v => weMean > 0 ? v / weMean : 1);

  const peakIdx = multipliers.indexOf(Math.max(...multipliers));
  const minIdx = multipliers.indexOf(Math.min(...multipliers));

  return {
    hourlyMultipliers: multipliers,
    weekdayMultipliers: wdMult,
    weekendMultipliers: weMult,
    peakHour: peakIdx,
    peakFactor: multipliers[peakIdx],
    minHour: minIdx,
    minFactor: multipliers[minIdx],
  };
}

export function reconstructDWF(
  timestamps: number[],
  bsf: number,
  gwi: number | number[],
  pattern: DWFPattern,
  separateWeekend: boolean = true
): TimeSeriesPoint[] {
  return timestamps.map(t => {
    const d = new Date(t);
    const hour = d.getHours();
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const mult = separateWeekend
      ? (isWeekend ? pattern.weekendMultipliers[hour] : pattern.weekdayMultipliers[hour])
      : pattern.hourlyMultipliers[hour];
    const gwiVal = Array.isArray(gwi) ? gwi[d.getMonth()] : gwi;
    return { timestamp: t, value: gwiVal + bsf * mult };
  });
}

export function extractRDII(
  totalFlow: TimeSeriesPoint[],
  dwfFlow: TimeSeriesPoint[]
): TimeSeriesPoint[] {
  return totalFlow.map((f, i) => ({
    timestamp: f.timestamp,
    value: Math.max(0, f.value - (dwfFlow[i]?.value || 0)),
  }));
}

export function calculateRValues(
  rdii: TimeSeriesPoint[],
  rainfall: TimeSeriesPoint[],
  events: RainfallEvent[],
  sewershedAreaAcres: number
): RValueResult {
  const rByEvent = events.map(evt => {
    const rdiiSlice = rdii.filter(r => r.timestamp >= evt.startTime && r.timestamp <= evt.endTime + 24 * 3600000);
    const step = rdii.length > 1 ? (rdii[1].timestamp - rdii[0].timestamp) / 3600000 : 1;
    const rdiiVol = rdiiSlice.reduce((s, r) => s + r.value * step, 0);
    const rainVol = evt.totalDepth * sewershedAreaAcres * 27154;

    return {
      eventId: evt.id,
      rValue: rainVol > 0 ? (rdiiVol / rainVol) * 100 : 0,
      volume: rdiiVol,
      rainfall: evt.totalDepth,
    };
  });

  const rValues = rByEvent.map(r => r.rValue).filter(r => r > 0);
  const sorted = [...rValues].sort((a, b) => a - b);
  const meanR = rValues.length > 0 ? rValues.reduce((s, v) => s + v, 0) / rValues.length : 0;
  const medianR = rValues.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
  const stdDevR = rValues.length > 0 ? Math.sqrt(rValues.reduce((s, v) => s + (v - meanR) ** 2, 0) / rValues.length) : 0;

  return {
    totalR: meanR,
    rByEvent,
    meanR,
    medianR,
    stdDevR,
  };
}

export function calculateVolumeBalance(
  totalFlow: TimeSeriesPoint[],
  dwfFlow: TimeSeriesPoint[],
  gwi: number,
  bsf: number,
  rdii: TimeSeriesPoint[],
  stepHours: number
): VolumeBalance {
  const totalVol = totalFlow.reduce((s, f) => s + f.value * stepHours, 0);
  const dwfVol = dwfFlow.reduce((s, f) => s + f.value * stepHours, 0);
  const rdiiVol = rdii.reduce((s, f) => s + f.value * stepHours, 0);
  const gwiVol = gwi * totalFlow.length * stepHours;
  const bsfVol = bsf * totalFlow.length * stepHours;

  return {
    totalMonitored: totalVol,
    totalDWF: dwfVol,
    totalGWI: gwiVol,
    totalBSF: bsfVol,
    totalRDII: rdiiVol,
    rdiiPercent: totalVol > 0 ? (rdiiVol / totalVol) * 100 : 0,
    gwiPercent: totalVol > 0 ? (gwiVol / totalVol) * 100 : 0,
    bsfPercent: totalVol > 0 ? (bsfVol / totalVol) * 100 : 0,
    closureError: totalVol > 0 ? Math.abs(totalVol - dwfVol - rdiiVol) / totalVol * 100 : 0,
  };
}

export function calculateGoodnessOfFit(observed: number[], simulated: number[]): GoodnessOfFit {
  const n = Math.min(observed.length, simulated.length);
  if (n === 0) return { nse: 0, kge: 0, r2: 0, rmse: 0, pbias: 0, peakError: 0, volumeError: 0, mae: 0, dIndex: 0 };

  const obs = observed.slice(0, n);
  const sim = simulated.slice(0, n);
  const meanObs = obs.reduce((s, v) => s + v, 0) / n;
  const meanSim = sim.reduce((s, v) => s + v, 0) / n;

  let ssRes = 0, ssTot = 0, sumSqErr = 0, sumAbsErr = 0;
  let sumProd = 0, sumObsSq = 0, sumSimSq = 0;
  let sumObs = 0, sumSim = 0;
  let denomD = 0;

  for (let i = 0; i < n; i++) {
    const diff = obs[i] - sim[i];
    ssRes += diff * diff;
    ssTot += (obs[i] - meanObs) ** 2;
    sumSqErr += diff * diff;
    sumAbsErr += Math.abs(diff);
    sumProd += (obs[i] - meanObs) * (sim[i] - meanSim);
    sumObsSq += (obs[i] - meanObs) ** 2;
    sumSimSq += (sim[i] - meanSim) ** 2;
    sumObs += obs[i];
    sumSim += sim[i];
    denomD += (Math.abs(sim[i] - meanObs) + Math.abs(obs[i] - meanObs)) ** 2;
  }

  const nse = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const rmse = Math.sqrt(sumSqErr / n);
  const mae = sumAbsErr / n;
  const pbias = sumObs > 0 ? ((sumSim - sumObs) / sumObs) * 100 : 0;

  const r = (sumObsSq > 0 && sumSimSq > 0) ? sumProd / Math.sqrt(sumObsSq * sumSimSq) : 0;
  const r2 = r * r;

  const stdObs = Math.sqrt(sumObsSq / n);
  const stdSim = Math.sqrt(sumSimSq / n);
  const beta = meanObs > 0 ? meanSim / meanObs : 1;
  const gamma = meanObs > 0 && stdObs > 0 ? (stdSim / meanSim) / (stdObs / meanObs) : 1;
  const kge = 1 - Math.sqrt((r - 1) ** 2 + (beta - 1) ** 2 + (gamma - 1) ** 2);

  const peakObs = Math.max(...obs);
  const peakSim = Math.max(...sim);
  const peakError = peakObs > 0 ? ((peakSim - peakObs) / peakObs) * 100 : 0;

  const volObs = obs.reduce((s, v) => s + v, 0);
  const volSim = sim.reduce((s, v) => s + v, 0);
  const volumeError = volObs > 0 ? ((volSim - volObs) / volObs) * 100 : 0;

  const dIndex = denomD > 0 ? 1 - ssRes / denomD : 0;

  return { nse, kge, r2, rmse, pbias, peakError, volumeError, mae, dIndex };
}

export function runSensitivityOAT(
  baseParams: { R1: number; T1: number; K1: number; R2: number; T2: number; K2: number; R3: number; T3: number; K3: number },
  rainfall: number[],
  observed: number[],
  timeStep: number,
  perturbation: number = 0.2
): SensitivityResult[] {
  const paramNames = Object.keys(baseParams) as (keyof typeof baseParams)[];
  const results: SensitivityResult[] = [];

  function simulate(params: typeof baseParams): number[] {
    const uh1 = generateTriangularUH(params.T1, params.K1, timeStep);
    const uh2 = generateTriangularUH(params.T2, params.K2, timeStep);
    const uh3 = generateTriangularUH(params.T3, params.K3, timeStep);

    const rdii1 = convolve(rainfall, uh1).map(v => v * params.R1);
    const rdii2 = convolve(rainfall, uh2).map(v => v * params.R2);
    const rdii3 = convolve(rainfall, uh3).map(v => v * params.R3);

    const n = Math.min(rdii1.length, rdii2.length, rdii3.length, observed.length);
    return Array.from({ length: n }, (_, i) => (rdii1[i] || 0) + (rdii2[i] || 0) + (rdii3[i] || 0));
  }

  const baseNSE = calculateGoodnessOfFit(observed, simulate(baseParams)).nse;

  for (const param of paramNames) {
    const baseVal = baseParams[param];
    const steps = 11;
    const values: number[] = [];
    const objectives: number[] = [];

    for (let i = 0; i < steps; i++) {
      const factor = 1 - perturbation + (2 * perturbation * i) / (steps - 1);
      const testVal = baseVal * factor;
      values.push(testVal);

      const testParams = { ...baseParams, [param]: testVal };
      const sim = simulate(testParams);
      objectives.push(calculateGoodnessOfFit(observed, sim).nse);
    }

    const maxChange = Math.max(...objectives) - Math.min(...objectives);
    results.push({
      parameter: param,
      baseValue: baseVal,
      values,
      objectives,
      sensitivity: maxChange,
    });
  }

  return results.sort((a, b) => b.sensitivity - a.sensitivity);
}

export function generateTriangularUH(T: number, K: number, timeStep: number): number[] {
  const tp = T;
  const tb = T * K;
  const n = Math.ceil(tb / timeStep) + 1;
  const uh: number[] = [];

  for (let i = 0; i < n; i++) {
    const t = i * timeStep;
    if (t <= tp) {
      uh.push(t / tp);
    } else if (t <= tb) {
      uh.push((tb - t) / (tb - tp));
    } else {
      uh.push(0);
    }
  }

  const sum = uh.reduce((s, v) => s + v, 0);
  if (sum > 0) return uh.map(v => v / sum);
  return uh;
}

export function convolve(input: number[], kernel: number[]): number[] {
  const n = input.length + kernel.length - 1;
  const result = new Array(n).fill(0);
  for (let i = 0; i < input.length; i++) {
    for (let j = 0; j < kernel.length; j++) {
      result[i + j] += input[i] * kernel[j];
    }
  }
  return result;
}

export function characterizeEvents(
  events: RainfallEvent[],
  rdii: TimeSeriesPoint[],
  rainfall: TimeSeriesPoint[],
  moistureIndex: TimeSeriesPoint[],
  sewershedAreaAcres: number
): EventCharacterization[] {
  return events.map(evt => {
    const rdiiSlice = rdii.filter(r => r.timestamp >= evt.startTime && r.timestamp <= evt.endTime + 24 * 3600000);
    const step = rdii.length > 1 ? (rdii[1].timestamp - rdii[0].timestamp) / 3600000 : 1;
    const rdiiVolume = rdiiSlice.reduce((s, r) => s + r.value * step, 0);
    const peakRDII = rdiiSlice.length > 0 ? Math.max(...rdiiSlice.map(r => r.value)) : 0;
    const rainVol = evt.totalDepth * sewershedAreaAcres * 27154;
    const rValue = rainVol > 0 ? (rdiiVolume / rainVol) * 100 : 0;

    const api = moistureIndex.find(m => Math.abs(m.timestamp - evt.startTime) < 86400000)?.value || 0;
    const d = new Date(evt.startTime);
    const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;

    return {
      eventId: evt.id,
      date: dateStr,
      depth: evt.totalDepth,
      duration: evt.duration,
      peakIntensity: evt.peakIntensity,
      adpDays: evt.antecedentDryPeriod / 24,
      api,
      rdiiVolume,
      rValue,
      peakRDII,
      selected: true,
    };
  });
}

export function getPerformanceRating(metric: string, value: number): { rating: string; color: string } {
  if (metric === 'nse' || metric === 'kge') {
    if (value >= 0.75) return { rating: 'Very Good', color: 'green' };
    if (value >= 0.65) return { rating: 'Good', color: 'blue' };
    if (value >= 0.50) return { rating: 'Satisfactory', color: 'yellow' };
    return { rating: 'Unsatisfactory', color: 'red' };
  }
  if (metric === 'r2') {
    if (value >= 0.85) return { rating: 'Very Good', color: 'green' };
    if (value >= 0.70) return { rating: 'Good', color: 'blue' };
    if (value >= 0.50) return { rating: 'Satisfactory', color: 'yellow' };
    return { rating: 'Unsatisfactory', color: 'red' };
  }
  if (metric === 'pbias' || metric === 'peakError' || metric === 'volumeError') {
    const abs = Math.abs(value);
    if (abs <= 10) return { rating: 'Very Good', color: 'green' };
    if (abs <= 15) return { rating: 'Good', color: 'blue' };
    if (abs <= 25) return { rating: 'Satisfactory', color: 'yellow' };
    return { rating: 'Unsatisfactory', color: 'red' };
  }
  if (metric === 'dIndex') {
    if (value >= 0.90) return { rating: 'Very Good', color: 'green' };
    if (value >= 0.80) return { rating: 'Good', color: 'blue' };
    if (value >= 0.65) return { rating: 'Satisfactory', color: 'yellow' };
    return { rating: 'Unsatisfactory', color: 'red' };
  }
  return { rating: 'N/A', color: 'grey' };
}
