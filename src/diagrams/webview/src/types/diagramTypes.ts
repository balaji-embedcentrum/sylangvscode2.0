// Webview-specific diagram types
export enum DiagramType {
  FeatureModel = 'feature-model',
  VariantModel = 'variant-model',
  InternalBlockDiagram = 'internal-block-diagram',
  GraphTraversal = 'graph-traversal'
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

export interface DiagramNode {
  id: string;
  name: string;
  position?: { x: number; y: number };
  size: { width: number; height: number };
  type?: string;
  properties?: Record<string, any>;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties?: Record<string, any>;
}

export interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  metadata?: DiagramMetadata;
  // Optional specific payloads used by containers
  internalBlockDiagramData?: InternalBlockDiagramData;
}

export interface DiagramMetadata {
  title?: string;
  description?: string;
  version?: string;
  author?: string;
  created?: string;
  modified?: string;
}

export interface LayoutOptions {
  algorithm?: string;
  parameters?: Record<string, any>;
}

export interface LayoutResult {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  bounds: { x: number; y: number; width: number; height: number };
  performance: {
    layoutTime: number;
    iterationCount: number;
  };
}

export interface WebviewMessage {
  type: string;
  payload: any;
}

export interface DiagramUpdateMessage extends WebviewMessage {
  type: 'update';
  payload: {
    data: DiagramData;
    trigger: UpdateTrigger;
  };
}

export interface DiagramExportMessage extends WebviewMessage {
  type: 'export';
  payload: {
    format: string;
    filename?: string;
  };
}

export interface DiagramRefreshMessage extends WebviewMessage {
  type: 'refresh';
  payload: {
    trigger: UpdateTrigger;
  };
}

export interface PerformanceMetrics {
  renderTime: number;
  layoutTime: number;
  memoryUsage?: number;
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

// Feature Model specific types
export interface FeatureNode extends DiagramNode {
  constraintType: ConstraintType;
  selected?: boolean;
}

export interface FeatureModelData extends DiagramData {
  rootFeature?: string;
  orientation: LayoutOrientation;
  nodes: FeatureNode[];
}

// Variant Model specific types
export interface VariantNode extends DiagramNode {
  variantType: string;
  selected?: boolean;
}

export interface VariantModelData extends DiagramData {
  rootVariant?: string;
  nodes: VariantNode[];
}

// Internal Block Diagram specific types
export interface BlockNode extends DiagramNode {
  blockType: string;
  ports?: PortNode[];
}

export interface PortNode extends DiagramNode {
  portType: string;
  direction: string;
  connectedTo?: string[];
}

export interface InternalBlockDiagramData extends DiagramData {
  // Explicit shape used by InternalBlockDiagram component
  blocks: SylangBlock[];
  connections: SylangConnection[];
}

// Align with extension-side IBD structures for strong typing in webview
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
  width?: number;
  height?: number;
  config?: string;
}

export interface SylangConnection {
  id: string;
  from: string;
  to: string;
  type?: string;
}

// Graph Traversal specific types
export interface GraphNode extends DiagramNode {
  nodeType: string;
  weight?: number;
  cluster?: string;
}

export interface GraphEdge extends DiagramEdge {
  weight?: number;
  bidirectional?: boolean;
}

export interface GraphTraversalData extends DiagramData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  startNode?: string;
  endNode?: string;
} 