import { useState, useEffect } from "react";
import { Save, Trash2, Upload, FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCalibrationData, OptimizationResult } from "@/contexts/CalibrationDataContext";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "rdii-studio-calibration-records";

interface CalibrationRecord {
  id: string;
  basinName: string;
  basinType: string;
  area: number;
  imperviousness: number;
  notes: string;
  parameters: OptimizationResult["parameters"];
  rmse: number;
  nse: number;
  volumeError: number;
  peakError: number;
  timestamp: string;
}

function getNSEBadge(nse: number) {
  if (nse >= 0.75) return <Badge variant="default" className="bg-green-600 text-white" data-testid="badge-nse-good">Good</Badge>;
  if (nse >= 0.5) return <Badge variant="default" className="bg-yellow-500 text-white" data-testid="badge-nse-fair">Fair</Badge>;
  return <Badge variant="destructive" data-testid="badge-nse-poor">Poor</Badge>;
}

function loadRecords(): CalibrationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecords(records: CalibrationRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function CalibrationProjectManager() {
  const { optimizationResults, selectedSolutionIndex, setOptimizationResults, setSelectedSolutionIndex } = useCalibrationData();
  const { toast } = useToast();
  const [records, setRecords] = useState<CalibrationRecord[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [basinName, setBasinName] = useState("");
  const [basinType, setBasinType] = useState("residential");
  const [area, setArea] = useState("");
  const [imperviousness, setImperviousness] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setRecords(loadRecords());
  }, []);

  const selectedResult = optimizationResults[selectedSolutionIndex];

  function handleSave() {
    if (!selectedResult) return;
    if (!basinName.trim()) {
      toast({ title: "Basin name is required", variant: "destructive" });
      return;
    }

    const record: CalibrationRecord = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      basinName: basinName.trim(),
      basinType,
      area: parseFloat(area) || 0,
      imperviousness: parseFloat(imperviousness) || 0,
      notes: notes.trim(),
      parameters: { ...selectedResult.parameters },
      rmse: selectedResult.rmse,
      nse: selectedResult.nse,
      volumeError: selectedResult.volumeError,
      peakError: selectedResult.peakError,
      timestamp: new Date().toISOString(),
    };

    const updated = [record, ...records];
    setRecords(updated);
    saveRecords(updated);
    setSaveDialogOpen(false);
    resetForm();
    toast({ title: "Calibration saved", description: `Saved "${record.basinName}" successfully.` });
  }

  function handleLoad(record: CalibrationRecord) {
    const loaded: OptimizationResult = {
      parameters: { ...record.parameters },
      rmse: record.rmse,
      nse: record.nse,
      volumeError: record.volumeError,
      peakError: record.peakError,
      label: `${record.basinName} (loaded)`,
    };
    setOptimizationResults([loaded, ...optimizationResults]);
    setSelectedSolutionIndex(0);
    toast({ title: "Calibration loaded", description: `Loaded "${record.basinName}" parameters.` });
  }

  function handleDelete() {
    if (!deleteId) return;
    const updated = records.filter((r) => r.id !== deleteId);
    setRecords(updated);
    saveRecords(updated);
    setDeleteId(null);
    toast({ title: "Record deleted" });
  }

  function resetForm() {
    setBasinName("");
    setBasinType("residential");
    setArea("");
    setImperviousness("");
    setNotes("");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3 flex-wrap">
        <div>
          <CardTitle className="text-sm">Calibration Project Manager</CardTitle>
          <CardDescription className="text-xs">Save, compare, and restore calibration sessions</CardDescription>
        </div>
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!selectedResult} data-testid="button-save-calibration">
              <Save className="mr-2 h-4 w-4" />
              Save Current
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Calibration Record</DialogTitle>
              <DialogDescription>Enter basin details and save the current calibration parameters.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="basin-name">Basin Name</Label>
                <Input
                  id="basin-name"
                  value={basinName}
                  onChange={(e) => setBasinName(e.target.value)}
                  placeholder="e.g. North Creek Basin"
                  data-testid="input-basin-name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="basin-type">Basin Type</Label>
                <Select value={basinType} onValueChange={setBasinType}>
                  <SelectTrigger data-testid="select-basin-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="basin-area">Area (acres)</Label>
                  <Input
                    id="basin-area"
                    type="number"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="0"
                    data-testid="input-basin-area"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="basin-imperv">Imperviousness (%)</Label>
                  <Input
                    id="basin-imperv"
                    type="number"
                    value={imperviousness}
                    onChange={(e) => setImperviousness(e.target.value)}
                    placeholder="0"
                    min="0"
                    max="100"
                    data-testid="input-basin-imperviousness"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="basin-notes">Notes</Label>
                <Textarea
                  id="basin-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes about this calibration..."
                  data-testid="input-basin-notes"
                />
              </div>
              {selectedResult && (
                <div className="rounded-md border p-3 space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Parameters to save:</p>
                  <p>R: {selectedResult.parameters.R1.toFixed(4)}, {selectedResult.parameters.R2.toFixed(4)}, {selectedResult.parameters.R3.toFixed(4)}</p>
                  <p>T: {selectedResult.parameters.T1.toFixed(1)}, {selectedResult.parameters.T2.toFixed(1)}, {selectedResult.parameters.T3.toFixed(1)}</p>
                  <p>K: {selectedResult.parameters.K1.toFixed(2)}, {selectedResult.parameters.K2.toFixed(2)}, {selectedResult.parameters.K3.toFixed(2)}</p>
                  <p>NSE: {(selectedResult.nse * 100).toFixed(1)}% | RMSE: {selectedResult.rmse.toFixed(4)}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)} data-testid="button-cancel-save">Cancel</Button>
              <Button onClick={handleSave} data-testid="button-confirm-save">Save Record</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-records">No saved calibration records yet.</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Basin</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Area</TableHead>
                  <TableHead className="text-right">NSE</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="text-right">RMSE</TableHead>
                  <TableHead>Saved</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id} data-testid={`row-record-${record.id}`}>
                    <TableCell className="font-medium text-xs" data-testid={`text-basin-name-${record.id}`}>{record.basinName}</TableCell>
                    <TableCell className="text-xs capitalize">{record.basinType}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{record.area > 0 ? `${record.area} ac` : "-"}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{(record.nse * 100).toFixed(1)}%</TableCell>
                    <TableCell>{getNSEBadge(record.nse)}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{record.rmse.toFixed(4)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(record.timestamp).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleLoad(record)}
                          data-testid={`button-load-record-${record.id}`}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(record.id)}
                          data-testid={`button-delete-record-${record.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calibration Record</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this calibration record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="button-confirm-delete">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
