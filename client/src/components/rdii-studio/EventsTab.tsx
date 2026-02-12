import { useState, useCallback } from "react";
import { CloudRain, ArrowRight, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { DetectedEvent } from "@/contexts/CalibrationDataContext";
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface EventsTabProps {
  onNext?: () => void;
}

export function EventsTab({ onNext }: EventsTabProps) {
  const { rainfallData, rdiiSeries, detectedEvents, setDetectedEvents } = useCalibrationData();
  const [running, setRunning] = useState(false);

  const handleDetect = useCallback(() => {
    if (!rainfallData) return;
    setRunning(true);
    setTimeout(() => {
      const interEventHours = 6;
      const interEventMs = interEventHours * 3600000;
      const events: DetectedEvent[] = [];
      let eventStart = -1;
      let eventEnd = -1;
      let eventId = 0;

      for (let i = 0; i < rainfallData.timestamps.length; i++) {
        if (rainfallData.values[i] > 0) {
          if (eventStart < 0) {
            eventStart = i;
          }
          eventEnd = i;
        } else if (eventStart >= 0) {
          const timeSinceLastRain = rainfallData.timestamps[i].getTime() - rainfallData.timestamps[eventEnd].getTime();
          if (timeSinceLastRain >= interEventMs) {
            let rainDepth = 0;
            for (let j = eventStart; j <= eventEnd; j++) {
              rainDepth += rainfallData.values[j];
            }

            let rdiiVolume = 0;
            let peakRDII = 0;
            if (rdiiSeries) {
              for (let j = eventStart; j <= Math.min(eventEnd + 24, rdiiSeries.values.length - 1); j++) {
                rdiiVolume += rdiiSeries.values[j] || 0;
                if ((rdiiSeries.values[j] || 0) > peakRDII) peakRDII = rdiiSeries.values[j];
              }
            }

            const durationHrs = (rainfallData.timestamps[eventEnd].getTime() - rainfallData.timestamps[eventStart].getTime()) / 3600000;

            events.push({
              id: eventId++,
              startIndex: eventStart,
              endIndex: eventEnd,
              startDate: rainfallData.timestamps[eventStart].toISOString(),
              endDate: rainfallData.timestamps[eventEnd].toISOString(),
              rainDepth,
              rdiiVolume,
              peakRDII,
              duration: durationHrs,
              selected: true,
            });
            eventStart = -1;
            eventEnd = -1;
          }
        }
      }

      if (eventStart >= 0 && eventEnd >= 0) {
        let rainDepth = 0;
        for (let j = eventStart; j <= eventEnd; j++) rainDepth += rainfallData.values[j];
        let rdiiVolume = 0;
        let peakRDII = 0;
        if (rdiiSeries) {
          for (let j = eventStart; j <= Math.min(eventEnd + 24, rdiiSeries.values.length - 1); j++) {
            rdiiVolume += rdiiSeries.values[j] || 0;
            if ((rdiiSeries.values[j] || 0) > peakRDII) peakRDII = rdiiSeries.values[j];
          }
        }
        const durationHrs = (rainfallData.timestamps[eventEnd].getTime() - rainfallData.timestamps[eventStart].getTime()) / 3600000;
        events.push({
          id: eventId++,
          startIndex: eventStart,
          endIndex: eventEnd,
          startDate: rainfallData.timestamps[eventStart].toISOString(),
          endDate: rainfallData.timestamps[eventEnd].toISOString(),
          rainDepth,
          rdiiVolume,
          peakRDII,
          duration: durationHrs,
          selected: true,
        });
      }

      setDetectedEvents(events);
      setRunning(false);
    }, 300);
  }, [rainfallData, rdiiSeries, setDetectedEvents]);

  const toggleEvent = useCallback((id: number) => {
    setDetectedEvents(detectedEvents.map((e) => e.id === id ? { ...e, selected: !e.selected } : e));
  }, [detectedEvents, setDetectedEvents]);

  const chartData = rainfallData
    ? (() => {
        const step = Math.max(1, Math.floor(rainfallData.timestamps.length / 500));
        const data: { time: string; idx: number; rainfall: number }[] = [];
        for (let i = 0; i < rainfallData.timestamps.length; i += step) {
          data.push({
            time: rainfallData.timestamps[i].toLocaleDateString(),
            idx: i,
            rainfall: rainfallData.values[i],
          });
        }
        return data;
      })()
    : [];

  if (!rainfallData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CloudRain className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Import rainfall data first to detect storm events.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          {detectedEvents.length > 0 && (
            <Badge variant="outline" data-testid="badge-event-count">{detectedEvents.length} events detected</Badge>
          )}
        </div>
        <Button onClick={handleDetect} disabled={running} data-testid="button-detect-events">
          <Play className="mr-2 h-4 w-4" />
          {running ? "Detecting..." : "Detect Events"}
        </Button>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Rainfall with Event Windows</CardTitle>
            <CardDescription className="text-xs">Detected storm events highlighted</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ rainfall: { label: "Rainfall", color: "hsl(var(--chart-2))" } }} className="h-[250px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="rainfall" fill="hsl(var(--chart-2))" fillOpacity={0.7} name="Rainfall" />
                  {detectedEvents.filter((e) => e.selected).map((evt) => (
                    <ReferenceArea
                      key={evt.id}
                      x1={rainfallData.timestamps[evt.startIndex]?.toLocaleDateString()}
                      x2={rainfallData.timestamps[evt.endIndex]?.toLocaleDateString()}
                      fill="hsl(var(--primary))"
                      fillOpacity={0.1}
                      stroke="hsl(var(--primary))"
                      strokeOpacity={0.3}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {detectedEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Detected Storm Events</CardTitle>
            <CardDescription className="text-xs">Select events for calibration</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Use</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Duration (hrs)</TableHead>
                    <TableHead className="text-right">Rain Depth</TableHead>
                    <TableHead className="text-right">RDII Vol</TableHead>
                    <TableHead className="text-right">Peak RDII</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detectedEvents.map((evt) => (
                    <TableRow key={evt.id} data-testid={`row-event-${evt.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={evt.selected}
                          onCheckedChange={() => toggleEvent(evt.id)}
                          data-testid={`checkbox-event-${evt.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-xs font-mono">{new Date(evt.startDate).toLocaleString()}</TableCell>
                      <TableCell className="text-xs font-mono">{new Date(evt.endDate).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{evt.duration.toFixed(1)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{evt.rainDepth.toFixed(3)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{evt.rdiiVolume.toFixed(3)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{evt.peakRDII.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {detectedEvents.length > 0 && onNext && (
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
