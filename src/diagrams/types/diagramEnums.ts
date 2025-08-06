// Diagram-specific enums
export enum ConstraintType {
  Mandatory = 'mandatory',
  Optional = 'optional',
  Or = 'or',
  Alternative = 'alternative'
}

export enum NodeType {
  Feature = 'feature',
  Block = 'block',
  Port = 'port',
  Symbol = 'symbol'
}

export enum EdgeType {
  Hierarchy = 'hierarchy',
  Requires = 'requires',
  Excludes = 'excludes',
  ComposedOf = 'composedof',
  Enables = 'enables',
  AllocatedTo = 'allocatedto',
  Implements = 'implements',
  Satisfies = 'satisfies',
  Refines = 'refines',
  Derives = 'derives'
}

export enum SymbolType {
  Header = 'hdef',
  Definition = 'def'
}

export enum BlockType {
  System = 'system',
  Subsystem = 'subsystem',
  Component = 'component'
}

export enum PortType {
  Input = 'in',
  Output = 'out',
  InOut = 'inout'
}

export enum ExportFormat {
  PNG = 'png',
  SVG = 'svg',
  PDF = 'pdf'
}

export enum UpdateTrigger {
  FileClick = 'file-click',
  DiagramFocus = 'diagram-focus',
  FileChange = 'file-change',
  ManualRefresh = 'manual-refresh'
}

export enum PerformanceLevel {
  Low = 'low',      // < 100 nodes
  Medium = 'medium', // 100-1000 nodes
  High = 'high',     // 1000-10000 nodes
  Ultra = 'ultra'    // > 10000 nodes
}

export enum RenderingMode {
  DOM = 'dom',       // DOM-based rendering
  Canvas = 'canvas', // Canvas-based rendering
  WebGL = 'webgl'    // WebGL-based rendering
}

export enum LayoutAlgorithm {
  Hierarchical = 'hierarchical',
  ForceDirected = 'force-directed',
  Circular = 'circular',
  Radial = 'radial',
  Orthogonal = 'orthogonal'
}

export enum ZoomLevel {
  Overview = 0.25,   // 25% zoom
  Normal = 1.0,      // 100% zoom
  Detail = 2.0,      // 200% zoom
  Fine = 4.0         // 400% zoom
}

export enum Theme {
  Light = 'light',
  Dark = 'dark',
  HighContrast = 'high-contrast'
}

export enum AccessibilityLevel {
  Basic = 'basic',
  Enhanced = 'enhanced',
  Full = 'full'
} 