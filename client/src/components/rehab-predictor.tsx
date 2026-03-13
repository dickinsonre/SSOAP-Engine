import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Wrench, DollarSign, Calculator, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface RehabMethod {
  id: string;
  name: string;
  description: string;
  rdiiReductionMin: number;
  rdiiReductionMax: number;
  costPerFtMin: number;
  costPerFtMax: number;
  lifespanYears: number;
  applicability: string[];
}

const REHAB_METHODS: RehabMethod[] = [
  {
    id: "cipp",
    name: "CIPP Lining",
    description: "Cured-in-place pipe lining. Most common trenchless method.",
    rdiiReductionMin: 40,
    rdiiReductionMax: 85,
    costPerFtMin: 30,
    costPerFtMax: 120,
    lifespanYears: 50,
    applicability: ["cracked", "joint-offset", "root-intrusion"],
  },
  {
    id: "pipe-bursting",
    name: "Pipe Bursting",
    description: "Trenchless replacement by fracturing existing pipe and pulling new pipe.",
    rdiiReductionMin: 70,
    rdiiReductionMax: 95,
    costPerFtMin: 60,
    costPerFtMax: 200,
    lifespanYears: 75,
    applicability: ["collapsed", "severely-deteriorated", "undersized"],
  },
  {
    id: "open-cut",
    name: "Open Cut Replacement",
    description: "Traditional dig-and-replace. Highest certainty but most disruptive.",
    rdiiReductionMin: 85,
    rdiiReductionMax: 100,
    costPerFtMin: 100,
    costPerFtMax: 400,
    lifespanYears: 100,
    applicability: ["collapsed", "severely-deteriorated", "undersized", "misaligned"],
  },
  {
    id: "manhole-seal",
    name: "Manhole Sealing",
    description: "Internal sealing of manhole joints, chimney, and frame connections.",
    rdiiReductionMin: 15,
    rdiiReductionMax: 45,
    costPerFtMin: 5,
    costPerFtMax: 25,
    lifespanYears: 25,
    applicability: ["manhole-inflow", "chimney-leak", "frame-seal"],
  },
  {
    id: "lateral-lining",
    name: "Lateral Lining",
    description: "CIPP lining of service laterals. Addresses major I&I source.",
    rdiiReductionMin: 30,
    rdiiReductionMax: 70,
    costPerFtMin: 40,
    costPerFtMax: 150,
    lifespanYears: 50,
    applicability: ["lateral-defect", "joint-leak", "root-intrusion"],
  },
  {
    id: "point-repair",
    name: "Point Repair",
    description: "Localized repair of specific defects using short liners or excavation.",
    rdiiReductionMin: 20,
    rdiiReductionMax: 60,
    costPerFtMin: 15,
    costPerFtMax: 80,
    lifespanYears: 30,
    applicability: ["cracked", "joint-offset", "localized-defect"],
  },
];

interface PredictionResult {
  method: RehabMethod;
  rdiiReduction: number;
  annualRDIIVolumeReduced: number;
  totalCost: number;
  annualBenefit: number;
  paybackYears: number;
  roi: number;
  costEffectiveness: number;
}

const chartConfig = {
  rdiiReduction: { label: "RDII Reduction %", color: "hsl(var(--chart-1))" },
  payback: { label: "Payback Years", color: "hsl(var(--chart-2))" },
};

export function RehabPredictor() {
  const [pipeLength, setPipeLength] = useState(500);
  const [pipeDiameter, setPipeDiameter] = useState(8);
  const [currentRDII, setCurrentRDII] = useState(0.068);
  const [annualRainfall, setAnnualRainfall] = useState(42);
  const [sewershedArea, setSewershedArea] = useState(50);
  const [conditionScore, setConditionScore] = useState("3");
  const [treatmentCostPerGal, setTreatmentCostPerGal] = useState(0.005);
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  function runPrediction() {
    const score = parseInt(conditionScore);
    const severityFactor = score <= 2 ? 0.6 : score === 3 ? 0.75 : score === 4 ? 0.9 : 1.0;

    const annualRDIIVolGal = currentRDII * annualRainfall * sewershedArea * 27154 * 7.48;

    const predictions: PredictionResult[] = REHAB_METHODS.map(method => {
      const reductionMid = (method.rdiiReductionMin + method.rdiiReductionMax) / 2;
      const adjustedReduction = reductionMid * severityFactor;
      const rdiiVolReduced = annualRDIIVolGal * (adjustedReduction / 100);
      const costMid = (method.costPerFtMin + method.costPerFtMax) / 2;
      const totalCost = costMid * pipeLength;
      const annualBenefit = rdiiVolReduced * treatmentCostPerGal;
      const payback = annualBenefit > 0 ? totalCost / annualBenefit : 999;
      const roi = annualBenefit > 0 ? ((annualBenefit * method.lifespanYears - totalCost) / totalCost) * 100 : 0;
      const costEffectiveness = rdiiVolReduced > 0 ? totalCost / (rdiiVolReduced / 1000000) : 999;

      return {
        method,
        rdiiReduction: Math.round(adjustedReduction),
        annualRDIIVolumeReduced: Math.round(rdiiVolReduced),
        totalCost: Math.round(totalCost),
        annualBenefit: Math.round(annualBenefit),
        paybackYears: Math.round(payback * 10) / 10,
        roi: Math.round(roi),
        costEffectiveness: Math.round(costEffectiveness),
      };
    });

    predictions.sort((a, b) => a.paybackYears - b.paybackYears);
    setResults(predictions);
    setShowResults(true);
  }

  const bestMethod = results.length > 0 ? results[0] : null;

  const barData = results.map(r => ({
    name: r.method.name.length > 12 ? r.method.name.slice(0, 12) + "…" : r.method.name,
    rdiiReduction: r.rdiiReduction,
    payback: Math.min(r.paybackYears, 50),
    fill: r === bestMethod ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))",
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <CardTitle className="text-base" data-testid="text-rehab-predictor-title">Rehabilitation Impact Predictor</CardTitle>
          </div>
          <CardDescription>
            Predict RDII reduction and cost-benefit for different rehabilitation methods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Pipe Length (ft)</Label>
              <Input
                type="number"
                value={pipeLength}
                onChange={e => setPipeLength(Number(e.target.value))}
                data-testid="input-pipe-length"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Diameter (in)</Label>
              <Input
                type="number"
                value={pipeDiameter}
                onChange={e => setPipeDiameter(Number(e.target.value))}
                data-testid="input-pipe-diameter"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Current R-total</Label>
              <Input
                type="number"
                step="0.001"
                value={currentRDII}
                onChange={e => setCurrentRDII(Number(e.target.value))}
                data-testid="input-current-rdii"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Annual Rain (in)</Label>
              <Input
                type="number"
                value={annualRainfall}
                onChange={e => setAnnualRainfall(Number(e.target.value))}
                data-testid="input-annual-rainfall"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Area (acres)</Label>
              <Input
                type="number"
                value={sewershedArea}
                onChange={e => setSewershedArea(Number(e.target.value))}
                data-testid="input-sewershed-area"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">PACP Score (1-5)</Label>
              <Select value={conditionScore} onValueChange={setConditionScore}>
                <SelectTrigger data-testid="select-condition-score">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Excellent</SelectItem>
                  <SelectItem value="2">2 - Good</SelectItem>
                  <SelectItem value="3">3 - Fair</SelectItem>
                  <SelectItem value="4">4 - Poor</SelectItem>
                  <SelectItem value="5">5 - Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Treatment $/gal</Label>
              <Input
                type="number"
                step="0.001"
                value={treatmentCostPerGal}
                onChange={e => setTreatmentCostPerGal(Number(e.target.value))}
                data-testid="input-treatment-cost"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={runPrediction} className="w-full" data-testid="button-run-prediction">
                <Calculator className="mr-2 h-4 w-4" />
                Predict
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showResults && results.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Best Method</p>
                <p className="text-sm font-semibold mt-1" data-testid="text-best-method">{bestMethod?.method.name}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">RDII Reduction</p>
                <p className="text-sm font-semibold mt-1 text-green-600" data-testid="text-best-reduction">{bestMethod?.rdiiReduction}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Estimated Cost</p>
                <p className="text-sm font-semibold mt-1" data-testid="text-best-cost">${bestMethod?.totalCost.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Payback Period</p>
                <p className="text-sm font-semibold mt-1" data-testid="text-best-payback">{bestMethod?.paybackYears} yrs</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                RDII Reduction by Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="rdiiReduction" name="RDII Reduction %" radius={[0, 4, 4, 0]}>
                      {barData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Cost-Benefit Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Reduction</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Annual Benefit</TableHead>
                    <TableHead className="text-right">Payback</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                    <TableHead className="text-right">Lifespan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, idx) => (
                    <TableRow key={r.method.id} data-testid={`row-rehab-${r.method.id}`}>
                      <TableCell className="font-medium text-xs">
                        {r.method.name}
                        {idx === 0 && <Badge className="ml-2 text-[10px]" variant="default">Best</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={r.rdiiReduction >= 70 ? "default" : r.rdiiReduction >= 40 ? "secondary" : "outline"}>
                          {r.rdiiReduction}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">${r.totalCost.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs">${r.annualBenefit.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs">{r.paybackYears} yrs</TableCell>
                      <TableCell className="text-right text-xs">
                        <span className={r.roi > 200 ? "text-green-600" : r.roi > 0 ? "text-amber-600" : "text-red-600"}>
                          {r.roi}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">{r.method.lifespanYears} yrs</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
