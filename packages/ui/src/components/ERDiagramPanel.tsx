import { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import dagre from 'dagre';
import type { ERDiagramData } from '@dbview/core';
import { TableNode } from './TableNode';
import {
  Download,
  Maximize2,
  Minimize2,
  Filter,
  Eye,
  EyeOff,
  Loader2,
  Network,
} from 'lucide-react';
import 'reactflow/dist/style.css';

const nodeTypes = {
  table: TableNode,
};

// Dagre layout configuration
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 250;
const nodeHeight = 150;

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = 'TB'
): { nodes: Node[]; edges: Edge[] } => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 150 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

interface ERDiagramPanelContentProps {
  diagramData: ERDiagramData | null;
  loading: boolean;
  availableSchemas: string[];
  selectedSchemas: string[];
  onSchemaToggle: (schema: string) => void;
  onTableClick: (schema: string, table: string) => void;
  onClose: () => void;
}

const ERDiagramPanelContent: FC<ERDiagramPanelContentProps> = ({
  diagramData,
  loading,
  availableSchemas,
  selectedSchemas,
  onSchemaToggle,
  onTableClick,
  onClose,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showRelationships, setShowRelationships] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSchemaFilter, setShowSchemaFilter] = useState(false);
  const { fitView, getNodes } = useReactFlow();

  // Build nodes and edges from diagram data
  useEffect(() => {
    if (!diagramData) return;

    // Filter tables by selected schemas
    const filteredTables = diagramData.tables.filter(table =>
      selectedSchemas.includes(table.schema)
    );

    // Create nodes
    const newNodes: Node[] = filteredTables.map((table) => ({
      id: `${table.schema}.${table.name}`,
      type: 'table',
      position: table.position || { x: 0, y: 0 },
      data: {
        schema: table.schema,
        name: table.name,
        columns: table.columns,
        onTableClick,
      },
    }));

    // Create edges from relationships
    const newEdges: Edge[] = diagramData.relationships
      .filter(rel =>
        selectedSchemas.includes(rel.sourceSchema) &&
        selectedSchemas.includes(rel.targetSchema)
      )
      .map((rel) => ({
        id: rel.id,
        source: `${rel.sourceSchema}.${rel.sourceTable}`,
        target: `${rel.targetSchema}.${rel.targetTable}`,
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#3b82f6',
        },
        style: {
          stroke: '#3b82f6',
          strokeWidth: 2,
        },
        label: rel.sourceColumn,
        labelStyle: {
          fill: '#94a3b8',
          fontSize: 10,
        },
        labelBgStyle: {
          fill: '#1e293b',
          fillOpacity: 0.8,
        },
      }));

    // Apply dagre layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      newNodes,
      newEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    // Fit view after a brief delay to ensure nodes are rendered
    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 50);
  }, [diagramData, selectedSchemas, setNodes, setEdges, onTableClick, fitView]);

  // Toggle relationships visibility
  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        hidden: !showRelationships,
      }))
    );
  }, [showRelationships, setEdges]);

  // Export to PNG
  const handleExportPNG = useCallback(() => {
    const reactFlowElement = document.querySelector('.react-flow');
    if (!reactFlowElement) return;

    // Use html2canvas or similar library in production
    // For now, we'll use the browser's native screenshot capability
    alert('Export to PNG: Use browser screenshot tools (Cmd/Ctrl+Shift+S) or integrate html2canvas library');
  }, []);

  // Export to SVG
  const handleExportSVG = useCallback(() => {
    const reactFlowElement = document.querySelector('.react-flow__viewport');
    if (!reactFlowElement) return;

    alert('Export to SVG: This would export the diagram as SVG. Integration requires additional setup.');
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Re-layout
  const handleReLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      getNodes(),
      edges
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  }, [getNodes, edges, setNodes, setEdges, fitView]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-vscode-bg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-vscode-accent mx-auto mb-3" />
          <p className="text-sm text-vscode-text-muted">Loading schema diagram...</p>
        </div>
      </div>
    );
  }

  if (!diagramData) {
    return (
      <div className="flex items-center justify-center h-full bg-vscode-bg">
        <div className="text-center">
          <Network className="h-12 w-12 text-vscode-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-vscode-text">No diagram data available</p>
          <p className="text-xs text-vscode-text-muted mt-1">
            Select schemas to visualize
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'} bg-vscode-bg`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          animated: true,
        }}
      >
        <Background color="#94a3b8" gap={16} />
        <MiniMap
          nodeColor="#3b82f6"
          maskColor="rgba(0, 0, 0, 0.6)"
          className="!bg-vscode-bg-light !border !border-vscode-border"
        />
        <Controls className="!bg-vscode-bg-light !border !border-vscode-border" />

        {/* Top Control Panel */}
        <Panel position="top-left" className="flex items-center gap-2 m-2">
          <div className="flex items-center gap-1 bg-vscode-bg-light border border-vscode-border rounded-lg px-2 py-1.5 shadow-lg">
            <Network className="h-4 w-4 text-vscode-accent mr-1" />
            <span className="text-xs font-semibold text-vscode-text">
              ER Diagram
            </span>
            <span className="text-xs text-vscode-text-muted ml-1">
              ({nodes.length} tables, {edges.length} relationships)
            </span>
          </div>
        </Panel>

        <Panel position="top-right" className="flex items-center gap-2 m-2">
          {/* Schema Filter */}
          <div className="relative">
            <button
              onClick={() => setShowSchemaFilter(!showSchemaFilter)}
              className="flex items-center gap-1.5 bg-vscode-bg-light border border-vscode-border rounded-lg px-3 py-1.5 text-xs font-medium text-vscode-text hover:bg-vscode-bg-hover transition-colors shadow-lg"
            >
              <Filter className="h-3.5 w-3.5" />
              Schemas ({selectedSchemas.length})
            </button>

            {showSchemaFilter && (
              <div className="absolute top-full right-0 mt-1 bg-vscode-bg-light border border-vscode-border rounded-lg shadow-xl p-2 min-w-[200px] z-10">
                <div className="text-xs font-semibold text-vscode-text mb-2 px-2">
                  Filter by Schema
                </div>
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {availableSchemas.map(schema => (
                    <label
                      key={schema}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-vscode-bg-hover cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSchemas.includes(schema)}
                        onChange={() => onSchemaToggle(schema)}
                        className="rounded"
                      />
                      <span className="text-xs text-vscode-text">{schema}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Show/Hide Relationships */}
          <button
            onClick={() => setShowRelationships(!showRelationships)}
            className="flex items-center gap-1.5 bg-vscode-bg-light border border-vscode-border rounded-lg px-3 py-1.5 text-xs font-medium text-vscode-text hover:bg-vscode-bg-hover transition-colors shadow-lg"
            title={showRelationships ? 'Hide relationships' : 'Show relationships'}
          >
            {showRelationships ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            Relationships
          </button>

          {/* Re-layout */}
          <button
            onClick={handleReLayout}
            className="flex items-center gap-1.5 bg-vscode-bg-light border border-vscode-border rounded-lg px-3 py-1.5 text-xs font-medium text-vscode-text hover:bg-vscode-bg-hover transition-colors shadow-lg"
            title="Re-arrange diagram"
          >
            <Network className="h-3.5 w-3.5" />
            Re-layout
          </button>

          {/* Export Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 bg-vscode-bg-light border border-vscode-border rounded-lg px-3 py-1.5 text-xs font-medium text-vscode-text hover:bg-vscode-bg-hover transition-colors shadow-lg">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <div className="absolute top-full right-0 mt-1 bg-vscode-bg-light border border-vscode-border rounded-lg shadow-xl p-1 min-w-[120px] hidden group-hover:block z-10">
              <button
                onClick={handleExportPNG}
                className="w-full text-left px-3 py-1.5 text-xs text-vscode-text hover:bg-vscode-bg-hover rounded"
              >
                Export PNG
              </button>
              <button
                onClick={handleExportSVG}
                className="w-full text-left px-3 py-1.5 text-xs text-vscode-text hover:bg-vscode-bg-hover rounded"
              >
                Export SVG
              </button>
            </div>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 bg-vscode-bg-light border border-vscode-border rounded-lg px-3 py-1.5 text-xs font-medium text-vscode-text hover:bg-vscode-bg-hover transition-colors shadow-lg"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Close button (only in fullscreen) */}
          {isFullscreen && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition-colors shadow-lg"
            >
              Close
            </button>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
};

export interface ERDiagramPanelProps {
  diagramData: ERDiagramData | null;
  loading: boolean;
  availableSchemas: string[];
  selectedSchemas: string[];
  onSchemaToggle: (schema: string) => void;
  onTableClick: (schema: string, table: string) => void;
  onClose: () => void;
}

export const ERDiagramPanel: FC<ERDiagramPanelProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ERDiagramPanelContent {...props} />
    </ReactFlowProvider>
  );
};
