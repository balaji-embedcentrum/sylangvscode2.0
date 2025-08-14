import * as vscode from 'vscode';
import { SylangSymbolManager } from '../../core/symbolManager';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { TraceabilityMatrixDataBuilder } from './matrixDataBuilder';
import { MatrixData, MatrixFilter, ExportOptions } from '../types/traceabilityTypes';

/**
 * Webview provider for traceability matrix
 * Creates Excel-like matrix view of all relationships
 */
export class TraceabilityMatrixProvider {
  private logger: SylangLogger;
  private dataBuilder: TraceabilityMatrixDataBuilder;
  private activePanel?: vscode.WebviewPanel;
  private currentSourceFile?: vscode.Uri;

  constructor(symbolManager: SylangSymbolManager, logger: SylangLogger) {
    this.logger = logger;
    this.dataBuilder = new TraceabilityMatrixDataBuilder(symbolManager, logger);
  }

  /**
   * Show traceability matrix view
   */
  async showTraceabilityMatrix(sourceFileUri: vscode.Uri): Promise<void> {
    this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY PROVIDER')} - Creating traceability matrix view`);

    // Store the current source file for filter operations
    this.currentSourceFile = sourceFileUri;

    // Close existing panel if open
    if (this.activePanel) {
      this.activePanel.dispose();
    }

    // Create webview panel
    this.activePanel = vscode.window.createWebviewPanel(
      'sylangTraceabilityMatrix',
      'Sylang: Traceability Matrix',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );

    // Set up panel disposal
    this.activePanel.onDidDispose(() => {
      this.activePanel = undefined;
      this.currentSourceFile = undefined;
      this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY PROVIDER')} - Matrix panel disposed`);
    });

    // Load and display data
    await this.loadMatrixData(sourceFileUri);

    // Set up message handling for interactions
    this.setupMessageHandling();
  }

  /**
   * Load matrix data and update webview
   */
  private async loadMatrixData(sourceFileUri: vscode.Uri, filter?: MatrixFilter): Promise<void> {
    if (!this.activePanel) return;

    try {
      this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY PROVIDER')} - Loading matrix data`);
      
      const matrixData = await this.dataBuilder.buildMatrixData(sourceFileUri, filter);
      
      this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY PROVIDER')} - Matrix data loaded: ${matrixData.summary.totalRelationships} relationships`);
      
      // Generate and set HTML content
      const htmlContent = this.generateMatrixHTML(matrixData);
      this.activePanel.webview.html = htmlContent;
      
      // Send data to webview
      this.activePanel.webview.postMessage({
        type: 'updateMatrix',
        data: this.serializeMatrixData(matrixData)
      });
      
    } catch (error) {
      this.logger.error(`🔗 ${getVersionedLogger('TRACEABILITY PROVIDER')} - Failed to load matrix data: ${error}`);
      
      if (this.activePanel) {
        this.activePanel.webview.html = this.generateErrorHTML(`Failed to load traceability matrix: ${error}`);
      }
    }
  }

  /**
   * Set up message handling for webview interactions
   */
  private setupMessageHandling(): void {
    if (!this.activePanel) return;

    this.activePanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'exportExcel':
          await this.handleExportExcel(message.options);
          break;
          
        case 'applyFilter':
          await this.handleApplyFilter(message.filter);
          break;
          
        case 'navigateToSymbol':
          await this.handleNavigateToSymbol(message.symbolId);
          break;
          
        case 'showCellDetails':
          this.handleShowCellDetails(message.sourceId, message.targetId);
          break;
          
        default:
          this.logger.warn(`🔗 ${getVersionedLogger('TRACEABILITY PROVIDER')} - Unknown message type: ${message.type}`);
      }
    });
  }

  /**
   * Generate HTML for matrix view
   */
  private generateMatrixHTML(matrixData: MatrixData): string {
    const { metadata, summary } = matrixData;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <style>
        :root {
            --vscode-background: var(--vscode-editor-background);
            --vscode-foreground: var(--vscode-editor-foreground);
            --vscode-border: var(--vscode-panel-border);
        }
        
        html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: auto;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            background: var(--vscode-background);
            color: var(--vscode-foreground);
            padding: 20px;
            min-height: 100vh;
        }
        
        .header {
            border-bottom: 1px solid var(--vscode-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        
        .title {
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 8px 0;
        }
        
        .description {
            color: var(--vscode-descriptionForeground);
            margin: 0 0 10px 0;
        }
        
        .metadata {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .toolbar {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            align-items: center;
        }
        
        .filter-group {
            display: flex;
            gap: 5px;
            align-items: center;
        }
        
        .filter-group label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        select, button {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 8px;
            font-size: 12px;
        }
        
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
        }
        
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .summary {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
            font-size: 12px;
        }
        
        .summary-item {
            padding: 5px 10px;
            background: var(--vscode-input-background);
            border-radius: 3px;
        }
        
        .matrix-container {
            position: relative;
            height: 70vh;
            min-height: 400px;
            overflow-x: auto;
            overflow-y: auto;
            border: 1px solid var(--vscode-border);
            width: 100%;
            background: var(--vscode-editor-background);
        }
        
        .matrix-table {
            border-collapse: collapse;
            width: max-content;
            min-width: 100%;
            table-layout: fixed;
        }
        
        .matrix-table th,
        .matrix-table td {
            border: 1px solid var(--vscode-border);
            padding: 4px 6px;
            text-align: center;
            position: relative;
            width: 70px;
            min-width: 70px;
            max-width: 70px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 11px;
            box-sizing: border-box;
        }
        
        .matrix-table th {
            background: var(--vscode-editorGroupHeader-tabsBackground);
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        .row-header {
            background: var(--vscode-editorGroupHeader-tabsBackground);
            position: sticky;
            left: 0;
            z-index: 5;
            font-weight: 600;
            text-align: left;
            min-width: 120px;
            max-width: 180px;
            font-size: 11px;
        }
        
        .row-header.sticky-left {
            z-index: 15;
        }
        
        .matrix-cell {
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .matrix-cell:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .matrix-cell.has-relationship {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-weight: 500;
        }
        
        .matrix-cell.broken-relationship {
            background: var(--vscode-errorForeground);
            color: white;
        }
        
        .group-header {
            background: var(--vscode-editorGroupHeader-tabsBackground);
            font-weight: bold;
            text-align: center;
            font-size: 11px;
            padding: 2px 4px;
        }
        
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
            color: var(--vscode-descriptionForeground);
        }
        
        /* Force scrollbars to always be visible */
        .matrix-container {
            scrollbar-width: auto; /* Firefox */
            scrollbar-color: var(--vscode-scrollbarSlider-hoverBackground) var(--vscode-scrollbarSlider-background); /* Firefox */
        }
        
        /* Webkit scrollbar styling */
        .matrix-container::-webkit-scrollbar {
            width: 16px;
            height: 16px;
            background: var(--vscode-scrollbarSlider-background);
        }
        
        .matrix-container::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 8px;
        }
        
        .matrix-container::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
            border-radius: 8px;
            border: 2px solid var(--vscode-scrollbarSlider-background);
        }
        
        .matrix-container::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-activeBackground);
        }
        
        .matrix-container::-webkit-scrollbar-corner {
            background: var(--vscode-scrollbarSlider-background);
        }
        
        /* Overall body scrollbar styling */
        body::-webkit-scrollbar {
            width: 16px;
            height: 16px;
            background: var(--vscode-scrollbarSlider-background);
        }
        
        body::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 8px;
        }
        
        body::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
            border-radius: 8px;
            border: 2px solid var(--vscode-scrollbarSlider-background);
        }
        
        body::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-activeBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">${metadata.title}</h1>
        <p class="description">${metadata.description}</p>
        <div class="metadata">
            Generated: ${new Date(metadata.generatedAt).toLocaleString()} | 
            Symbols: ${metadata.symbolCount} | 
            Relationships: ${metadata.relationshipTypes.length} types
        </div>
    </div>
    
    <div class="toolbar">
        <div class="filter-group">
            <label>Relationship:</label>
            <select id="relationshipFilter" multiple>
                <option value="">All Types</option>
                ${metadata.relationshipTypes.map(type => 
                    `<option value="${type}">${type}</option>`
                ).join('')}
            </select>
        </div>
        
        <div class="filter-group">
            <label>Show:</label>
            <select id="showFilter">
                <option value="all">All Cells</option>
                <option value="relationships">Only Relationships</option>
                <option value="broken">Only Broken</option>
            </select>
        </div>
        
        <button id="exportExcel">Export to CSV</button>
        <button id="refreshMatrix">Refresh</button>
    </div>
    
    <div class="summary">
        <div class="summary-item">Total: ${summary.totalRelationships}</div>
        <div class="summary-item">Valid: ${summary.validRelationships}</div>
        <div class="summary-item">Broken: ${summary.brokenRelationships}</div>
        <div class="summary-item">Coverage: ${Math.round((summary.validRelationships / Math.max(summary.totalRelationships, 1)) * 100)}%</div>
    </div>
    
    <div class="matrix-container">
        <div id="loadingMessage" class="loading">Loading traceability matrix...</div>
        <table id="matrixTable" class="matrix-table" style="display: none;">
            <!-- Matrix content will be populated by JavaScript -->
        </table>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let matrixData = null;
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'updateMatrix':
                    matrixData = message.data;
                    renderMatrix();
                    break;
                case 'getMatrixData':
                    // Send current matrix data back to extension for export
                    vscode.postMessage({
                        type: 'matrixDataResponse',
                        data: matrixData
                    });
                    break;
            }
        });
        
        // Event handlers
        document.getElementById('exportExcel').addEventListener('click', () => {
            vscode.postMessage({
                type: 'exportExcel',
                options: {
                    format: 'excel',
                    includeMetadata: true,
                    includeSummary: true,
                    separateSheetsByType: true,
                    colorCoding: true
                }
            });
        });
        
        document.getElementById('refreshMatrix').addEventListener('click', () => {
            location.reload();
        });
        
        document.getElementById('relationshipFilter').addEventListener('change', applyFilters);
        document.getElementById('showFilter').addEventListener('change', applyFilters);
        
        function applyFilters() {
            const relationshipFilter = Array.from(document.getElementById('relationshipFilter').selectedOptions).map(opt => opt.value);
            const showFilter = document.getElementById('showFilter').value;
            
            vscode.postMessage({
                type: 'applyFilter',
                filter: {
                    relationshipTypes: relationshipFilter,
                    sourceTypes: [],
                    targetTypes: [],
                    showValid: showFilter === 'all' || showFilter === 'relationships',
                    showBroken: showFilter === 'all' || showFilter === 'broken',
                    showEmpty: showFilter === 'all'
                }
            });
        }
        
        function renderMatrix() {
            if (!matrixData) return;
            
            const loadingElement = document.getElementById('loadingMessage');
            const tableElement = document.getElementById('matrixTable');
            
            loadingElement.style.display = 'none';
            tableElement.style.display = 'table';
            
            // Calculate expected table width for debugging
            const totalTargets = matrixData.targetGroups.reduce((sum, group) => sum + group.count, 0);
            const expectedWidth = 180 + (totalTargets * 70); // 180px for row header + 70px per column
            console.log(\`Expected table width: \${expectedWidth}px for \${totalTargets} columns\`);
            
            // Generate matrix HTML
            let html = '<thead><tr><th class="row-header sticky-left">Source \\\\ Target</th>';
            
            // Column headers (target groups)
            for (const targetGroup of matrixData.targetGroups) {
                html += \`<th colspan="\${targetGroup.count}" class="group-header" style="background-color: \${targetGroup.color}20">\${targetGroup.displayName} (\${targetGroup.count})</th>\`;
            }
            html += '</tr><tr><th class="row-header sticky-left"></th>';
            
            // Individual target symbol headers
            for (const targetGroup of matrixData.targetGroups) {
                for (const symbol of targetGroup.symbols) {
                    const displayName = symbol.name.length > 12 ? symbol.name.substring(0, 9) + '...' : symbol.name;
                    html += \`<th title="\${symbol.name}" style="writing-mode: vertical-rl; text-orientation: mixed; width: 70px; min-width: 70px; max-width: 70px;">\${displayName}</th>\`;
                }
            }
            html += '</tr></thead><tbody>';
            
            // Matrix rows
            let sourceIndex = 0;
            for (const sourceGroup of matrixData.sourceGroups) {
                // Group header row
                html += \`<tr><td class="row-header group-header" style="background-color: \${sourceGroup.color}20">\${sourceGroup.displayName} (\${sourceGroup.count})</td>\`;
                const totalTargets = matrixData.targetGroups.reduce((sum, group) => sum + group.count, 0);
                html += \`<td colspan="\${totalTargets}" class="group-header"></td></tr>\`;
                
                // Individual symbol rows
                for (const sourceSymbol of sourceGroup.symbols) {
                    html += \`<tr><td class="row-header" title="\${sourceSymbol.name}">\${sourceSymbol.name}</td>\`;
                    
                    let targetIndex = 0;
                    for (const targetGroup of matrixData.targetGroups) {
                        for (const targetSymbol of targetGroup.symbols) {
                            const cell = matrixData.matrix[sourceIndex][targetIndex];
                            const cellClass = getCellClass(cell);
                            const cellContent = getCellContent(cell);
                            const cellTitle = cell.tooltip || '';
                            
                            html += \`<td class="matrix-cell \${cellClass}" title="\${cellTitle}" data-source="\${sourceIndex}" data-target="\${targetIndex}">\${cellContent}</td>\`;
                            targetIndex++;
                        }
                    }
                    html += '</tr>';
                    sourceIndex++;
                }
            }
            
            html += '</tbody>';
            tableElement.innerHTML = html;
            
            // Add click handlers
            document.querySelectorAll('.matrix-cell').forEach(cell => {
                cell.addEventListener('click', (e) => {
                    const sourceIndex = e.target.dataset.source;
                    const targetIndex = e.target.dataset.target;
                    
                    vscode.postMessage({
                        type: 'showCellDetails',
                        sourceId: sourceIndex,
                        targetId: targetIndex
                    });
                });
            });
        }
        
        function getCellClass(cell) {
            if (cell.count === 0) return '';
            if (!cell.isValid) return 'broken-relationship';
            return 'has-relationship';
        }
        
        function getCellContent(cell) {
            if (cell.count === 0) return '';
            if (cell.relationships.length === 1) return cell.relationships[0];
            return cell.count.toString();
        }
    </script>
</body>
</html>`;
  }

  /**
   * Generate error HTML
   */
  private generateErrorHTML(error: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Traceability Matrix Error</title>
    <style>
        body {
            font-family: var(--vscode-editor-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
        }
        .error {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 15px;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="error">
        <h3>Failed to Load Traceability Matrix</h3>
        <p>${error}</p>
        <p>Please check the Sylang output panel for more details.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Serialize matrix data for webview (remove complex objects)
   */
  private serializeMatrixData(matrixData: MatrixData): any {
    return {
      sourceGroups: matrixData.sourceGroups,
      targetGroups: matrixData.targetGroups,
      matrix: matrixData.matrix,
      summary: matrixData.summary,
      metadata: matrixData.metadata
    };
  }

  /**
   * Handle export to Excel
   */
  private async handleExportExcel(options: ExportOptions): Promise<void> {
    this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY PROVIDER')} - Starting CSV export (Excel compatible)`);
    
    try {
      if (!this.activePanel) {
        vscode.window.showErrorMessage('No active traceability matrix to export.');
        return;
      }

      // Get current matrix data from the webview
      this.activePanel.webview.postMessage({ type: 'getMatrixData' });
      
      // Handle the response with matrix data
      const messageListener = this.activePanel.webview.onDidReceiveMessage(async (message) => {
        if (message.type === 'matrixDataResponse') {
          messageListener.dispose(); // Clean up listener
          
          const matrixData = message.data;
          
          // Generate filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
          const filename = `sylang-traceability-matrix-${timestamp}.csv`;
          
          // Show save dialog
          const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(filename),
            filters: {
              'CSV Files': ['csv'],
              'All Files': ['*']
            }
          });
          
          if (saveUri) {
            // Create CSV content
            const csvContent = this.createMatrixCSV(matrixData, options);
            
            // Write file
            await vscode.workspace.fs.writeFile(saveUri, Buffer.from(csvContent, 'utf8'));
            
            vscode.window.showInformationMessage(`Traceability matrix exported to: ${saveUri.fsPath}`);
            this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY PROVIDER')} - CSV export completed: ${saveUri.fsPath}`);
          }
        }
      });
      
    } catch (error) {
      this.logger.error(`🔗 ${getVersionedLogger('TRACEABILITY PROVIDER')} - CSV export failed: ${error}`);
      vscode.window.showErrorMessage(`Failed to export file: ${error}`);
    }
  }

  /**
   * Handle filter application
   */
  private async handleApplyFilter(filter: MatrixFilter): Promise<void> {
    this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY PROVIDER')} - Applying filter: ${JSON.stringify(filter)}`);
    
    // Reload matrix with filter
    if (this.activePanel && this.currentSourceFile) {
      await this.loadMatrixData(this.currentSourceFile, filter);
    } else {
      this.logger.warn(`🔗 ${getVersionedLogger('TRACEABILITY PROVIDER')} - Cannot apply filter: panel or source file not available`);
    }
  }

  /**
   * Handle navigation to symbol
   */
  private async handleNavigateToSymbol(symbolId: string): Promise<void> {
    // TODO: Implement navigation to symbol location
    vscode.window.showInformationMessage(`Navigate to symbol: ${symbolId}`);
  }

  /**
   * Handle cell details display
   */
  private handleShowCellDetails(sourceId: string, targetId: string): void {
    // TODO: Show detailed relationship information
    vscode.window.showInformationMessage(`Cell details: Source ${sourceId}, Target ${targetId}`);
  }

  /**
   * Export matrix to CSV file (Excel compatible)
   */
  async exportToExcel(sourceFileUri: vscode.Uri): Promise<void> {
    if (!this.activePanel) {
      await this.showTraceabilityMatrix(sourceFileUri);
    }
    
    // Trigger export with default options
    await this.handleExportExcel({
      format: 'csv',
      includeMetadata: true,
      includeSummary: true,
      separateSheetsByType: false,
      colorCoding: false
    });
  }

  /**
   * Create CSV content from matrix data
   */
  private createMatrixCSV(matrixData: any, options: ExportOptions): string {
    let csvContent = '';
    
    // Add metadata section if requested
    if (options.includeMetadata) {
      csvContent += 'Sylang Traceability Matrix\n';
      csvContent += `Title,${this.escapeCsvValue(matrixData.metadata.title)}\n`;
      csvContent += `Description,${this.escapeCsvValue(matrixData.metadata.description)}\n`;
      csvContent += `Source File,${this.escapeCsvValue(matrixData.metadata.sourceFile)}\n`;
      csvContent += `Generated At,${matrixData.metadata.generatedAt}\n`;
      csvContent += `Symbol Count,${matrixData.metadata.symbolCount}\n`;
      csvContent += '\n';
    }
    
    // Add summary section if requested
    if (options.includeSummary) {
      csvContent += 'Summary\n';
      csvContent += `Total Relationships,${matrixData.summary.totalRelationships}\n`;
      csvContent += `Valid Relationships,${matrixData.summary.validRelationships}\n`;
      csvContent += `Broken Relationships,${matrixData.summary.brokenRelationships}\n`;
      csvContent += `Coverage Percentage,${Math.round((matrixData.summary.validRelationships / Math.max(matrixData.summary.totalRelationships, 1)) * 100)}%\n`;
      csvContent += '\n';
      
      // Add relationship type breakdown
      csvContent += 'Relationship Types\n';
      for (const [relType, count] of Object.entries(matrixData.summary.coverageByType)) {
        csvContent += `${this.escapeCsvValue(relType)},${count}\n`;
      }
      csvContent += '\n';
    }
    
    // Add main matrix
    csvContent += 'Traceability Matrix\n';
    
    // Create header row
    const headerRow = ['Source \\ Target'];
    for (const targetGroup of matrixData.targetGroups) {
      for (const symbol of targetGroup.symbols) {
        headerRow.push(symbol.name);
      }
    }
    csvContent += headerRow.map(h => this.escapeCsvValue(h)).join(',') + '\n';
    
    // Create matrix rows
    let sourceIndex = 0;
    for (const sourceGroup of matrixData.sourceGroups) {
      for (const sourceSymbol of sourceGroup.symbols) {
        const row = [sourceSymbol.name];
        
        let targetIndex = 0;
        for (const targetGroup of matrixData.targetGroups) {
          for (const _targetSymbol of targetGroup.symbols) {
            const cell = matrixData.matrix[sourceIndex][targetIndex];
            const cellValue = cell.relationships.length > 0 ? cell.relationships.join('; ') : '';
            row.push(cellValue);
            targetIndex++;
          }
        }
        
        csvContent += row.map(r => this.escapeCsvValue(r)).join(',') + '\n';
        sourceIndex++;
      }
    }
    
    return csvContent;
  }

  /**
   * Escape CSV values to handle commas, quotes, and newlines
   */
  private escapeCsvValue(value: string): string {
    if (typeof value !== 'string') {
      value = String(value);
    }
    
    // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    
    return value;
  }

  /**
   * Handle file changes
   */
  handleFileChange(_uri: vscode.Uri): void {
    if (this.activePanel) {
      // Refresh matrix if a Sylang file changed
      this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY PROVIDER')} - File changed, refreshing matrix`);
      // TODO: Refresh matrix data
    }
  }

  /**
   * Dispose provider
   */
  dispose(): void {
    if (this.activePanel) {
      this.activePanel.dispose();
      this.activePanel = undefined;
    }
  }
}
