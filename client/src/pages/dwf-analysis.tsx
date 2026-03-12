import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Calculator,
  Calendar,
  CalendarDays,
  Droplets,
  Edit3,
  Info,
  Moon,
  Waves,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
  ReferenceLine,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { Project, DWFPattern } from "@shared/schema";

function StatCard({
  title,
  value,
  unit,
  description,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  unit: string;
  description: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold">{value}</span>
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}/10`}>
            <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DWFPatternChart({ pattern, type }: { pattern: DWFPattern; type: "weekday" | "weekend" | "both" }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const data = hours.map((hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    hourNum: hour,
    weekday: pattern.weekdayPattern[hour] * pattern.meanFlow,
    weekend: pattern.weekendPattern[hour] * pattern.meanFlow,
    weekdayMultiplier: pattern.weekdayPattern[hour],
    weekendMultiplier: pattern.weekendPattern[hour],
    gwi: pattern.groundwaterFlow,
  }));

  const chartConfig = {
    weekday: { label: "Weekday", color: "hsl(var(--primary))" },
    weekend: { label: "Weekend", color: "hsl(var(--chart-2))" },
    gwi: { label: "GWI Base", color: "hsl(var(--chart-4))" },
  };

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="hour" 
            tick={{ fontSize: 10 }} 
            interval={2}
          />
          <YAxis 
            tick={{ fontSize: 10 }} 
            label={{ value: 'Flow (MGD)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} 
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend />
          {(type === "weekday" || type === "both") && (
            <Area
              type="monotone"
              dataKey="weekday"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.4}
              strokeWidth={2}
              name="Weekday Flow"
            />
          )}
          {(type === "weekend" || type === "both") && (
            <Area
              type="monotone"
              dataKey="weekend"
              stroke="hsl(var(--chart-2))"
              fill="hsl(var(--chart-2))"
              fillOpacity={0.3}
              strokeWidth={2}
              name="Weekend Flow"
            />
          )}
          <Line
            type="monotone"
            dataKey="gwi"
            stroke="hsl(var(--chart-4))"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="GWI Base Flow"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

function FlowStatisticsCard({ pattern }: { pattern: DWFPattern }) {
  const peakWeekdayHour = pattern.weekdayPattern.indexOf(Math.max(...pattern.weekdayPattern));
  const peakWeekendHour = pattern.weekendPattern.indexOf(Math.max(...pattern.weekendPattern));
  const minWeekdayHour = pattern.weekdayPattern.indexOf(Math.min(...pattern.weekdayPattern));
  const minWeekendHour = pattern.weekendPattern.indexOf(Math.min(...pattern.weekendPattern));
  
  const peakWeekdayFlow = Math.max(...pattern.weekdayPattern) * pattern.meanFlow;
  const peakWeekendFlow = Math.max(...pattern.weekendPattern) * pattern.meanFlow;
  const minWeekdayFlow = Math.min(...pattern.weekdayPattern) * pattern.meanFlow;
  const minWeekendFlow = Math.min(...pattern.weekendPattern) * pattern.meanFlow;

  const gwiPercentage = (pattern.groundwaterFlow / pattern.meanFlow) * 100;
  const baseWastewaterFlow = pattern.meanFlow - pattern.groundwaterFlow;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          Flow Statistics
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[250px]">
              <p className="text-xs">
                Flow statistics derived from dry weather flow monitoring data analysis.
                GWI represents groundwater infiltration that enters through defects regardless of rainfall.
              </p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead className="text-right">Weekday</TableHead>
              <TableHead className="text-right">Weekend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Peak Flow</TableCell>
              <TableCell className="text-right font-mono">
                {peakWeekdayFlow.toFixed(2)} MGD
                <span className="text-xs text-muted-foreground ml-1">
                  @ {peakWeekdayHour.toString().padStart(2, '0')}:00
                </span>
              </TableCell>
              <TableCell className="text-right font-mono">
                {peakWeekendFlow.toFixed(2)} MGD
                <span className="text-xs text-muted-foreground ml-1">
                  @ {peakWeekendHour.toString().padStart(2, '0')}:00
                </span>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Minimum Flow</TableCell>
              <TableCell className="text-right font-mono">
                {minWeekdayFlow.toFixed(2)} MGD
                <span className="text-xs text-muted-foreground ml-1">
                  @ {minWeekdayHour.toString().padStart(2, '0')}:00
                </span>
              </TableCell>
              <TableCell className="text-right font-mono">
                {minWeekendFlow.toFixed(2)} MGD
                <span className="text-xs text-muted-foreground ml-1">
                  @ {minWeekendHour.toString().padStart(2, '0')}:00
                </span>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Peak/Min Ratio</TableCell>
              <TableCell className="text-right font-mono">
                {(peakWeekdayFlow / minWeekdayFlow).toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {(peakWeekendFlow / minWeekendFlow).toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        
        <div className="mt-4 pt-4 border-t space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Base Wastewater Flow (BWF)</span>
            <span className="font-mono">{baseWastewaterFlow.toFixed(2)} MGD</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              Groundwater Infiltration (GWI)
              <Badge variant="outline" className="text-xs">
                {gwiPercentage.toFixed(1)}% of mean
              </Badge>
            </span>
            <span className="font-mono text-chart-4">{pattern.groundwaterFlow.toFixed(2)} MGD</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HourlyPatternTable({ pattern }: { pattern: DWFPattern }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Hourly Pattern Multipliers</CardTitle>
        <CardDescription className="text-xs">
          Multipliers applied to mean flow for each hour of the day
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hour</TableHead>
                <TableHead className="text-right">Weekday</TableHead>
                <TableHead className="text-right">Weekend</TableHead>
                <TableHead className="text-right">Weekday Flow</TableHead>
                <TableHead className="text-right">Weekend Flow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hours.map((hour) => (
                <TableRow key={hour}>
                  <TableCell className="font-mono">
                    {hour.toString().padStart(2, '0')}:00
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {pattern.weekdayPattern[hour].toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {pattern.weekendPattern[hour].toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-primary">
                    {(pattern.weekdayPattern[hour] * pattern.meanFlow).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-chart-2">
                    {(pattern.weekendPattern[hour] * pattern.meanFlow).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function DWFComparisonTable({ patterns }: { patterns: DWFPattern[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">DWF Summary Comparison</CardTitle>
        <CardDescription className="text-xs">
          Compare dry weather flow characteristics across sewersheds
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sewershed</TableHead>
              <TableHead className="text-right">Mean Flow</TableHead>
              <TableHead className="text-right">GWI</TableHead>
              <TableHead className="text-right">GWI %</TableHead>
              <TableHead className="text-right">Dry Days</TableHead>
              <TableHead className="text-right">Std Dev</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patterns.map((pattern) => {
              const gwiPercent = (pattern.groundwaterFlow / pattern.meanFlow) * 100;
              return (
                <TableRow key={pattern.id} data-testid={`row-dwf-${pattern.id}`}>
                  <TableCell className="font-medium">{pattern.sewershedName}</TableCell>
                  <TableCell className="text-right font-mono">
                    {pattern.meanFlow.toFixed(2)} MGD
                  </TableCell>
                  <TableCell className="text-right font-mono text-chart-4">
                    {pattern.groundwaterFlow.toFixed(2)} MGD
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={gwiPercent > 15 ? "destructive" : gwiPercent > 10 ? "secondary" : "default"}>
                      {gwiPercent.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {pattern.dryDaysCount}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {pattern.standardDeviation.toFixed(2)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

const PRESET_PATTERNS: Record<string, { label: string; weekday: number[]; weekend: number[] }> = {
  residential: {
    label: "Residential",
    weekday: [0.5, 0.4, 0.35, 0.3, 0.35, 0.5, 0.8, 1.2, 1.4, 1.3, 1.1, 1.0, 0.95, 0.9, 0.85, 0.9, 1.0, 1.2, 1.4, 1.3, 1.1, 0.9, 0.7, 0.6],
    weekend: [0.5, 0.4, 0.35, 0.3, 0.3, 0.4, 0.6, 0.9, 1.1, 1.3, 1.3, 1.2, 1.1, 1.0, 0.95, 0.9, 0.95, 1.1, 1.3, 1.2, 1.1, 0.9, 0.7, 0.6],
  },
  commercial: {
    label: "Commercial",
    weekday: [0.3, 0.25, 0.2, 0.2, 0.2, 0.3, 0.5, 0.9, 1.3, 1.5, 1.5, 1.4, 1.3, 1.3, 1.4, 1.4, 1.3, 1.1, 0.8, 0.6, 0.5, 0.4, 0.35, 0.3],
    weekend: [0.3, 0.25, 0.2, 0.2, 0.2, 0.25, 0.3, 0.5, 0.8, 1.0, 1.1, 1.2, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.3],
  },
  industrial: {
    label: "Industrial",
    weekday: [0.4, 0.35, 0.3, 0.3, 0.3, 0.5, 0.8, 1.3, 1.5, 1.5, 1.5, 1.4, 1.3, 1.4, 1.5, 1.5, 1.4, 1.0, 0.7, 0.5, 0.4, 0.4, 0.4, 0.4],
    weekend: [0.4, 0.35, 0.3, 0.3, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.7, 0.7, 0.7, 0.7, 0.6, 0.6, 0.5, 0.5, 0.45, 0.4, 0.4, 0.4, 0.4, 0.4],
  },
};

function DiurnalPatternEditor() {
  const [weekdayPattern, setWeekdayPattern] = useState<number[]>(
    PRESET_PATTERNS.residential.weekday
  );
  const [weekendPattern, setWeekendPattern] = useState<number[]>(
    PRESET_PATTERNS.residential.weekend
  );
  const [activePreset, setActivePreset] = useState<string>("residential");
  const [editMode, setEditMode] = useState<"weekday" | "weekend">("weekday");

  const loadPreset = useCallback((key: string) => {
    const preset = PRESET_PATTERNS[key];
    if (preset) {
      setWeekdayPattern([...preset.weekday]);
      setWeekendPattern([...preset.weekend]);
      setActivePreset(key);
    }
  }, []);

  const handleSliderChange = useCallback((hour: number, value: number[]) => {
    if (editMode === "weekday") {
      setWeekdayPattern(prev => {
        const next = [...prev];
        next[hour] = value[0];
        return next;
      });
    } else {
      setWeekendPattern(prev => {
        const next = [...prev];
        next[hour] = value[0];
        return next;
      });
    }
    setActivePreset("");
  }, [editMode]);

  const activePattern = editMode === "weekday" ? weekdayPattern : weekendPattern;

  const chartData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    hourNum: i,
    weekday: weekdayPattern[i],
    weekend: weekendPattern[i],
  }));

  const mnfHour = activePattern.indexOf(Math.min(...activePattern));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Diurnal Pattern Editor</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(PRESET_PATTERNS).map(([key, preset]) => (
                <Button
                  key={key}
                  variant={activePreset === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => loadPreset(key)}
                  data-testid={`button-preset-${key}`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          <CardDescription className="text-xs">
            Adjust 24-hour multipliers by dragging sliders or selecting a preset pattern
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant={editMode === "weekday" ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode("weekday")}
              data-testid="button-edit-weekday"
            >
              Weekday
            </Button>
            <Button
              variant={editMode === "weekend" ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode("weekend")}
              data-testid="button-edit-weekend"
            >
              Weekend
            </Button>
          </div>

          <ChartContainer
            config={{
              weekday: { label: "Weekday", color: "hsl(var(--primary))" },
              weekend: { label: "Weekend", color: "hsl(var(--chart-2))" },
            }}
            className="h-[250px] w-full"
          >
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 2]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="weekday" name="Weekday" fill="hsl(var(--primary))" fillOpacity={0.7}>
                  {chartData.map((_, index) => (
                    <Cell
                      key={`wd-${index}`}
                      fill={index === mnfHour && editMode === "weekday" ? "hsl(var(--chart-5))" : "hsl(var(--primary))"}
                      fillOpacity={editMode === "weekday" ? 0.8 : 0.3}
                    />
                  ))}
                </Bar>
                <Bar dataKey="weekend" name="Weekend" fill="hsl(var(--chart-2))" fillOpacity={0.7}>
                  {chartData.map((_, index) => (
                    <Cell
                      key={`we-${index}`}
                      fill={index === mnfHour && editMode === "weekend" ? "hsl(var(--chart-5))" : "hsl(var(--chart-2))"}
                      fillOpacity={editMode === "weekend" ? 0.8 : 0.3}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-12 text-muted-foreground">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                  <Slider
                    min={0}
                    max={2}
                    step={0.05}
                    value={[activePattern[hour]]}
                    onValueChange={(value) => handleSliderChange(hour, value)}
                    className="flex-1"
                    data-testid={`slider-hour-${hour}`}
                  />
                  <span className="text-xs font-mono w-10 text-right" data-testid={`text-multiplier-${hour}`}>
                    {activePattern[hour].toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function PerCapitaFlowCalculator() {
  const [population, setPopulation] = useState<number>(50000);
  const [perCapitaFlow, setPerCapitaFlow] = useState<number>(80);
  const [peakingFactor, setPeakingFactor] = useState<number>(2.5);

  const averageDWF = (population * perCapitaFlow) / 1000000;
  const peakDWF = averageDWF * peakingFactor;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Per-Capita Flow Calculator
        </CardTitle>
        <CardDescription className="text-xs">
          Estimate average and peak dry weather flows based on population
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="population" className="text-xs">Population</Label>
            <Input
              id="population"
              type="number"
              value={population}
              onChange={(e) => setPopulation(Number(e.target.value) || 0)}
              data-testid="input-population"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gpcd" className="text-xs">Per-Capita Flow (gpcd)</Label>
            <Input
              id="gpcd"
              type="number"
              value={perCapitaFlow}
              onChange={(e) => setPerCapitaFlow(Number(e.target.value) || 0)}
              data-testid="input-gpcd"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="peaking" className="text-xs">Peaking Factor</Label>
            <Input
              id="peaking"
              type="number"
              step="0.1"
              value={peakingFactor}
              onChange={(e) => setPeakingFactor(Number(e.target.value) || 0)}
              data-testid="input-peaking-factor"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Average DWF</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold" data-testid="text-avg-dwf">
                  {averageDWF.toFixed(3)}
                </span>
                <span className="text-sm text-muted-foreground">MGD</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {population.toLocaleString()} x {perCapitaFlow} gpcd
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Peak DWF</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold" data-testid="text-peak-dwf">
                  {peakDWF.toFixed(3)}
                </span>
                <span className="text-sm text-muted-foreground">MGD</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg x {peakingFactor} peaking factor
              </p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

function MNFDetectionCard({ pattern }: { pattern: DWFPattern }) {
  const weekdayMin = Math.min(...pattern.weekdayPattern);
  const weekdayMnfHour = pattern.weekdayPattern.indexOf(weekdayMin);
  const weekendMin = Math.min(...pattern.weekendPattern);
  const weekendMnfHour = pattern.weekendPattern.indexOf(weekendMin);

  const mnfValue = Math.min(weekdayMin, weekendMin) * pattern.meanFlow;
  const mnfHour = weekdayMin <= weekendMin ? weekdayMnfHour : weekendMnfHour;
  const estimatedGWI = mnfValue;

  const chartData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    hourNum: i,
    weekday: pattern.weekdayPattern[i] * pattern.meanFlow,
    weekend: pattern.weekendPattern[i] * pattern.meanFlow,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Minimum Night Flow (MNF) Detection
          </CardTitle>
          <CardDescription className="text-xs">
            MNF analysis identifies the hour of lowest flow, typically indicating groundwater infiltration levels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">MNF Hour</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold" data-testid="text-mnf-hour">
                    {mnfHour.toString().padStart(2, "0")}:00
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Hour of minimum flow
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">MNF Value</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold" data-testid="text-mnf-value">
                    {mnfValue.toFixed(3)}
                  </span>
                  <span className="text-sm text-muted-foreground">MGD</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Multiplier: {Math.min(weekdayMin, weekendMin).toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Estimated GWI</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold" data-testid="text-estimated-gwi">
                    {estimatedGWI.toFixed(3)}
                  </span>
                  <span className="text-sm text-muted-foreground">MGD</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((estimatedGWI / pattern.meanFlow) * 100).toFixed(1)}% of mean flow
                </p>
              </CardContent>
            </Card>
          </div>

          <ChartContainer
            config={{
              weekday: { label: "Weekday", color: "hsl(var(--primary))" },
              weekend: { label: "Weekend", color: "hsl(var(--chart-2))" },
            }}
            className="h-[280px] w-full"
          >
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: "Flow (MGD)", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <ReferenceLine y={mnfValue} stroke="hsl(var(--chart-5))" strokeDasharray="5 5" label={{ value: "MNF", position: "right", fontSize: 10 }} />
                <Bar dataKey="weekday" name="Weekday Flow">
                  {chartData.map((_, index) => (
                    <Cell
                      key={`wd-mnf-${index}`}
                      fill={index === weekdayMnfHour ? "hsl(var(--chart-5))" : "hsl(var(--primary))"}
                      fillOpacity={index === weekdayMnfHour ? 1 : 0.6}
                    />
                  ))}
                </Bar>
                <Bar dataKey="weekend" name="Weekend Flow">
                  {chartData.map((_, index) => (
                    <Cell
                      key={`we-mnf-${index}`}
                      fill={index === weekendMnfHour ? "hsl(var(--chart-5))" : "hsl(var(--chart-2))"}
                      fillOpacity={index === weekendMnfHour ? 1 : 0.6}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function DWFAnalysisPage() {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedPattern, setSelectedPattern] = useState<DWFPattern | null>(null);
  const [chartType, setChartType] = useState<"weekday" | "weekend" | "both">("both");

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: dwfPatterns, isLoading } = useQuery<DWFPattern[]>({
    queryKey: [`/api/dwf-patterns?projectId=${selectedProject}`],
    enabled: !!selectedProject,
  });

  if (!selectedProject && projects && projects.length > 0) {
    setSelectedProject(projects[0].id);
  }

  if (selectedProject && dwfPatterns && dwfPatterns.length > 0 && !selectedPattern) {
    setSelectedPattern(dwfPatterns[0]);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">DWF Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Dry Weather Flow patterns, mean flow analysis, and groundwater infiltration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[250px]" data-testid="select-project">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects?.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !dwfPatterns || dwfPatterns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Droplets className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No DWF Patterns</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              No dry weather flow patterns have been analyzed for this project yet.
              Import flow monitoring data and run DWF decomposition to generate patterns.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Activity className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="patterns" data-testid="tab-patterns">
              <Waves className="mr-2 h-4 w-4" />
              Diurnal Patterns
            </TabsTrigger>
            <TabsTrigger value="comparison" data-testid="tab-comparison">
              <CalendarDays className="mr-2 h-4 w-4" />
              Comparison
            </TabsTrigger>
            <TabsTrigger value="editor" data-testid="tab-editor">
              <Edit3 className="mr-2 h-4 w-4" />
              Pattern Editor
            </TabsTrigger>
            <TabsTrigger value="calculator" data-testid="tab-calculator">
              <Calculator className="mr-2 h-4 w-4" />
              Calculator
            </TabsTrigger>
            <TabsTrigger value="mnf" data-testid="tab-mnf">
              <Moon className="mr-2 h-4 w-4" />
              MNF Detection
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {selectedPattern && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm text-muted-foreground">Sewershed:</span>
                  <Select 
                    value={selectedPattern.id} 
                    onValueChange={(id) => {
                      const pattern = dwfPatterns.find(p => p.id === id);
                      if (pattern) setSelectedPattern(pattern);
                    }}
                  >
                    <SelectTrigger className="w-[200px]" data-testid="select-sewershed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dwfPatterns.map((pattern) => (
                        <SelectItem key={pattern.id} value={pattern.id}>
                          {pattern.sewershedName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard
                    title="Mean DWF"
                    value={selectedPattern.meanFlow.toFixed(2)}
                    unit="MGD"
                    description="Average daily dry weather flow"
                    icon={Droplets}
                    color="bg-primary"
                  />
                  <StatCard
                    title="Groundwater Infiltration"
                    value={selectedPattern.groundwaterFlow.toFixed(2)}
                    unit="MGD"
                    description={`${((selectedPattern.groundwaterFlow / selectedPattern.meanFlow) * 100).toFixed(1)}% of mean flow`}
                    icon={Waves}
                    color="bg-chart-4"
                  />
                  <StatCard
                    title="Peak Flow"
                    value={selectedPattern.maxFlow.toFixed(2)}
                    unit="MGD"
                    description="Maximum observed flow"
                    icon={Activity}
                    color="bg-chart-1"
                  />
                  <StatCard
                    title="Dry Days Analyzed"
                    value={selectedPattern.dryDaysCount}
                    unit="days"
                    description="Number of qualifying dry days"
                    icon={Calendar}
                    color="bg-chart-2"
                  />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm">Diurnal Flow Pattern</CardTitle>
                        <Select value={chartType} onValueChange={(v) => setChartType(v as typeof chartType)}>
                          <SelectTrigger className="w-[130px] h-8" data-testid="select-chart-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="both">Both</SelectItem>
                            <SelectItem value="weekday">Weekday Only</SelectItem>
                            <SelectItem value="weekend">Weekend Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <CardDescription className="text-xs">
                        24-hour flow pattern with GWI baseline (dashed)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DWFPatternChart pattern={selectedPattern} type={chartType} />
                    </CardContent>
                  </Card>

                  <FlowStatisticsCard pattern={selectedPattern} />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="patterns" className="space-y-6">
            {selectedPattern && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Weekday vs Weekend Pattern</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DWFPatternChart pattern={selectedPattern} type="both" />
                  </CardContent>
                </Card>
                <HourlyPatternTable pattern={selectedPattern} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="comparison" className="space-y-6">
            <DWFComparisonTable patterns={dwfPatterns} />
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">GWI Comparison Across Sewersheds</CardTitle>
                <CardDescription className="text-xs">
                  Groundwater infiltration rates by sewershed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    gwi: { label: "GWI", color: "hsl(var(--chart-4))" },
                    bwf: { label: "Base Wastewater", color: "hsl(var(--primary))" },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer>
                    <BarChart data={dwfPatterns.map(p => ({
                      name: p.sewershedName,
                      gwi: p.groundwaterFlow,
                      bwf: p.meanFlow - p.groundwaterFlow,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} label={{ value: 'Flow (MGD)', angle: -90, position: 'insideLeft' }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="bwf" stackId="a" fill="hsl(var(--primary))" name="Base Wastewater Flow" />
                      <Bar dataKey="gwi" stackId="a" fill="hsl(var(--chart-4))" name="Groundwater Infiltration" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="editor" className="space-y-6">
            <DiurnalPatternEditor />
          </TabsContent>

          <TabsContent value="calculator" className="space-y-6">
            <PerCapitaFlowCalculator />
          </TabsContent>

          <TabsContent value="mnf" className="space-y-6">
            {selectedPattern && (
              <MNFDetectionCard pattern={selectedPattern} />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
