import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Check, ChevronRight, ChevronLeft, CloudRain, SlidersHorizontal, FileOutput, Copy, Loader2 } from "lucide-react";
import { useCalibrationData } from "@/contexts/CalibrationDataContext";

interface CalibrationWizardProps {
  onRunCalibration: () => void;
  isCalibrating: boolean;
  calibrationDone: boolean;
}

export function CalibrationWizard({ onRunCalibration, isCalibrating, calibrationDone }: CalibrationWizardProps) {
  const { detectedEvents, setDetectedEvents, optimizationResults, selectedSolutionIndex } = useCalibrationData();
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);

  const steps = [
    { label: "Select Events", icon: CloudRain },
    { label: "Optimize RTK", icon: SlidersHorizontal },
    { label: "Export SWMM5", icon: FileOutput },
  ];

  const selectedCount = detectedEvents.filter(e => e.selected).length;

  const toggleEvent = useCallback((id: number) => {
    setDetectedEvents(detectedEvents.map(e => e.id === id ? { ...e, selected: !e.selected } : e));
  }, [detectedEvents, setDetectedEvents]);

  const selected = optimizationResults.length > 0
    ? optimizationResults[selectedSolutionIndex] || optimizationResults[0]
    : null;

  const generateSWMM5 = useCallback(() => {
    if (!selected) return "";
    const p = selected.parameters;
    return `[RDII]
;;UHGroup    Month  Response  R          T          K
  UH1         *      1         ${p.R1.toFixed(6)}   ${p.T1.toFixed(2)}       ${p.K1.toFixed(2)}
  UH1         *      2         ${p.R2.toFixed(6)}   ${p.T2.toFixed(2)}       ${p.K2.toFixed(2)}
  UH1         *      3         ${p.R3.toFixed(6)}   ${p.T3.toFixed(2)}       ${p.K3.toFixed(2)}`;
  }, [selected]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(generateSWMM5());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generateSWMM5]);

  const canProceed = step === 0 ? selectedCount > 0 : step === 1 ? calibrationDone : true;

  if (detectedEvents.length === 0) return null;

  return (
    <Card data-testid="calibration-wizard">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Calibration Wizard</CardTitle>
        <CardDescription className="text-xs">Guided 3-step calibration: select events, optimize, export</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs cursor-pointer border-0 transition-colors ${
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step || (i === 1 && calibrationDone) || (i === 0 && selectedCount > 0)
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
                data-testid={`wizard-step-${i}`}
              >
                {(i < step || (i === 1 && calibrationDone) || (i === 0 && selectedCount > 0 && step > 0)) ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <s.icon className="h-3.5 w-3.5" />
                )}
                <span>{s.label}</span>
              </button>
              {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <Separator />

        {step === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Select which storm events to use for calibration ({selectedCount} of {detectedEvents.length} selected):
            </p>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {detectedEvents.map(e => (
                <label
                  key={e.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  data-testid={`wizard-event-${e.id}`}
                >
                  <Checkbox
                    checked={e.selected}
                    onCheckedChange={() => toggleEvent(e.id)}
                  />
                  <div className="flex-1 flex items-center gap-2 text-xs">
                    <span className="font-mono">{e.startDate}</span>
                    <span className="text-muted-foreground">to</span>
                    <span className="font-mono">{e.endDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{e.rainDepth.toFixed(2)} in</Badge>
                    <Badge variant="outline">{e.duration}h</Badge>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Run NSGA-II optimization using {selectedCount} selected event{selectedCount !== 1 ? "s" : ""}:
            </p>
            {!calibrationDone ? (
              <Button
                onClick={onRunCalibration}
                disabled={isCalibrating || selectedCount === 0}
                data-testid="wizard-run-calibration"
              >
                {isCalibrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SlidersHorizontal className="mr-2 h-4 w-4" />}
                {isCalibrating ? "Optimizing..." : "Run Calibration"}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Calibration complete</span>
                </div>
                {selected && (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center">
                      <p className="text-lg font-bold font-mono" data-testid="wizard-rmse">{selected.rmse.toFixed(4)}</p>
                      <p className="text-xs text-muted-foreground">RMSE</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold font-mono" data-testid="wizard-nse">{(selected.nse * 100).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">NSE</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold font-mono">{selected.volumeError.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Vol Error</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold font-mono">{selected.peakError.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Peak Error</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {isCalibrating && <Progress value={50} className="h-2" />}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {selected ? (
              <>
                <p className="text-xs text-muted-foreground">SWMM5 [RDII] section ready for export:</p>
                <pre className="bg-muted/50 p-4 rounded-md text-xs font-mono overflow-x-auto whitespace-pre" data-testid="wizard-swmm5-output">
                  {generateSWMM5()}
                </pre>
                <Button onClick={handleCopy} variant="outline" size="sm" data-testid="wizard-copy-swmm5">
                  {copied ? <Check className="mr-2 h-3 w-3" /> : <Copy className="mr-2 h-3 w-3" />}
                  {copied ? "Copied" : "Copy to Clipboard"}
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Complete calibration first to export results.</p>
            )}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            data-testid="wizard-back"
          >
            <ChevronLeft className="mr-1 h-3 w-3" />
            Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}
            disabled={step === steps.length - 1 || !canProceed}
            data-testid="wizard-next"
          >
            Next
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
