import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

interface ICMFormat {
  name: string;
  description: string;
  requiredColumns: string[];
  optionalColumns: string[];
}

interface ICMFormatsResponse {
  supportedFormats: ICMFormat[];
  exportInstructions: string[];
}

interface ImportResult {
  filename: string;
  type: string;
  recordCount: number;
  status: string;
}

interface ImportResponse {
  message: string;
  simulation: unknown;
  importResults: ImportResult[];
  totalFiles: number;
  totalRecords: number;
}

interface ICMImportDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ICMImportDialog({ trigger, open: controlledOpen, onOpenChange }: ICMImportDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: formats } = useQuery<ICMFormatsResponse>({
    queryKey: ["/api/import/icm/formats"],
  });

  const importMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("projectId", selectedProject);
      
      const response = await fetch("/api/import/icm", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }
      
      return response.json() as Promise<ImportResponse>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/simulations?projectId=${selectedProject}`] });
      toast({
        title: "Import Successful",
        description: `Imported ${data.totalRecords} records from ${data.totalFiles} files.`,
      });
      setSelectedFiles([]);
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.name.toLowerCase().endsWith(".csv")
    );
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  }, []);

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = () => {
    if (selectedFiles.length > 0 && selectedProject) {
      importMutation.mutate(selectedFiles);
    }
  };

  const isControlled = controlledOpen !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" data-testid="button-icm-import">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Import from ICM
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import from ICM InfoWorks
          </DialogTitle>
          <DialogDescription>
            Import network data exported from Autodesk ICM InfoWorks as CSV files
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger data-testid="select-icm-project">
                  <SelectValue placeholder="Select a project" />
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

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Drag and drop CSV files here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Or click to browse for files
                  </p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                  id="icm-file-upload"
                />
                <label htmlFor="icm-file-upload">
                  <Button variant="outline" size="sm" asChild>
                    <span>Browse Files</span>
                  </Button>
                </label>
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Selected Files ({selectedFiles.length})
                </label>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50 border"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        data-testid={`button-remove-file-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="formats">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Supported ICM Export Formats
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {formats?.supportedFormats.map((format) => (
                      <div
                        key={format.name}
                        className="p-3 rounded-md bg-muted/50 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{format.name}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format.description}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {format.requiredColumns.map((col) => (
                            <Badge
                              key={col}
                              variant="secondary"
                              className="text-xs"
                            >
                              {col}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="instructions">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    How to Export from ICM InfoWorks
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal list-inside space-y-2 pt-2 text-sm text-muted-foreground">
                    {formats?.exportInstructions.map((instruction, index) => (
                      <li key={index}>{instruction}</li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              !selectedProject ||
              selectedFiles.length === 0 ||
              importMutation.isPending
            }
            data-testid="button-import-icm"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import {selectedFiles.length} File{selectedFiles.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
