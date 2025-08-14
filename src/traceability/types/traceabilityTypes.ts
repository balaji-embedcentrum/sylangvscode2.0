/**
 * Traceability Matrix Types
 * Loosely coupled component for relationship analysis
 */

export interface TraceSymbol {
  id: string;
  name: string;
  type: string;           // 'requirement', 'testcase', 'function', etc.
  kind: string;           // 'requirement', 'testcase', 'function', etc.
  fileUri: string;
  symbolType: 'hdef' | 'def';
  properties: Map<string, string[]>;
}

export interface MatrixCell {
  relationships: string[];       // ['satisfies', 'implements'] 
  isValid: boolean;             // All targets found?
  count: number;                // Number of relationships
  rawValues: string[];          // Original property values for debugging
  tooltip?: string;             // Cell hover information
}

export interface SymbolGroup {
  type: string;                 // 'requirement', 'testcase', 'function'
  displayName: string;          // 'Requirements', 'Test Cases', 'Functions'
  symbols: TraceSymbol[];       // Symbols of this type
  color: string;                // Visual grouping color
  count: number;                // Symbol count
}

export interface MatrixData {
  sourceGroups: SymbolGroup[];      // Row groups
  targetGroups: SymbolGroup[];      // Column groups
  matrix: MatrixCell[][];           // [row][col] = relationships
  summary: TraceSummary;            // Coverage statistics
  metadata: MatrixMetadata;         // Generation info
}

export interface TraceSummary {
  totalRelationships: number;
  validRelationships: number;
  brokenRelationships: number;
  coverageByType: { [relationshipType: string]: number };
  orphanedSymbols: TraceSymbol[];   // No incoming relationships
  unlinkedSymbols: TraceSymbol[];   // No outgoing relationships
}

export interface MatrixMetadata {
  title: string;
  description: string;
  sourceFile: string;
  generatedAt: string;
  symbolCount: number;
  relationshipTypes: string[];
}

export interface TraceabilityViewData {
  type: 'traceability-matrix';
  data: MatrixData;
  metadata: MatrixMetadata;
}

export interface MatrixFilter {
  relationshipTypes: string[];      // Filter by relationship type
  sourceTypes: string[];           // Filter by source symbol type
  targetTypes: string[];           // Filter by target symbol type
  showValid: boolean;              // Show valid relationships
  showBroken: boolean;             // Show broken relationships
  showEmpty: boolean;              // Show empty cells
}

export interface ExportOptions {
  format: 'excel' | 'csv' | 'json';
  includeMetadata: boolean;
  includeSummary: boolean;
  separateSheetsByType: boolean;
  colorCoding: boolean;
}

// Standards compliance views
export interface ComplianceView {
  name: string;                    // 'ASPICE', 'ISO26262', 'DO-178C'
  description: string;
  requiredChains: RelationshipChain[];
}

export interface RelationshipChain {
  name: string;                    // 'Requirement Implementation'
  path: string[];                  // ['requirement', 'satisfies', 'testcase']
  sourceType: string;
  targetType: string;
  relationshipType: string;
}
