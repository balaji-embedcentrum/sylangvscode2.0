import * as vscode from 'vscode';
import { SylangLogger } from './logger';
import { SylangSymbolManager, SylangSymbol, DocumentSymbols } from './symbolManager';
import { SYLANG_VERSION } from './version';

export class SylangDecorationProvider {
    private grayOutDecorationType: vscode.TextEditorDecorationType;
    private logger: SylangLogger;
    private symbolManager: SylangSymbolManager;

    constructor(logger: SylangLogger, symbolManager: SylangSymbolManager) {
        this.logger = logger;
        this.symbolManager = symbolManager;
        
        // Create decoration type for graying out disabled config blocks
        this.grayOutDecorationType = vscode.window.createTextEditorDecorationType({
            opacity: '0.4',
            fontStyle: 'italic',
            color: '#888888',
            backgroundColor: 'rgba(128, 128, 128, 0.1)'
        });
    }

    async updateDecorations(editor: vscode.TextEditor): Promise<void> {
        this.logger.info(`🎨 DECORATION PROVIDER v${SYLANG_VERSION} - updateDecorations called for: ${editor.document.fileName}`);
        
        if (!this.isSylangDocument(editor.document)) {
            this.logger.info(`🎨 DECORATION PROVIDER v${SYLANG_VERSION} - Not a Sylang document, skipping`);
            return;
        }

        try {
            const documentSymbols = this.symbolManager.getDocumentSymbols(editor.document.uri);
            if (!documentSymbols) {
                this.logger.info(`🎨 DECORATION PROVIDER v${SYLANG_VERSION} - No document symbols found`);
                return;
            }

            this.logger.info(`🎨 DECORATION PROVIDER v${SYLANG_VERSION} - Found document symbols, calculating decorations`);
            const decorations = this.calculateGrayOutDecorations(editor.document, documentSymbols);
            editor.setDecorations(this.grayOutDecorationType, decorations);
            
            this.logger.info(`🎨 DECORATION PROVIDER v${SYLANG_VERSION} - Applied ${decorations.length} gray-out decorations`);
            
        } catch (error) {
            this.logger.error(`Failed to update decorations: ${error}`);
        }
    }

    private calculateGrayOutDecorations(document: vscode.TextDocument, documentSymbols: DocumentSymbols): vscode.DecorationOptions[] {
        const decorations: vscode.DecorationOptions[] = [];
        const lines = document.getText().split('\n');

        this.logger.info(`🎨 DECORATION PROVIDER v${SYLANG_VERSION} - Calculating gray-out decorations for: ${document.fileName}`);
        this.logger.info(`  Found ${documentSymbols.definitionSymbols.length} definition symbols`);

        // Check if header symbol should be grayed out (if it uses a config = 0)
        // This handles 'hdef' with 'when ref config' - grays out entire file
        if (documentSymbols.headerSymbol && this.shouldGrayOutSymbolBasedOnUsage(documentSymbols.headerSymbol)) {
            this.logger.info(`🎨 DECORATION PROVIDER v${SYLANG_VERSION} - Header symbol (hdef) uses disabled config, graying out entire file`);
            // Gray out entire file if header uses config 0
            const wholeFileRange = new vscode.Range(
                new vscode.Position(0, 0),
                new vscode.Position(lines.length - 1, lines[lines.length - 1].length)
            );
            decorations.push({
                range: wholeFileRange,
                hoverMessage: 'This file is disabled because the header definition (hdef) uses a config with value 0'
            });
            return decorations; // If header is disabled, gray out everything
        }

        // Check individual definition symbols (handles 'def' with 'when ref config' - grays out only that definition)
        for (const symbol of documentSymbols.definitionSymbols) {
            this.logger.info(`  Checking symbol: ${symbol.name} (kind: ${symbol.kind})`);
            if (this.shouldGrayOutSymbolBasedOnUsage(symbol)) {
                this.logger.info(`    ✅ Should gray out symbol: ${symbol.name} (def structure uses disabled config)`);
                const symbolRange = this.getSymbolRange(document, symbol, lines);
                if (symbolRange) {
                    decorations.push({
                        range: symbolRange,
                        hoverMessage: 'This definition (def) is disabled because it uses a config with value 0'
                    });
                }
            } else {
                this.logger.info(`    ❌ Should NOT gray out symbol: ${symbol.name}`);
            }
        }

        this.logger.info(`🎨 DECORATION PROVIDER v${SYLANG_VERSION} - Generated ${decorations.length} gray-out decorations`);
        return decorations;
    }

    private shouldGrayOutSymbolBasedOnUsage(symbol: SylangSymbol): boolean {
        // Don't gray out config definitions themselves (they should always be visible)
        if (symbol.kind === 'config') {
            return false;
        }

        // Check if this symbol uses a config with value 0
        return this.symbolUsesDisabledConfig(symbol);
    }

    /**
     * Check if a symbol uses a config with value 0 (through 'when ref config' relations)
     */
    private symbolUsesDisabledConfig(symbol: SylangSymbol): boolean {
        this.logger.info(`🎨 DECORATION PROVIDER v${SYLANG_VERSION} - Checking if symbol '${symbol.name}' uses disabled config:`);
        
        // Look through all properties to find 'when' or 'resolves' relations
        for (const [propertyName, propertyValues] of symbol.properties.entries()) {
            this.logger.info(`  Property: ${propertyName} = [${propertyValues.join(', ')}]`);
            
            // Check for "when" relation that contains "ref config configName"
            if (propertyName === 'when') {
                // propertyValues should be something like ["ref", "config", "c_ConfigName"]
                if (propertyValues.length >= 3 && propertyValues[0] === 'ref' && propertyValues[1] === 'config') {
                    const configName = propertyValues[2];
                    const configValue = this.resolveConfigValue(configName);
                    this.logger.info(`    Found ${propertyName} ref config ${configName} with value ${configValue}`);
                    if (configValue === 0) {
                        this.logger.info(`    ✅ Symbol '${symbol.name}' uses disabled config ${configName}`);
                        return true; // This symbol uses a disabled config
                    }
                }
            }
            // Also check for legacy "ref" property that contains "config configName" (backward compatibility)
            else if (propertyName === 'ref') {
                // propertyValues should be something like ["config", "c_ConfigName"]
                if (propertyValues.length >= 2 && propertyValues[0] === 'config') {
                    const configName = propertyValues[1];
                    const configValue = this.resolveConfigValue(configName);
                    this.logger.info(`    Found legacy ref config ${configName} with value ${configValue}`);
                    if (configValue === 0) {
                        this.logger.info(`    ✅ Symbol '${symbol.name}' uses disabled config ${configName}`);
                        return true; // This symbol uses a disabled config
                    }
                }
            }
        }

        this.logger.info(`  No disabled config found for '${symbol.name}'`);
        
        // Check if any parent symbol uses a disabled config (recursive check)
        return this.hasParentWithDisabledConfig(symbol);
    }

    private hasParentWithDisabledConfig(symbol: SylangSymbol): boolean {
        if (!symbol.parentSymbol) {
            return false;
        }

        // Find parent symbol and check if it uses disabled config
        const documentSymbols = this.symbolManager.getDocumentSymbols(symbol.fileUri);
        if (!documentSymbols) {
            return false;
        }

        const parent = this.findSymbolByName(documentSymbols, symbol.parentSymbol);
        if (!parent) {
            return false;
        }

        if (this.symbolUsesDisabledConfig(parent)) {
            return true;
        }

        // Recursively check parent's parent
        return this.hasParentWithDisabledConfig(parent);
    }

    /**
     * Resolve the value of a config by looking it up in VCF files
     */
    private resolveConfigValue(configName: string): number | undefined {
        this.logger.info(`🎨 DECORATION PROVIDER v${SYLANG_VERSION} - Resolving config value for '${configName}'`);
        
        // Ask symbol manager to resolve config value
        const allSymbols = this.symbolManager.getAllSymbols();
        
        this.logger.info(`  Checking ${allSymbols.length} symbols for config '${configName}'`);
        
        for (const symbol of allSymbols) {
            if (symbol.kind === 'config' && symbol.name === configName) {
                this.logger.info(`  ✅ Found config symbol '${configName}' with value ${symbol.configValue}`);
                return symbol.configValue;
            }
        }
        
        this.logger.info(`  ❌ Config '${configName}' not found in any symbols`);
        return undefined;
    }

    private findSymbolByName(documentSymbols: DocumentSymbols, name: string): SylangSymbol | undefined {
        if (documentSymbols.headerSymbol?.name === name) {
            return documentSymbols.headerSymbol;
        }
        return documentSymbols.definitionSymbols.find(symbol => symbol.name === name);
    }

    private getSymbolRange(_document: vscode.TextDocument, symbol: SylangSymbol, lines: string[]): vscode.Range | undefined {
        try {
            const startLine = symbol.line;
            const endLine = this.findSymbolEndLine(symbol, lines, startLine);
            
            return new vscode.Range(
                new vscode.Position(startLine, 0),
                new vscode.Position(endLine, lines[endLine]?.length || 0)
            );
        } catch (error) {
            this.logger.warn(`Failed to calculate range for symbol ${symbol.name}: ${error}`);
            return undefined;
        }
    }

    private findSymbolEndLine(symbol: SylangSymbol, lines: string[], startLine: number): number {
        const symbolIndentLevel = symbol.indentLevel;
        
        // Find the end of this symbol's block by looking for the next line with same or less indentation
        for (let i = startLine + 1; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
                continue;
            }
            
            const lineIndentLevel = this.getIndentLevel(line);
            
            // If we find a line with same or less indentation, this is where the block ends
            if (lineIndentLevel <= symbolIndentLevel) {
                return i - 1;
            }
        }
        
        // If we reach the end of file, return the last line
        return lines.length - 1;
    }

    private getIndentLevel(line: string): number {
        let indent = 0;
        for (const char of line) {
            if (char === ' ') {
                indent++;
            } else if (char === '\t') {
                indent += 2;
            } else {
                break;
            }
        }
        return Math.floor(indent / 2);
    }

    private isSylangDocument(document: vscode.TextDocument): boolean {
        const sylangExtensions = ['.ple', '.fml', '.vml', '.vcf', '.fun', '.req', '.tst', '.blk'];
        return sylangExtensions.some(ext => document.fileName.endsWith(ext));
    }

    // Update decorations for all visible editors
    updateAllVisibleEditors(): void {
        vscode.window.visibleTextEditors.forEach(editor => {
            this.updateDecorations(editor);
        });
    }

    // Clear all decorations
    clearDecorations(): void {
        vscode.window.visibleTextEditors.forEach(editor => {
            editor.setDecorations(this.grayOutDecorationType, []);
        });
    }

    dispose(): void {
        this.grayOutDecorationType.dispose();
        this.logger.debug('Decoration provider disposed');
    }
} 