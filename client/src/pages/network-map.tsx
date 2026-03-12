import { useState, useCallback, useMemo, useRef } from "react";
import {
  Map as MapIcon,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MousePointer,
  Info,
  Circle,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SWMMNode {
  id: string;
  x: number;
  y: number;
  type: "junction" | "outfall" | "storage" | "divider" | "subcatchment";
}

interface SWMMLink {
  id: string;
  fromNode: string;
  toNode: string;
  type: "conduit" | "pump" | "orifice" | "weir";
  vertices: { x: number; y: number }[];
}

interface SWMMNetwork {
  nodes: SWMMNode[];
  links: SWMMLink[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function parseINPCoordinates(content: string): SWMMNetwork {
  const lines = content.split("\n");
  const nodes: SWMMNode[] = [];
  const links: SWMMLink[] = [];
  const coordMap = new Map<string, { x: number; y: number }>();
  const vertexMap = new Map<string, { x: number; y: number }[]>();

  let currentSection = "";
  const nodeTypes = new Map<string, SWMMNode["type"]>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      currentSection = trimmed.toUpperCase();
      continue;
    }
    if (trimmed === "" || trimmed.startsWith(";")) continue;

    const parts = trimmed.split(/\s+/);

    if (currentSection === "[JUNCTIONS]" && parts.length >= 2) {
      nodeTypes.set(parts[0], "junction");
    } else if (currentSection === "[OUTFALLS]" && parts.length >= 2) {
      nodeTypes.set(parts[0], "outfall");
    } else if (currentSection === "[STORAGE]" && parts.length >= 2) {
      nodeTypes.set(parts[0], "storage");
    } else if (currentSection === "[DIVIDERS]" && parts.length >= 2) {
      nodeTypes.set(parts[0], "divider");
    } else if (currentSection === "[COORDINATES]" && parts.length >= 3) {
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      if (!isNaN(x) && !isNaN(y)) {
        coordMap.set(parts[0], { x, y });
      }
    } else if (currentSection === "[VERTICES]" && parts.length >= 3) {
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      if (!isNaN(x) && !isNaN(y)) {
        const existing = vertexMap.get(parts[0]) || [];
        existing.push({ x, y });
        vertexMap.set(parts[0], existing);
      }
    } else if (currentSection === "[CONDUITS]" && parts.length >= 3) {
      links.push({
        id: parts[0],
        fromNode: parts[1],
        toNode: parts[2],
        type: "conduit",
        vertices: vertexMap.get(parts[0]) || [],
      });
    } else if (currentSection === "[PUMPS]" && parts.length >= 3) {
      links.push({
        id: parts[0],
        fromNode: parts[1],
        toNode: parts[2],
        type: "pump",
        vertices: vertexMap.get(parts[0]) || [],
      });
    } else if (currentSection === "[ORIFICES]" && parts.length >= 3) {
      links.push({
        id: parts[0],
        fromNode: parts[1],
        toNode: parts[2],
        type: "orifice",
        vertices: vertexMap.get(parts[0]) || [],
      });
    } else if (currentSection === "[WEIRS]" && parts.length >= 3) {
      links.push({
        id: parts[0],
        fromNode: parts[1],
        toNode: parts[2],
        type: "weir",
        vertices: vertexMap.get(parts[0]) || [],
      });
    }
  }

  for (const [id, coord] of coordMap) {
    nodes.push({
      id,
      x: coord.x,
      y: coord.y,
      type: nodeTypes.get(id) || "junction",
    });
  }

  for (const link of links) {
    link.vertices = vertexMap.get(link.id) || [];
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }

  if (nodes.length === 0) {
    minX = 0; minY = 0; maxX = 100; maxY = 100;
  }

  return { nodes, links, bounds: { minX, minY, maxX, maxY } };
}

const NODE_COLORS: Record<SWMMNode["type"], string> = {
  junction: "#3b82f6",
  outfall: "#ef4444",
  storage: "#8b5cf6",
  divider: "#f59e0b",
  subcatchment: "#10b981",
};

const LINK_COLORS: Record<SWMMLink["type"], string> = {
  conduit: "#64748b",
  pump: "#8b5cf6",
  orifice: "#f59e0b",
  weir: "#06b6d4",
};

function NetworkSVG({
  network,
  zoom,
  panOffset,
  onPan,
  selectedNode,
  onSelectNode,
  selectedLink,
  onSelectLink,
  colorBy,
}: {
  network: SWMMNetwork;
  zoom: number;
  panOffset: { x: number; y: number };
  onPan: (dx: number, dy: number) => void;
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
  selectedLink: string | null;
  onSelectLink: (id: string | null) => void;
  colorBy: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false, lastX: 0, lastY: 0,
  });

  const { bounds } = network;
  const width = bounds.maxX - bounds.minX || 100;
  const height = bounds.maxY - bounds.minY || 100;
  const padding = Math.max(width, height) * 0.05;

  const transform = useCallback((x: number, y: number) => {
    const sx = ((x - bounds.minX + padding) / (width + padding * 2)) * 800;
    const sy = (1 - (y - bounds.minY + padding) / (height + padding * 2)) * 600;
    return { sx, sy };
  }, [bounds, width, height, padding]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    onPan(dx, dy);
  }, [onPan]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const nodeRadius = Math.max(2, 4 / zoom);

  return (
    <svg
      ref={svgRef}
      viewBox={`${-panOffset.x / zoom} ${-panOffset.y / zoom} ${800 / zoom} ${600 / zoom}`}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      data-testid="svg-network-map"
    >
      <rect x={-panOffset.x / zoom} y={-panOffset.y / zoom} width={800 / zoom} height={600 / zoom} fill="transparent" />
      {network.links.map((link) => {
        const fromNode = network.nodes.find(n => n.id === link.fromNode);
        const toNode = network.nodes.find(n => n.id === link.toNode);
        if (!fromNode || !toNode) return null;

        const from = transform(fromNode.x, fromNode.y);
        const to = transform(toNode.x, toNode.y);

        const points = [from];
        for (const v of link.vertices) {
          points.push(transform(v.x, v.y));
        }
        points.push(to);

        const pathData = points.map((p, i) =>
          i === 0 ? `M ${p.sx} ${p.sy}` : `L ${p.sx} ${p.sy}`
        ).join(" ");

        const isSelected = selectedLink === link.id;
        const color = LINK_COLORS[link.type] || "#64748b";

        return (
          <path
            key={link.id}
            d={pathData}
            stroke={isSelected ? "#f97316" : color}
            strokeWidth={isSelected ? 3 / zoom : 1.5 / zoom}
            fill="none"
            className="cursor-pointer hover:stroke-orange-400"
            onClick={(e) => { e.stopPropagation(); onSelectLink(link.id); onSelectNode(null); }}
          />
        );
      })}
      {network.nodes.map((node) => {
        const { sx, sy } = transform(node.x, node.y);
        const isSelected = selectedNode === node.id;
        const color = NODE_COLORS[node.type] || "#3b82f6";

        return (
          <g key={node.id}>
            <circle
              cx={sx}
              cy={sy}
              r={isSelected ? nodeRadius * 1.8 : nodeRadius}
              fill={isSelected ? "#f97316" : color}
              stroke={isSelected ? "#fff" : "none"}
              strokeWidth={isSelected ? 1 / zoom : 0}
              className="cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onSelectNode(node.id); onSelectLink(null); }}
            />
            {zoom > 1.5 && (
              <text
                x={sx + nodeRadius + 2}
                y={sy + 1}
                fontSize={Math.max(6, 8 / zoom)}
                fill="currentColor"
                className="select-none pointer-events-none"
              >
                {node.id}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function InspectorPanel({
  network,
  selectedNode,
  selectedLink,
}: {
  network: SWMMNetwork;
  selectedNode: string | null;
  selectedLink: string | null;
}) {
  if (selectedNode) {
    const node = network.nodes.find(n => n.id === selectedNode);
    if (!node) return null;
    return (
      <Card data-testid="card-node-inspector">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Node: {node.id}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <Badge variant="outline">{node.type}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">X Coordinate</span>
            <span className="font-mono">{node.x.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Y Coordinate</span>
            <span className="font-mono">{node.y.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedLink) {
    const link = network.links.find(l => l.id === selectedLink);
    if (!link) return null;
    return (
      <Card data-testid="card-link-inspector">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Link: {link.id}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <Badge variant="outline">{link.type}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">From Node</span>
            <span className="font-mono">{link.fromNode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">To Node</span>
            <span className="font-mono">{link.toNode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vertices</span>
            <span className="font-mono">{link.vertices.length}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <MousePointer className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          Click a node or link to inspect its properties
        </p>
      </CardContent>
    </Card>
  );
}

export default function NetworkMapPage() {
  const [network, setNetwork] = useState<SWMMNetwork | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [colorBy, setColorBy] = useState("type");
  const [loading, setLoading] = useState(false);

  const handleFileUpload = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const content = await file.text();
      const parsed = parseINPCoordinates(content);
      setNetwork(parsed);
      setFileName(file.name);
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
      setSelectedNode(null);
      setSelectedLink(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadSample = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/sample-data/Greenville_SI.inp");
      const content = await response.text();
      const parsed = parseINPCoordinates(content);
      setNetwork(parsed);
      setFileName("Greenville_SI.inp");
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePan = useCallback((dx: number, dy: number) => {
    setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z * 1.3, 10)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z / 1.3, 0.1)), []);
  const handleFitView = useCallback(() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }, []);

  const stats = useMemo(() => {
    if (!network) return null;
    const junctions = network.nodes.filter(n => n.type === "junction").length;
    const outfalls = network.nodes.filter(n => n.type === "outfall").length;
    const storages = network.nodes.filter(n => n.type === "storage").length;
    const conduits = network.links.filter(l => l.type === "conduit").length;
    const pumps = network.links.filter(l => l.type === "pump").length;
    return { junctions, outfalls, storages, conduits, pumps };
  }, [network]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-network-map-title">
            Network Map
          </h1>
          <p className="text-sm text-muted-foreground">
            Interactive SWMM network visualization from INP coordinates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".inp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f);
            }}
            className="hidden"
            id="inp-upload"
          />
          <label htmlFor="inp-upload">
            <Button asChild variant="outline" data-testid="button-upload-inp">
              <span>
                <Upload className="mr-2 h-4 w-4" />
                Load INP File
              </span>
            </Button>
          </label>
          <Button variant="outline" onClick={handleLoadSample} disabled={loading} data-testid="button-load-sample-network">
            <MapIcon className="mr-2 h-4 w-4" />
            {loading ? "Loading..." : "Sample Network"}
          </Button>
        </div>
      </div>

      {!network ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MapIcon className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Network Loaded</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Upload a SWMM5 INP file or load the sample model to visualize the network.
              Nodes and links are rendered from [COORDINATES] and [VERTICES] sections.
            </p>
            <div className="flex gap-3">
              <label htmlFor="inp-upload">
                <Button asChild data-testid="button-upload-inp-empty">
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload INP File
                  </span>
                </Button>
              </label>
              <Button variant="outline" onClick={handleLoadSample} disabled={loading}>
                <MapIcon className="mr-2 h-4 w-4" />
                Load Sample
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{fileName}</CardTitle>
                    <CardDescription>
                      {network.nodes.length} nodes, {network.links.length} links
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={handleZoomIn} data-testid="button-zoom-in">
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleZoomOut} data-testid="button-zoom-out">
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleFitView} data-testid="button-fit-view">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground font-mono ml-2">
                      {(zoom * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[500px] border-t bg-muted/30">
                  <NetworkSVG
                    network={network}
                    zoom={zoom}
                    panOffset={panOffset}
                    onPan={handlePan}
                    selectedNode={selectedNode}
                    onSelectNode={setSelectedNode}
                    selectedLink={selectedLink}
                    onSelectLink={setSelectedLink}
                    colorBy={colorBy}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-4 mt-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: NODE_COLORS.junction }} />
                <span className="text-xs text-muted-foreground">Junction</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: NODE_COLORS.outfall }} />
                <span className="text-xs text-muted-foreground">Outfall</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: NODE_COLORS.storage }} />
                <span className="text-xs text-muted-foreground">Storage</span>
              </div>
              <div className="flex items-center gap-2">
                <Minus className="h-3 w-3" style={{ color: LINK_COLORS.conduit }} />
                <span className="text-xs text-muted-foreground">Conduit</span>
              </div>
              <div className="flex items-center gap-2">
                <Minus className="h-3 w-3" style={{ color: LINK_COLORS.pump }} />
                <span className="text-xs text-muted-foreground">Pump</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {stats && (
              <Card data-testid="card-network-stats">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Network Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Junctions</span>
                    <span className="font-mono">{stats.junctions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Outfalls</span>
                    <span className="font-mono">{stats.outfalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Storage</span>
                    <span className="font-mono">{stats.storages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Conduits</span>
                    <span className="font-mono">{stats.conduits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pumps</span>
                    <span className="font-mono">{stats.pumps}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <InspectorPanel
              network={network}
              selectedNode={selectedNode}
              selectedLink={selectedLink}
            />
          </div>
        </div>
      )}
    </div>
  );
}
