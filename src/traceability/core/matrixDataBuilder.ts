import * as vscode from 'vscode';
import { SylangSymbolManager, SylangSymbol } from '../../core/symbolManager';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { SYLANG_FILE_TYPES, KeywordType } from '../../core/keywords';
import { 
  TraceSymbol, 
  MatrixData, 
  MatrixCell, 
  SymbolGroup, 
  TraceSummary,
  MatrixMetadata,
  MatrixFilter
} from '../types/traceabilityTypes';

/**
 * Builds traceability matrix data from symbol relationships
 * Loosely coupled component - does not modify existing code
 */
export class TraceabilityMatrixDataBuilder {
  private logger: SylangLogger;
  private symbolManager: SylangSymbolManager;
  private _relationshipKeywordsCache?: Set<string>;

  constructor(symbolManager: SylangSymbolManager, logger: SylangLogger) {
    this.symbolManager = symbolManager;
    this.logger = logger;
  }

  /**
   * Build complete traceability matrix from all project symbols
   */
  async buildMatrixData(sourceFileUri: vscode.Uri, filter?: MatrixFilter): Promise<MatrixData> {
    this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY MATRIX')} - Building traceability matrix${filter ? ' with filters' : ''}`);
    
    // Check if symbol manager is available
    if (!this.symbolManager) {
      throw new Error('Symbol manager is not available');
    }
    
    const allSymbols = this.symbolManager.getAllSymbols();
    this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY MATRIX')} - Processing ${allSymbols.length} symbols`);
    
    // Convert to trace symbols
    const traceSymbols = this.convertToTraceSymbols(allSymbols);
    
    // Group symbols by type
    let sourceGroups = this.groupSymbolsByType(traceSymbols, 'source');
    let targetGroups = this.groupSymbolsByType(traceSymbols, 'target');
    
    // Apply group-level filters if specified
    if (filter?.sourceTypes?.length) {
      sourceGroups = sourceGroups.filter(group => filter.sourceTypes.includes(group.type));
      this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY MATRIX')} - Filtered to ${sourceGroups.length} source groups`);
    }
    
    if (filter?.targetTypes?.length) {
      targetGroups = targetGroups.filter(group => filter.targetTypes.includes(group.type));
      this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY MATRIX')} - Filtered to ${targetGroups.length} target groups`);
    }
    
    // Build relationship matrix with the filtered groups
    const matrix = this.buildRelationshipMatrix(sourceGroups, targetGroups, filter);
    
    // Generate summary statistics
    const summary = this.generateSummary(sourceGroups, targetGroups, matrix);
    
    // Create metadata
    const metadata: MatrixMetadata = {
      title: 'Sylang: Traceability Matrix',
      description: 'Complete relationship matrix for project traceability analysis',
      sourceFile: sourceFileUri.fsPath,
      generatedAt: new Date().toISOString(),
      symbolCount: allSymbols.length,
      relationshipTypes: Array.from(this.getAllRelationshipKeywords())
    };
    
    this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY MATRIX')} - Matrix complete: ${sourceGroups.length} source groups, ${targetGroups.length} target groups`);
    
    return {
      sourceGroups,
      targetGroups,
      matrix,
      summary,
      metadata
    };
  }

  /**
   * Convert SylangSymbols to TraceSymbols (excluding .spr/.agt files)
   */
  private convertToTraceSymbols(symbols: SylangSymbol[]): TraceSymbol[] {
    return symbols
      .filter(symbol => {
        // Filter out .spr and .agt files - not relevant for traceability
        const fileExt = symbol.fileUri.fsPath.split('.').pop() || '';
        return fileExt !== 'spr' && fileExt !== 'agt';
      })
      .map(symbol => ({
        id: `${symbol.fileUri.fsPath}:${symbol.name}`,
        name: symbol.name,
        type: symbol.kind,
        kind: symbol.kind,
        fileUri: symbol.fileUri.fsPath,
        symbolType: symbol.type as 'hdef' | 'def',
        properties: symbol.properties
      }));
  }

  /**
   * Group symbols by their type (requirement, testcase, function, etc.)
   */
  private groupSymbolsByType(symbols: TraceSymbol[], _context: 'source' | 'target'): SymbolGroup[] {
    const groups = new Map<string, TraceSymbol[]>();
    
    // Group symbols by type
    for (const symbol of symbols) {
      const type = symbol.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(symbol);
    }
    
    // Convert to SymbolGroup array with colors
    const symbolGroups: SymbolGroup[] = [];
    const colors = this.getTypeColors();
    let colorIndex = 0;
    
    for (const [type, typeSymbols] of groups) {
      symbolGroups.push({
        type,
        displayName: this.getDisplayName(type),
        symbols: typeSymbols.sort((a, b) => a.name.localeCompare(b.name)),
        color: colors[colorIndex % colors.length],
        count: typeSymbols.length
      });
      colorIndex++;
    }
    
    return symbolGroups.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * Build the relationship matrix
   */
  private buildRelationshipMatrix(
    sourceGroups: SymbolGroup[], 
    targetGroups: SymbolGroup[], 
    filter?: MatrixFilter
  ): MatrixCell[][] {
    
    // Flatten symbols for easier lookup (groups are already filtered)
    const allSourceSymbols = sourceGroups.flatMap(g => g.symbols);
    const allTargetSymbols = targetGroups.flatMap(g => g.symbols);
    const targetLookup = new Map<string, TraceSymbol>();
    allTargetSymbols.forEach(symbol => targetLookup.set(symbol.name, symbol));
    
    const matrix: MatrixCell[][] = [];
    const relationshipKeywords = this.getAllRelationshipKeywords();
    
    for (let sourceIdx = 0; sourceIdx < allSourceSymbols.length; sourceIdx++) {
      const sourceSymbol = allSourceSymbols[sourceIdx];
      const row: MatrixCell[] = [];
      
      for (let targetIdx = 0; targetIdx < allTargetSymbols.length; targetIdx++) {
        const targetSymbol = allTargetSymbols[targetIdx];
        const cell = this.buildMatrixCell(sourceSymbol, targetSymbol, targetLookup, relationshipKeywords, filter);
        
        // Apply cell-level filters to decide if we should show the cell content
        if (this.shouldIncludeCell(cell, filter)) {
          row.push(cell);
        } else {
          // Push empty cell to maintain matrix structure but hide content
          row.push({
            relationships: [],
            isValid: true,
            count: 0,
            rawValues: []
          });
        }
      }
      
      matrix.push(row);
    }
    
    return matrix;
  }

  /**
   * Check if a cell should be included based on filter criteria
   */
  private shouldIncludeCell(cell: MatrixCell, filter?: MatrixFilter): boolean {
    if (!filter) return true;
    
    const hasRelationships = cell.count > 0;
    const isBroken = !cell.isValid;
    const isEmpty = cell.count === 0;
    
    // Check show filters
    if (!filter.showValid && hasRelationships && !isBroken) return false;
    if (!filter.showBroken && isBroken) return false;
    if (!filter.showEmpty && isEmpty) return false;
    
    return true;
  }

  /**
   * Build a single matrix cell
   */
  private buildMatrixCell(
    sourceSymbol: TraceSymbol, 
    targetSymbol: TraceSymbol, 
    targetLookup: Map<string, TraceSymbol>,
    relationshipKeywords: Set<string>,
    filter?: MatrixFilter
  ): MatrixCell {
    
    const relationships: string[] = [];
    const rawValues: string[] = [];
    let validCount = 0;
    
    // Check all properties of source symbol for relationships to target
    for (const [propertyName, values] of sourceSymbol.properties) {
      if (relationshipKeywords.has(propertyName)) {
        
        // Apply relationship type filter
        if (filter?.relationshipTypes.length && !filter.relationshipTypes.includes(propertyName)) {
          continue;
        }
        
        for (const value of values) {
          // Clean the reference value
          let cleanValue = value.replace(/^ref\s+\w+\s+/, '').replace(/^ref\s+/, '').trim();
          const targetIdentifiers = cleanValue.split(',').map(id => id.trim()).filter(id => id.length > 0);
          
          for (const targetId of targetIdentifiers) {
            if (targetId === targetSymbol.name) {
              relationships.push(propertyName);
              rawValues.push(value);
              
              // Check if target exists
              if (targetLookup.has(targetId)) {
                validCount++;
              }
            }
          }
        }
      }
    }
    
    return {
      relationships: [...new Set(relationships)], // Remove duplicates
      isValid: relationships.length === 0 || validCount === relationships.length,
      count: relationships.length,
      rawValues,
      tooltip: this.generateCellTooltip(sourceSymbol, targetSymbol, relationships, rawValues)
    };
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(sourceGroups: SymbolGroup[], targetGroups: SymbolGroup[], matrix: MatrixCell[][]): TraceSummary {
    let totalRelationships = 0;
    let validRelationships = 0;
    let brokenRelationships = 0;
    const coverageByType: { [relationshipType: string]: number } = {};
    
    // Count relationships
    for (const row of matrix) {
      for (const cell of row) {
        totalRelationships += cell.count;
        if (cell.isValid) {
          validRelationships += cell.count;
        } else {
          brokenRelationships += cell.count;
        }
        
        // Count by type
        for (const relType of cell.relationships) {
          coverageByType[relType] = (coverageByType[relType] || 0) + 1;
        }
      }
    }
    
    // Find orphaned and unlinked symbols
    const allSourceSymbols = sourceGroups.flatMap(g => g.symbols);
    const allTargetSymbols = targetGroups.flatMap(g => g.symbols);
    
    const orphanedSymbols = this.findOrphanedSymbols(allTargetSymbols, matrix);
    const unlinkedSymbols = this.findUnlinkedSymbols(allSourceSymbols, matrix);
    
    return {
      totalRelationships,
      validRelationships,
      brokenRelationships,
      coverageByType,
      orphanedSymbols,
      unlinkedSymbols
    };
  }

  /**
   * Get all relationship keywords from keyword system
   */
  private getAllRelationshipKeywords(): Set<string> {
    if (!this._relationshipKeywordsCache) {
      this._relationshipKeywordsCache = new Set<string>();
      
      for (const fileType of SYLANG_FILE_TYPES) {
        for (const keyword of fileType.allowedKeywords) {
          if (keyword.type === KeywordType.RELATION) {
            this._relationshipKeywordsCache.add(keyword.name);
          }
        }
      }
    }
    
    return this._relationshipKeywordsCache;
  }

  /**
   * Generate tooltip for matrix cell
   */
  private generateCellTooltip(source: TraceSymbol, target: TraceSymbol, relationships: string[], rawValues: string[]): string {
    if (relationships.length === 0) {
      return `No relationships from ${source.name} to ${target.name}`;
    }
    
    let tooltip = `${source.name} → ${target.name}\n`;
    tooltip += `Relationships: ${relationships.join(', ')}\n`;
    if (rawValues.length > 0) {
      tooltip += `Raw values: ${rawValues.join(', ')}`;
    }
    
    return tooltip;
  }

  /**
   * Find symbols with no incoming relationships
   */
  private findOrphanedSymbols(symbols: TraceSymbol[], matrix: MatrixCell[][]): TraceSymbol[] {
    const hasIncoming = new Set<number>();
    
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col].count > 0) {
          hasIncoming.add(col);
        }
      }
    }
    
    return symbols.filter((_, index) => !hasIncoming.has(index));
  }

  /**
   * Find symbols with no outgoing relationships
   */
  private findUnlinkedSymbols(symbols: TraceSymbol[], matrix: MatrixCell[][]): TraceSymbol[] {
    const hasOutgoing = new Set<number>();
    
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col].count > 0) {
          hasOutgoing.add(row);
        }
      }
    }
    
    return symbols.filter((_, index) => !hasOutgoing.has(index));
  }

  /**
   * Get display name for symbol type
   */
  private getDisplayName(type: string): string {
    const displayNames: { [key: string]: string } = {
      'requirement': 'Requirements',
      'testcase': 'Test Cases', 
      'function': 'Functions',
      'feature': 'Features',
      'block': 'Blocks',
      'config': 'Configurations',
      'productline': 'Product Lines',
      'featureset': 'Feature Sets',
      'variantset': 'Variant Sets',
      'configset': 'Config Sets',
      'functionset': 'Function Sets',
      'requirementset': 'Requirement Sets',
      'testset': 'Test Sets',
      'sprint': 'Sprints',
      'agent': 'Agents'
    };
    
    return displayNames[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  /**
   * Get color scheme for symbol types
   */
  private getTypeColors(): string[] {
    return [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#10AC84', '#EE5A24', '#0984E3', '#A29BFE', '#FD79A8'
    ];
  }
}
