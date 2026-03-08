import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

interface ParamBounds {
  R1: [number, number]; T1: [number, number]; K1: [number, number];
  R2: [number, number]; T2: [number, number]; K2: [number, number];
  R3: [number, number]; T3: [number, number]; K3: [number, number];
}

interface AutoConstraintDetectorProps {
  bounds: ParamBounds;
}

interface ConstraintCheck {
  label: string;
  description: string;
  passed: boolean;
  detail: string;
}

export function AutoConstraintDetector({ bounds }: AutoConstraintDetectorProps) {
  const constraints = useMemo<ConstraintCheck[]>(() => {
    const maxRSum = bounds.R1[1] + bounds.R2[1] + bounds.R3[1];
    const rSumPassed = maxRSum <= 1.0;

    const t1MaxLessThanT2Min = bounds.T1[1] < bounds.T2[0];
    const t2MaxLessThanT3Min = bounds.T2[1] < bounds.T3[0];
    const tOrderPassed = t1MaxLessThanT2Min && t2MaxLessThanT3Min;

    const k1MaxLessThanK2Min = bounds.K1[1] < bounds.K2[0];
    const k2MaxLessThanK3Min = bounds.K2[1] < bounds.K3[0];
    const kOrderPassed = k1MaxLessThanK2Min && k2MaxLessThanK3Min;

    return [
      {
        label: "R Sum",
        description: "R1 + R2 + R3 \u2264 1.0",
        passed: rSumPassed,
        detail: `Max R1(${bounds.R1[1]}) + R2(${bounds.R2[1]}) + R3(${bounds.R3[1]}) = ${maxRSum.toFixed(3)}`,
      },
      {
        label: "T Order",
        description: "T1 < T2 < T3",
        passed: tOrderPassed,
        detail: `T1[${bounds.T1[0]}\u2013${bounds.T1[1]}] ${t1MaxLessThanT2Min ? "<" : "\u2265"} T2[${bounds.T2[0]}\u2013${bounds.T2[1]}] ${t2MaxLessThanT3Min ? "<" : "\u2265"} T3[${bounds.T3[0]}\u2013${bounds.T3[1]}]`,
      },
      {
        label: "K Order",
        description: "K1 < K2 < K3",
        passed: kOrderPassed,
        detail: `K1[${bounds.K1[0]}\u2013${bounds.K1[1]}] ${k1MaxLessThanK2Min ? "<" : "\u2265"} K2[${bounds.K2[0]}\u2013${bounds.K2[1]}] ${k2MaxLessThanK3Min ? "<" : "\u2265"} K3[${bounds.K3[0]}\u2013${bounds.K3[1]}]`,
      },
    ];
  }, [bounds]);

  const allPassed = constraints.every((c) => c.passed);

  return (
    <Card data-testid="card-constraint-detector">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm">Constraint Validation</CardTitle>
          <Badge
            variant={allPassed ? "default" : "destructive"}
            data-testid="badge-constraint-overall"
          >
            {allPassed ? "All Passed" : "Violations Detected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {constraints.map((c) => (
            <div key={c.label} className="flex items-start gap-3" data-testid={`constraint-${c.label.toLowerCase().replace(/\s/g, "-")}`}>
              {c.passed ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={c.passed ? "secondary" : "destructive"}
                    data-testid={`badge-constraint-${c.label.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    {c.label}: {c.passed ? "Pass" : "Fail"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{c.description}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono" data-testid={`text-constraint-detail-${c.label.toLowerCase().replace(/\s/g, "-")}`}>
                  {c.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
