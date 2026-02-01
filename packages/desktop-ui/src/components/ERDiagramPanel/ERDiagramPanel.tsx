import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Key,
  Link2,
  Columns3,
  AlertCircle,
  Database,
  Move,
  ChevronDown,
  Check,
  Layers,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { getElectronAPI } from "@/electron";
import { toast } from "sonner";
import type { ERDiagramData, ERDiagramTable } from "@dbview/types";

interface ERDiagramPanelProps {
  connectionKey: string;
  connectionName?: string;
  database?: string; // Database name for multi-database connections
  schemas: string[]; // Initial schemas (can be empty, will fetch all)
}

interface TableNode {
  table: ERDiagramTable;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Layout constants
const TABLE_WIDTH = 220;
const COLUMN_HEIGHT = 24;
const HEADER_HEIGHT = 36;
const TABLE_PADDING = 12;
const TABLE_MARGIN = 80;

export function ERDiagramPanel({ connectionKey, connectionName, database, schemas: initialSchemas }: ERDiagramPanelProps) {
  const [diagramData, setDiagramData] = useState<ERDiagramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [hoveredRelationship, setHoveredRelationship] = useState<string | null>(null);

  // Schema selection
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
  const [selectedSchemas, setSelectedSchemas] = useState<Set<string>>(new Set(initialSchemas));
  const [showSchemaSelector, setShowSchemaSelector] = useState(false);
  const schemaSelectorRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const api = getElectronAPI();

  // Fetch available schemas on mount
  useEffect(() => {
    const fetchSchemas = async () => {
      if (!api) return;
      try {
        const allSchemas = await api.listSchemas(connectionKey, database);
        // Filter out common system schemas that typically don't have user tables
        const userSchemas = allSchemas.filter((s: string) =>
          !s.startsWith('pg_') &&
          s !== 'information_schema'
        );
        setAvailableSchemas(userSchemas);

        // If no initial schemas provided, select all user schemas
        if (initialSchemas.length === 0 && userSchemas.length > 0) {
          setSelectedSchemas(new Set(userSchemas));
        }
      } catch (err) {
        console.error("Failed to fetch schemas:", err);
      }
    };
    fetchSchemas();
  }, [api, connectionKey, database, initialSchemas.length]);

  // Close schema selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (schemaSelectorRef.current && !schemaSelectorRef.current.contains(e.target as Node)) {
        setShowSchemaSelector(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Toggle schema selection
  const toggleSchema = useCallback((schema: string) => {
    setSelectedSchemas(prev => {
      const next = new Set(prev);
      if (next.has(schema)) {
        next.delete(schema);
      } else {
        next.add(schema);
      }
      return next;
    });
  }, []);

  // Select/deselect all schemas
  const selectAllSchemas = useCallback(() => {
    setSelectedSchemas(new Set(availableSchemas));
  }, [availableSchemas]);

  const deselectAllSchemas = useCallback(() => {
    setSelectedSchemas(new Set());
  }, []);

  // Convert selected schemas to array for API call
  const schemasToLoad = useMemo(() => Array.from(selectedSchemas), [selectedSchemas]);

  // Load ER diagram data
  const loadDiagram = useCallback(async () => {
    if (!api || schemasToLoad.length === 0) {
      setLoading(false);
      setDiagramData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.getERDiagram(connectionKey, schemasToLoad, database);
      setDiagramData(data);
    } catch (err) {
      console.error("Failed to load ER diagram:", err);
      setError(err instanceof Error ? err.message : "Failed to load diagram");
      toast.error("Failed to load ER diagram");
    } finally {
      setLoading(false);
    }
  }, [api, connectionKey, database, schemasToLoad]);

  useEffect(() => {
    // Only load if we have schemas selected
    if (schemasToLoad.length > 0) {
      loadDiagram();
    }
  }, [loadDiagram, schemasToLoad.length]);

  // Calculate table positions using a simple grid layout
  const tableNodes = useMemo((): TableNode[] => {
    if (!diagramData) return [];

    const nodes: TableNode[] = [];
    const tablesPerRow = Math.max(1, Math.ceil(Math.sqrt(diagramData.tables.length)));

    diagramData.tables.forEach((table, index) => {
      const row = Math.floor(index / tablesPerRow);
      const col = index % tablesPerRow;

      const height = HEADER_HEIGHT + table.columns.length * COLUMN_HEIGHT + TABLE_PADDING;

      nodes.push({
        table,
        x: col * (TABLE_WIDTH + TABLE_MARGIN),
        y: row * (Math.max(...diagramData.tables.map((t) => t.columns.length * COLUMN_HEIGHT + HEADER_HEIGHT + TABLE_PADDING)) + TABLE_MARGIN),
        width: TABLE_WIDTH,
        height,
      });
    });

    return nodes;
  }, [diagramData]);

  // Get node by table name
  const getNodeByName = useCallback(
    (schema: string, name: string): TableNode | undefined => {
      return tableNodes.find((n) => n.table.schema === schema && n.table.name === name);
    },
    [tableNodes]
  );

  // Calculate relationship paths
  const relationshipPaths = useMemo(() => {
    if (!diagramData) return [];

    return diagramData.relationships.map((rel) => {
      const sourceNode = getNodeByName(rel.sourceSchema, rel.sourceTable);
      const targetNode = getNodeByName(rel.targetSchema, rel.targetTable);

      if (!sourceNode || !targetNode) return null;

      // Find column indices
      const sourceColIndex = sourceNode.table.columns.findIndex((c) => c.name === rel.sourceColumn);
      const targetColIndex = targetNode.table.columns.findIndex((c) => c.name === rel.targetColumn);

      // Calculate connection points
      const sourceY = sourceNode.y + HEADER_HEIGHT + (sourceColIndex + 0.5) * COLUMN_HEIGHT;
      const targetY = targetNode.y + HEADER_HEIGHT + (targetColIndex + 0.5) * COLUMN_HEIGHT;

      // Determine if source is to the left or right of target
      const sourceOnLeft = sourceNode.x < targetNode.x;

      const sourceX = sourceOnLeft ? sourceNode.x + sourceNode.width : sourceNode.x;
      const targetX = sourceOnLeft ? targetNode.x : targetNode.x + targetNode.width;

      // Create a curved path
      const controlOffset = Math.min(60, Math.abs(targetX - sourceX) / 3);

      const path = sourceOnLeft
        ? `M ${sourceX} ${sourceY} C ${sourceX + controlOffset} ${sourceY}, ${targetX - controlOffset} ${targetY}, ${targetX} ${targetY}`
        : `M ${sourceX} ${sourceY} C ${sourceX - controlOffset} ${sourceY}, ${targetX + controlOffset} ${targetY}, ${targetX} ${targetY}`;

      return {
        ...rel,
        path,
        sourceX,
        sourceY,
        targetX,
        targetY,
      };
    }).filter(Boolean);
  }, [diagramData, getNodeByName]);

  // Calculate SVG viewBox
  const viewBox = useMemo(() => {
    if (tableNodes.length === 0) {
      return { minX: 0, minY: 0, width: 800, height: 600 };
    }

    const padding = 60;
    const minX = Math.min(...tableNodes.map((n) => n.x)) - padding;
    const minY = Math.min(...tableNodes.map((n) => n.y)) - padding;
    const maxX = Math.max(...tableNodes.map((n) => n.x + n.width)) + padding;
    const maxY = Math.max(...tableNodes.map((n) => n.y + n.height)) + padding;

    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [tableNodes]);

  // Handle zoom
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.3));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 40, y: 40 });
  };

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
    }
  }, []);

  // Handle panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
      }
    },
    [isPanning, lastMousePos]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Export diagram as SVG
  const handleExport = useCallback(() => {
    if (!svgRef.current) return;

    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `er-diagram-${connectionName || "database"}.svg`;
    a.click();

    URL.revokeObjectURL(url);
    toast.success("Diagram exported as SVG");
  }, [connectionName]);

  // Render table node
  const renderTableNode = (node: TableNode) => {
    const { table, x, y, width, height } = node;
    const isSelected = selectedTable === `${table.schema}.${table.name}`;
    const tableKey = `${table.schema}.${table.name}`;

    // Check if this table is involved in hovered relationship
    const isRelated = hoveredRelationship
      ? diagramData?.relationships.some(
          (r) =>
            r.id === hoveredRelationship &&
            ((r.sourceSchema === table.schema && r.sourceTable === table.name) ||
              (r.targetSchema === table.schema && r.targetTable === table.name))
        )
      : false;

    return (
      <g
        key={tableKey}
        transform={`translate(${x}, ${y})`}
        onClick={() => setSelectedTable(isSelected ? null : tableKey)}
        className="cursor-pointer"
      >
        {/* Table background */}
        <rect
          width={width}
          height={height}
          rx={8}
          className={cn(
            "transition-all duration-150",
            isSelected ? "fill-accent/20 stroke-accent stroke-2" : isRelated ? "fill-accent/10 stroke-accent/50" : "fill-bg-secondary stroke-border"
          )}
          strokeWidth={isSelected ? 2 : 1}
        />

        {/* Table header */}
        <rect
          width={width}
          height={HEADER_HEIGHT}
          rx={8}
          className={cn("fill-bg-tertiary", isSelected && "fill-accent/30")}
        />
        <rect
          y={HEADER_HEIGHT - 8}
          width={width}
          height={8}
          className={cn("fill-bg-tertiary", isSelected && "fill-accent/30")}
        />

        {/* Table name */}
        <text
          x={width / 2}
          y={HEADER_HEIGHT / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text-primary text-xs font-semibold"
        >
          {table.name}
        </text>

        {/* Schema badge */}
        <text
          x={width / 2}
          y={HEADER_HEIGHT / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text-tertiary text-[9px]"
        >
          {table.schema}
        </text>

        {/* Columns */}
        {table.columns.map((col, i) => {
          const colY = HEADER_HEIGHT + i * COLUMN_HEIGHT;
          return (
            <g key={col.name} transform={`translate(0, ${colY})`}>
              {/* Column row */}
              <rect
                x={0}
                y={0}
                width={width}
                height={COLUMN_HEIGHT}
                className="fill-transparent hover:fill-bg-hover/50 transition-colors"
              />

              {/* Column icon */}
              {col.isPrimaryKey ? (
                <g transform={`translate(12, ${COLUMN_HEIGHT / 2})`}>
                  <Key className="w-3 h-3 text-yellow-500" />
                </g>
              ) : col.isForeignKey ? (
                <g transform={`translate(12, ${COLUMN_HEIGHT / 2})`}>
                  <Link2 className="w-3 h-3 text-blue-400" />
                </g>
              ) : (
                <g transform={`translate(12, ${COLUMN_HEIGHT / 2})`}>
                  <Columns3 className="w-3 h-3 text-text-tertiary" />
                </g>
              )}

              {/* Column name */}
              <text
                x={28}
                y={COLUMN_HEIGHT / 2}
                dominantBaseline="middle"
                className={cn(
                  "text-[11px]",
                  col.isPrimaryKey ? "fill-yellow-500 font-medium" : col.isForeignKey ? "fill-blue-400" : "fill-text-secondary"
                )}
              >
                {col.name}
              </text>

              {/* Column type */}
              <text
                x={width - 10}
                y={COLUMN_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-text-tertiary text-[9px]"
              >
                {col.type.length > 12 ? col.type.substring(0, 12) + "…" : col.type}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="flex items-center gap-3 text-text-secondary">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading ER diagram...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-error mx-auto mb-3 opacity-50" />
          <p className="text-text-secondary mb-2">Failed to load ER diagram</p>
          <p className="text-sm text-text-tertiary mb-4">{error}</p>
          <button
            onClick={loadDiagram}
            className="px-4 py-2 rounded bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!diagramData || diagramData.tables.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <Database className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
          <p className="text-text-secondary mb-2">No tables found</p>
          <p className="text-sm text-text-tertiary">
            {schemasToLoad.length > 0 ? `No tables in schema${schemasToLoad.length > 1 ? "s" : ""}: ${schemasToLoad.join(", ")}` : "Select schemas to view the ER diagram"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      {/* Toolbar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span className="font-medium text-text-primary">ER Diagram</span>
          <span>•</span>
          <span>{diagramData.tables.length} tables</span>
          <span>•</span>
          <span>{diagramData.relationships.length} relationships</span>

          {/* Schema Selector */}
          <div className="w-px h-5 bg-border mx-1" />
          <div className="relative" ref={schemaSelectorRef}>
            <button
              onClick={() => setShowSchemaSelector(!showSchemaSelector)}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-tertiary hover:bg-bg-hover border border-border text-xs transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                {selectedSchemas.size === availableSchemas.length
                  ? "All schemas"
                  : `${selectedSchemas.size} schema${selectedSchemas.size !== 1 ? "s" : ""}`}
              </span>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showSchemaSelector && "rotate-180")} />
            </button>

            {/* Schema Dropdown */}
            {showSchemaSelector && (
              <div className="absolute top-full left-0 mt-1 w-56 max-h-64 overflow-y-auto bg-bg-primary border border-border rounded-lg shadow-xl z-50">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-secondary">
                  <span className="text-xs font-medium text-text-primary">Select Schemas</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={selectAllSchemas}
                      className="text-[10px] text-accent hover:underline"
                    >
                      All
                    </button>
                    <span className="text-text-tertiary">|</span>
                    <button
                      onClick={deselectAllSchemas}
                      className="text-[10px] text-accent hover:underline"
                    >
                      None
                    </button>
                  </div>
                </div>

                {/* Schema List */}
                <div className="py-1">
                  {availableSchemas.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-text-tertiary">No schemas available</div>
                  ) : (
                    availableSchemas.map((schema) => (
                      <button
                        key={schema}
                        onClick={() => toggleSchema(schema)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-bg-hover transition-colors"
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                            selectedSchemas.has(schema)
                              ? "bg-accent border-accent"
                              : "border-border"
                          )}
                        >
                          {selectedSchemas.has(schema) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-text-primary">{schema}</span>
                      </button>
                    ))
                  )}
                </div>

                {/* Apply Button */}
                <div className="px-3 py-2 border-t border-border bg-bg-secondary">
                  <button
                    onClick={() => {
                      setShowSchemaSelector(false);
                      loadDiagram();
                    }}
                    className="w-full px-3 py-1.5 rounded bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-bg-hover transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="px-2 text-xs text-text-tertiary min-w-[48px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-bg-hover transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded hover:bg-bg-hover transition-colors"
            title="Fit to View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={handleExport}
            className="p-1.5 rounded hover:bg-bg-hover transition-colors"
            title="Export as SVG"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={loadDiagram}
            className="p-1.5 rounded hover:bg-bg-hover transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Diagram Canvas */}
      <div
        ref={containerRef}
        className={cn("flex-1 overflow-hidden", isPanning ? "cursor-grabbing" : "cursor-grab")}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <defs>
            {/* Arrow marker for relationships */}
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" className="fill-accent/70" />
            </marker>
            <marker
              id="arrowhead-hover"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" className="fill-accent" />
            </marker>

            {/* Grid pattern */}
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" className="stroke-border/30" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Background grid */}
          <rect
            x={viewBox.minX - 200}
            y={viewBox.minY - 200}
            width={viewBox.width + 400}
            height={viewBox.height + 400}
            fill="url(#grid)"
          />

          {/* Relationships */}
          {relationshipPaths.map((rel: any) => (
            <g key={rel.id}>
              <path
                d={rel.path}
                fill="none"
                className={cn(
                  "transition-all duration-150",
                  hoveredRelationship === rel.id ? "stroke-accent stroke-2" : "stroke-accent/50"
                )}
                strokeWidth={hoveredRelationship === rel.id ? 2 : 1.5}
                markerEnd={hoveredRelationship === rel.id ? "url(#arrowhead-hover)" : "url(#arrowhead)"}
                onMouseEnter={() => setHoveredRelationship(rel.id)}
                onMouseLeave={() => setHoveredRelationship(null)}
              />
              {/* Invisible wider path for easier hover */}
              <path
                d={rel.path}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredRelationship(rel.id)}
                onMouseLeave={() => setHoveredRelationship(null)}
              />
            </g>
          ))}

          {/* Table nodes */}
          {tableNodes.map(renderTableNode)}
        </svg>
      </div>

      {/* Help tooltip */}
      <div className="absolute bottom-4 left-4 px-3 py-2 rounded-lg bg-bg-secondary border border-border shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3 text-[10px] text-text-secondary">
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-tertiary">
            <Move className="w-3 h-3" />
            Drag to pan
          </span>
          <span className="px-2 py-1 rounded bg-bg-tertiary">Ctrl+Scroll to zoom</span>
          <span className="px-2 py-1 rounded bg-bg-tertiary">Click table to select</span>
        </div>
      </div>

      {/* Relationship tooltip */}
      {hoveredRelationship && (
        <div className="absolute top-14 right-4 px-4 py-3 rounded-lg bg-bg-secondary border border-accent/50 shadow-xl backdrop-blur-sm max-w-xs">
          {(() => {
            const rel = diagramData.relationships.find((r) => r.id === hoveredRelationship);
            if (!rel) return null;
            return (
              <div className="text-xs">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-3.5 h-3.5 text-accent" />
                  <p className="font-semibold text-text-primary">{rel.constraintName}</p>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-tertiary">
                  <span className="text-accent font-medium">{rel.sourceTable}.{rel.sourceColumn}</span>
                  <span className="text-text-tertiary">→</span>
                  <span className="text-accent font-medium">{rel.targetTable}.{rel.targetColumn}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
