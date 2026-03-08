import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCalibrationData, type OptimizationResult } from "@/contexts/CalibrationDataContext";
import { Grid3X3 } from "lucide-react";

const PARAM_KEYS = ["R1", "T1", "K1", "R2", "T2", "K2", "R3", "T3", "K3"] as const;
type ParamKey = (typeof PARAM_KEYS)[number];

function extractParamVectors(results: OptimizationResult[]): Record<ParamKey, number[]> {
  const vectors: Record<string, number[]> = {};
  for (const key of PARAM_KEYS) {
    vectors[key] = results.map((r) => r.parameters[key]);
  }
  return vectors as Record<ParamKey, number[]>;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return 0;
  return num / den;
}

function correlationColor(r: number): string {
  const abs = Math.abs(r);
  const alpha = Math.round(abs * 60 + 10);
  if (r > 0) {
    return `hsl(0 70% 50% / ${alpha}%)`;
  }
  return `hsl(220 70% 50% / ${alpha}%)`;
}

function correlationTextColor(r: number): string {
  const abs = Math.abs(r);
  if (abs > 0.6) return "hsl(0 0% 100%)";
  return "hsl(var(--foreground))";
}

export function ParameterCorrelationMatrix() {
  const { optimizationResults } = useCalibrationData();

  const matrix = useMemo(() => {
    if (optimizationResults.length < 2) return null;
    const vectors = extractParamVectors(optimizationResults);
    const grid: number[][] = [];
    for (let i = 0; i < PARAM_KEYS.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < PARAM_KEYS.length; j++) {
        row.push(pearsonCorrelation(vectors[PARAM_KEYS[i]], vectors[PARAM_KEYS[j]]));
      }
      grid.push(row);
    }
    return grid;
  }, [optimizationResults]);

  if (optimizationResults.length < 2) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Grid3X3 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground" data-testid="text-correlation-empty">
            Need at least 2 calibration solutions to compute correlations.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!matrix) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-sm">Parameter Correlation Matrix</CardTitle>
            <CardDescription className="text-xs">
              Pairwise Pearson correlations across {optimizationResults.length} Pareto solutions
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-md" style={{ background: "hsl(0 70% 50% / 50%)" }} />
              <span className="text-xs text-muted-foreground">Positive</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-md" style={{ background: "hsl(220 70% 50% / 50%)" }} />
              <span className="text-xs text-muted-foreground">Negative</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" data-testid="table-correlation-matrix">
            <thead>
              <tr>
                <th className="p-1 text-xs font-medium text-muted-foreground w-12" />
                {PARAM_KEYS.map((key) => (
                  <th key={key} className="p-1 text-xs font-medium text-muted-foreground text-center w-12">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PARAM_KEYS.map((rowKey, i) => (
                <tr key={rowKey}>
                  <td className="p-1 text-xs font-medium text-muted-foreground text-right pr-2">{rowKey}</td>
                  {PARAM_KEYS.map((colKey, j) => {
                    const val = matrix[i][j];
                    return (
                      <td
                        key={colKey}
                        className="p-1 text-center"
                        data-testid={`cell-correlation-${rowKey}-${colKey}`}
                      >
                        <div
                          className="rounded-md flex items-center justify-center text-xs font-mono py-1.5 px-1 min-w-[2.5rem]"
                          style={{
                            backgroundColor: correlationColor(val),
                            color: correlationTextColor(val),
                          }}
                        >
                          {i === j ? "1.00" : val.toFixed(2)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
