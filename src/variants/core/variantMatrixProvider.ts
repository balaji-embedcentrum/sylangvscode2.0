import * as vscode from 'vscode';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { SylangSymbolManager } from '../../core/symbolManager';
import { VariantMatrixBuilder } from './variantMatrixBuilder';
import { VariantMatrixData, VariantMatrixMessage, FeatureHierarchy } from '../types/variantTypes';

/**
 * Webview provider for Variant Matrix
 * Shows features as rows, .vml files as columns with checkboxes
 */
export class VariantMatrixProvider {
  private logger: SylangLogger;
  private matrixBuilder: VariantMatrixBuilder;
  private activePanel?: vscode.WebviewPanel;
  // private currentFmlFile?: vscode.Uri; // Currently unused but kept for future extensions
  private currentMatrixData?: VariantMatrixData;

  constructor(symbolManager: SylangSymbolManager, logger: SylangLogger) {
    this.logger = logger;
    this.matrixBuilder = new VariantMatrixBuilder(symbolManager, logger);
  }

  /**
   * Show variant matrix view for .fml file
   */
  async showVariantMatrix(fmlUri: vscode.Uri): Promise<void> {
    this.logger.info(`🔄 ${getVersionedLogger('VARIANT MATRIX PROVIDER')} - Opening variant matrix for ${fmlUri.fsPath}`);

    // Store current file for future use
    // this.currentFmlFile = fmlUri;

    // Close existing panel if open and force refresh
    if (this.activePanel) {
      this.activePanel.dispose();
      this.activePanel = undefined;
      this.currentMatrixData = undefined;
    }

    // Create webview panel
    this.activePanel = vscode.window.createWebviewPanel(
      'sylangVariantMatrix',
      'Sylang: Variant Matrix',
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
      // this.currentFmlFile = undefined;
      this.currentMatrixData = undefined;
      this.logger.info(`🔄 ${getVersionedLogger('VARIANT MATRIX PROVIDER')} - Matrix panel disposed`);
    });

    // Load and display data
    await this.loadMatrixData(fmlUri);

    // Set up message handling
    this.setupMessageHandling();
  }

  /**
   * Load matrix data and update webview
   */
  private async loadMatrixData(fmlUri: vscode.Uri): Promise<void> {
    try {
      // Build matrix data
      this.currentMatrixData = await this.matrixBuilder.buildMatrixData(fmlUri);
      
      // Generate and set HTML
      const html = this.generateMatrixHTML(this.currentMatrixData);
      
      // DEBUG: Log the table body section to see the actual feature rows
      const tbodyStart = html.indexOf('<tbody>');
      const tbodyEnd = html.indexOf('</tbody>') + 8;
      const tbodyContent = tbodyStart >= 0 ? html.substring(tbodyStart, tbodyEnd) : 'TBODY NOT FOUND';
      this.logger.info(`🔍 ${getVersionedLogger('VARIANT MATRIX PROVIDER')} - Generated TBODY content: ${tbodyContent}`);
      
      if (this.activePanel) {
        this.activePanel.webview.html = html;
      }
      
      this.logger.info(`🔄 ${getVersionedLogger('VARIANT MATRIX PROVIDER')} - Matrix loaded successfully`);
    } catch (error) {
      this.logger.error(`❌ ${getVersionedLogger('VARIANT MATRIX PROVIDER')} - Error loading matrix data: ${error}`);
      
      if (this.activePanel) {
        this.activePanel.webview.html = this.generateErrorHTML(error as Error);
      }
    }
  }

  /**
   * Set up message handling for webview interactions
   */
  private setupMessageHandling(): void {
    if (!this.activePanel) return;

    this.activePanel.webview.onDidReceiveMessage(async (message: VariantMatrixMessage) => {
      try {
        if (message.type === 'checkboxToggle') {
          await this.handleCheckboxToggle(message);
        }
      } catch (error) {
        this.logger.error(`❌ ${getVersionedLogger('VARIANT MATRIX PROVIDER')} - Error handling message: ${error}`);
        vscode.window.showErrorMessage(`Error updating variant: ${error}`);
      }
    });
  }

  /**
   * Handle checkbox toggle from webview
   */
  private async handleCheckboxToggle(message: VariantMatrixMessage): Promise<void> {
    if (!this.currentMatrixData) {
      throw new Error('No matrix data available');
    }

    // Find the variant file path
    const variant = this.currentMatrixData.variants.find(v => v.name === message.variantName);
    if (!variant) {
      throw new Error(`Variant ${message.variantName} not found`);
    }

    // Update the .vml file
    await this.matrixBuilder.updateFeatureSelection(variant.path, message.featureId, message.selected);

    // Update internal data
    const variantSelections = this.currentMatrixData.selections.get(message.variantName);
    if (variantSelections) {
      const selection = variantSelections.get(message.featureId);
      if (selection) {
        selection.selected = message.selected;
      }
    }

    this.logger.info(`✅ ${getVersionedLogger('VARIANT MATRIX PROVIDER')} - Updated ${message.featureId} = ${message.selected} in ${message.variantName}`);
  }

  /**
   * Generate HTML for variant matrix
   */
  private generateMatrixHTML(data: VariantMatrixData): string {
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Variant Matrix</title>
    <style>
        html, body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            line-height: 1.4;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            overflow: auto;
            min-height: 100vh;
        }

        .container {
            padding: 16px;
            min-width: 800px;
        }

        .header {
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .subtitle {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }

        .matrix-container {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: auto;
            max-height: 80vh;
        }

        .matrix-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 600px;
        }

        .matrix-table th,
        .matrix-table td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
            border-right: 1px solid var(--vscode-panel-border);
        }

        .matrix-table th {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 2;
        }

        .feature-cell {
            background: var(--vscode-editor-background);
            position: sticky;
            left: 0;
            z-index: 1;
            border-right: 2px solid var(--vscode-panel-border);
            min-width: 300px;
            max-width: 400px;
        }

        .feature-cell.header {
            z-index: 3;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
        }

        .feature-name {
            font-weight: 500;
        }

        .feature-cell.feature-indent-0 { padding-left: 12px !important; }
        .feature-cell.feature-indent-1 { padding-left: 32px !important; }
        .feature-cell.feature-indent-2 { padding-left: 52px !important; }
        .feature-cell.feature-indent-3 { padding-left: 72px !important; }
        .feature-cell.feature-indent-4 { padding-left: 92px !important; }
        .feature-cell.feature-indent-5 { padding-left: 112px !important; }

        .feature-mandatory {
            color: var(--vscode-errorForeground);
        }

        .feature-optional {
            color: var(--vscode-foreground);
        }

        .checkbox-cell {
            text-align: center;
            min-width: 120px;
        }

        .feature-checkbox {
            transform: scale(1.2);
            cursor: pointer;
        }

        .feature-checkbox:disabled {
            cursor: not-allowed;
            opacity: 0.5;
        }

        .variant-header {
            writing-mode: vertical-rl;
            text-orientation: mixed;
            white-space: nowrap;
            min-height: 120px;
            font-weight: 600;
            padding: 12px 8px;
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar {
            width: 12px;
            height: 12px;
        }

        ::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
            border-radius: 6px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-activeBackground);
        }

        @media (max-width: 1200px) {
            .container {
                padding: 8px;
                min-width: 600px;
            }
            
            .matrix-table th,
            .matrix-table td {
                padding: 6px 8px;
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">Variant Matrix</div>
            <div class="subtitle">1 Feature Model × ${data.variants.length} Variant Models</div>
        </div>

        <div class="matrix-container">
            <table class="matrix-table">
                <thead>
                    <tr>
                        <th class="feature-cell header">Feature</th>
                        ${data.variants.map(variant => `
                            <th class="variant-header">${variant.name}</th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${this.generateAllFeatureRows(data).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function toggleFeature(variantName, featureId, checkbox) {
            const selected = checkbox.checked;
            
            vscode.postMessage({
                type: 'checkboxToggle',
                variantName: variantName,
                featureId: featureId,
                selected: selected
            });
        }

        // Prevent form submission on Enter key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.target.type === 'checkbox') {
                e.preventDefault();
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Generate HTML rows for all features in proper order with hierarchy
   */
  private generateAllFeatureRows(data: VariantMatrixData): string[] {
    // Get flat list in proper hierarchical order
    const allFeatures = this.matrixBuilder.getFlatFeatureList(data.features);
    
    this.logger.info(`🎨 ${getVersionedLogger('VARIANT MATRIX PROVIDER')} - Rendering ${allFeatures.length} features total`);
    
    const rows: string[] = [];
    for (const feature of allFeatures) {
      rows.push(this.generateFeatureRow(feature, data));
    }
    
    return rows;
  }



  /**
   * Generate HTML row for a feature
   */
  private generateFeatureRow(feature: FeatureHierarchy, data: VariantMatrixData): string {
    const typeClass = feature.mandatory ? 'feature-mandatory' : 'feature-optional';
    const typeSymbol = feature.mandatory ? '●' : '○';
    const indentClass = `feature-indent-${Math.min(feature.level, 5)}`;
    
    this.logger.info(`🎨 ${getVersionedLogger('VARIANT MATRIX PROVIDER')} - Rendering ${feature.name}: level=${feature.level}, indentClass=${indentClass}, mandatory=${feature.mandatory}`);
    
    return `
        <tr>
            <td class="feature-cell ${indentClass}">
                <span class="${typeClass}">
                    ${typeSymbol} ${feature.name}
                </span>
            </td>
            ${data.variants.map(variant => {
                const selections = data.selections.get(variant.name);
                const selection = selections?.get(feature.id);
                const isSelected = selection?.selected || false;
                const isDisabled = selection?.mandatory || false;
                
                return `
                    <td class="checkbox-cell">
                        <input 
                            type="checkbox" 
                            class="feature-checkbox"
                            ${isSelected ? 'checked' : ''} 
                            ${isDisabled ? 'disabled' : ''}
                            onchange="toggleFeature('${variant.name}', '${feature.id}', this)"
                        />
                    </td>
                `;
            }).join('')}
        </tr>
    `;
  }

  /**
   * Generate error HTML
   */
  private generateErrorHTML(error: Error): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Variant Matrix Error</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .error {
            color: var(--vscode-errorForeground);
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 16px;
            border-radius: 4px;
        }
        .error-title {
            font-weight: 600;
            margin-bottom: 8px;
        }
    </style>
</head>
<body>
    <div class="error">
        <div class="error-title">Error Loading Variant Matrix</div>
        <div>${error.message}</div>
    </div>
</body>
</html>`;
  }
}
