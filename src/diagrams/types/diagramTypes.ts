// Base diagram types
export enum DiagramType {
  FeatureModel = 'feature-model',
  VariantModel = 'variant-model',
  InternalBlockDiagram = 'internal-block-diagram',
  GraphTraversal = 'graph-traversal',
  TraceTree = 'trace-tree',
  TraceTable = 'trace-table'
}

export enum LayoutOrientation {
  TopToBottom = 'top-to-bottom',
  LeftToRight = 'left-to-right'
}

export enum ConstraintType {
  Mandatory = 'mandatory',
  Optional = 'optional',
  Or = 'or',
  Alternative = 'alternative'
}

export enum UpdateTrigger {
  FileClick = 'file-click',
  DiagramFocus = 'diagram-focus',
  FileChange = 'file-change',
  ManualRefresh = 'manual-refresh'
}

// Base diagram data interfaces
export interface DiagramNode {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  properties: Record<string, string[]>;
  parent?: string;
  children?: string[];
  configValue?: number;
  indentLevel?: number;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, string[]>;
  path?: { x: number; y: number }[];
}

export interface DiagramData {
  type: DiagramType;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  metadata: DiagramMetadata;
  featureModelData?: FeatureModelData;
  variantModelData?: VariantModelData;
  internalBlockDiagramData?: any; // Will be defined later
  graphTraversalData?: any; // Will be defined later
}

export interface DiagramMetadata {
  title: string;
  description?: string;
  sourceFile: string;
  lastModified: number;
  nodeCount: number;
  edgeCount: number;
}

export interface DiagramResult {
  success: boolean;
  data?: DiagramData;
  error?: string;
  performance?: {
    renderTime: number;
    layoutTime: number;
    totalTime: number;
  };
}

// Feature Model specific interfaces
export interface FeatureNode extends DiagramNode {
  constraintType: ConstraintType;
  selected?: boolean;
}

export interface FeatureModelData extends DiagramData {
  type: DiagramType.FeatureModel;
  nodes: FeatureNode[];
  orientation: LayoutOrientation;
  rootFeature?: string;
}

// Variant Model specific interfaces
export interface VariantNode extends FeatureNode {
  selected: boolean;
  flags: string[];
}

export interface VariantModelData extends DiagramData {
  type: DiagramType.VariantModel;
  nodes: VariantNode[];
  selectionCount: number;
  totalCount: number;
}

// Internal Block Diagram specific interfaces
export interface SylangBlock {
  id: string;
  name: string;
  description?: string;
  level?: 'productline' | 'system' | 'subsystem' | 'component' | 'module' | 'interface';
  safetylevel?: string;
  owner?: string;
  tags?: string[];
  designrationale?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ports: SylangPort[];
  composedof?: string[];
  enables?: string[];
  inherits?: string[];
  config?: string;
  fileUri: string;
}

export interface SylangPort {
  id: string;
  name: string;
  description?: string;
  direction: 'in' | 'out';
  porttype?: 'data' | 'communication' | 'control' | 'power';
  owner?: string;
  safetylevel?: string;
  tags?: string[];
  x: number;
  y: number;
  width?: number;  // Port rectangle width
  height?: number; // Port rectangle height
  config?: string;
}

export interface SylangConnection {
  id: string;
  from: string; // port id
  to: string;   // port id
  type?: string;
}

export interface InternalBlockDiagramData {
  type: DiagramType.InternalBlockDiagram;
  blocks: SylangBlock[];
  connections: SylangConnection[];
  metadata: DiagramMetadata;
}

// Graph Traversal specific interfaces
export interface GraphNode extends DiagramNode {
  symbolType: 'hdef' | 'def';
  fileUri: string;
  connections: string[];
}

export interface GraphEdge extends DiagramEdge {
  relationType: string;
  cardinality?: '1:1' | '1:many' | 'many:many';
}

export interface GraphTraversalData extends DiagramData {
  type: DiagramType.GraphTraversal;
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: { [key: string]: string[] };
  fileGroups: { [key: string]: string[] };
}

export interface TraceTreeData extends DiagramData {
  type: DiagramType.TraceTree;
  hierarchy: any; // D3 hierarchy object
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Layout algorithm interfaces
export interface LayoutOptions {
  orientation?: LayoutOrientation;
  spacing?: {
    horizontal: number;
    vertical: number;
  };
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  [key: string]: any;
}

export interface LayoutResult {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  performance: {
    layoutTime: number;
    iterationCount: number;
  };
}

// Webview communication interfaces
export interface WebviewMessage {
  type: string;
  payload: any;
  timestamp: number;
}

export interface DiagramLogMessage extends WebviewMessage {
  type: 'log';
  payload: {
    message: string;
    level?: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface DiagramUpdateMessage extends WebviewMessage {
  type: 'update';
  payload: {
    diagramType: DiagramType;
    data: DiagramData;
  };
}

export interface DiagramExportMessage extends WebviewMessage {
  type: 'export';
  payload: {
    format: 'png' | 'svg' | 'pdf';
    filename?: string;
  };
}

export interface DiagramRefreshMessage extends WebviewMessage {
  type: 'refresh';
  payload: {
    diagramType: DiagramType;
    sourceFile: string;
  };
}

// Performance monitoring interfaces
export interface PerformanceMetrics {
  renderTime: number;
  layoutTime: number;
  dataTransformTime: number;
  totalTime: number;
  memoryUsage: number;
  nodeCount: number;
  edgeCount: number;
}

export interface PerformanceThresholds {
  maxRenderTime: number;
  maxLayoutTime: number;
  maxMemoryUsage: number;
  maxNodeCount: number;
  maxEdgeCount: number;
} 