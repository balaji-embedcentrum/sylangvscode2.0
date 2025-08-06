import * as vscode from 'vscode';
import { ValidationError } from './validationEngine';
import { SylangSymbolManager } from './symbolManager';
import { SylangLogger } from './logger';
import { SYLANG_VERSION } from './version';

export interface ImportUsage {
    importedSymbol: string;
    importedType: string;
    used: boolean;
    lineNumber: number;
}

export class SylangImportValidator {
    private symbolManager: SylangSymbolManager;
    private logger: SylangLogger;

    constructor(symbolManager: SylangSymbolManager, logger: SylangLogger) {
        this.symbolManager = symbolManager;
        this.logger = logger;
    }

    /**
     * Validates that use statements only reference hdef symbols (not def symbols)
     */
    validateUseStatementTarget(
        targetType: string,
        targetIdentifier: string,
        lineIndex: number,
        line: string,
        errors: ValidationError[]
    ): void {
        // Find the symbol being imported
        const allSymbols = this.symbolManager.getAllSymbols();
        const targetSymbol = allSymbols.find(symbol => 
            symbol.name === targetIdentifier && symbol.kind === targetType
        );

        if (targetSymbol) {
            // Check if the symbol is an hdef (parent) symbol or a def (child) symbol
            if (targetSymbol.type !== 'header') {
                errors.push({
                    message: `Invalid 'use' statement. Can only import parent symbols (hdef), but '${targetIdentifier}' is a child symbol (def). Import its parent instead.`,
                    severity: vscode.DiagnosticSeverity.Error,
                    line: lineIndex,
                    column: line.indexOf(targetIdentifier),
                    length: targetIdentifier.length,
                    code: 'SYLANG_USE_CHILD_SYMBOL'
                });
            }
        }
    }

    /**
     * Tracks import usage throughout a document and reports unused imports
     */
    validateUnusedImports(
        documentText: string,
        fileUri: vscode.Uri,
        errors: ValidationError[]
    ): void {
        this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Starting validation for: ${fileUri.fsPath}`);
        
        const lines = documentText.split('\n');
        const imports: ImportUsage[] = [];

        // First pass: collect all import statements
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('use ')) {
                const tokens = this.tokenizeLine(line);
                if (tokens.length >= 3) {
                    const importType = tokens[1];
                    const importIdentifier = tokens[2];
                    
                    imports.push({
                        importedSymbol: importIdentifier,
                        importedType: importType,
                        used: false,
                        lineNumber: i
                    });
                    
                    this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Found import: ${importType} ${importIdentifier}`);
                }
            }
        }

        this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Found ${imports.length} imports to check`);

        // Second pass: check if imports are used in ref statements or assignedto relationships
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check for direct ref statements
            if (line.includes('ref ')) {
                this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Checking line ${i + 1}: ${line}`);
                
                const tokens = this.tokenizeLine(line);
                const refIndex = tokens.indexOf('ref');
                
                if (refIndex !== -1 && refIndex + 2 < tokens.length) {
                    const refIdentifier = tokens[refIndex + 2];
                    
                    this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Found ref to '${refIdentifier}'`);
                    
                    // Mark the import as used if this reference matches
                    for (const importUsage of imports) {
                        this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Checking if '${refIdentifier}' matches import '${importUsage.importedSymbol}'`);
                        
                        // Check direct match (referencing the imported symbol itself)
                        if (importUsage.importedSymbol === refIdentifier) {
                            importUsage.used = true;
                            this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - ✅ Direct match! Import '${importUsage.importedSymbol}' marked as used`);
                        }
                        // Check indirect match (referencing a child of the imported symbol)
                        else if (this.isChildOfImport(refIdentifier, importUsage.importedSymbol, fileUri)) {
                            importUsage.used = true;
                            this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - ✅ Child match! Import '${importUsage.importedSymbol}' marked as used via child '${refIdentifier}'`);
                        }
                    }
                }
            }
            
            // Check for assignedto relationships that use agents from agentset imports
            if (line.includes('assignedto ref agent ')) {
                this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Checking assignedto line ${i + 1}: ${line}`);
                
                const agentMatch = line.match(/assignedto\s+ref\s+agent\s+([A-Za-z_][A-Za-z0-9_]*)/);
                if (agentMatch) {
                    const agentName = agentMatch[1];
                    this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Found assignedto agent '${agentName}'`);
                    
                    // Check if any agentset import contains this agent
                    for (const importUsage of imports) {
                        if (importUsage.importedType === 'agentset') {
                            // Check if this agent is defined in the imported agentset
                            if (this.isChildOfImport(agentName, importUsage.importedSymbol, fileUri)) {
                                importUsage.used = true;
                                this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - ✅ Agentset match! Import '${importUsage.importedSymbol}' marked as used via assignedto agent '${agentName}'`);
                            }
                        }
                    }
                }
            }
        }

        // Report unused imports as warnings, or config-disabled imports as errors
        for (const importUsage of imports) {
            this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Final check - ${importUsage.importedSymbol}: used = ${importUsage.used}`);
            
            // Check if imported symbol is disabled by config (before checking usage)
            this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - DEBUG: Checking config for import '${importUsage.importedSymbol}'`);
            
            // FIXED: Check if symbol exists but is disabled by config
            if (this.symbolManager.isSymbolDisabledByConfig(importUsage.importedSymbol)) {
                this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - ❌ Import '${importUsage.importedSymbol}' is disabled by config`);
                errors.push({
                    message: `Import '${importUsage.importedSymbol}' is disabled by configuration. Cannot use disabled symbols.`,
                    severity: vscode.DiagnosticSeverity.Error,
                    line: importUsage.lineNumber,
                    column: 0,
                    length: lines[importUsage.lineNumber].length,
                    code: 'SYLANG_DISABLED_IMPORT'
                });
                continue; // Skip unused check for disabled imports
            }
            
            // Check if symbol exists at all (for "symbol not found" errors)
            const importedSymbol = this.symbolManager.resolveSymbol(importUsage.importedSymbol, fileUri);
            if (!importedSymbol) {
                this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - ❌ Import '${importUsage.importedSymbol}' - symbol not found`);
                errors.push({
                    message: `Import '${importUsage.importedSymbol}' not found. Check symbol name and ensure the file is properly parsed.`,
                    severity: vscode.DiagnosticSeverity.Error,
                    line: importUsage.lineNumber,
                    column: 0,
                    length: lines[importUsage.lineNumber].length,
                    code: 'SYLANG_SYMBOL_NOT_FOUND'
                });
                continue; // Skip unused check for missing symbols
            }
            
            if (!importUsage.used) {
                this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - ⚠️ Reporting unused import: ${importUsage.importedSymbol}`);
                errors.push({
                    message: `Unused import '${importUsage.importedSymbol}'. Consider removing this 'use' statement.`,
                    severity: vscode.DiagnosticSeverity.Warning,
                    line: importUsage.lineNumber,
                    column: 0,
                    length: lines[importUsage.lineNumber].length,
                    code: 'SYLANG_UNUSED_IMPORT'
                });
            }
        }
        
        this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Completed validateUnusedImports`);
    }

    /**
     * Checks if a referenced identifier is a child of an imported parent symbol
     * Supports nested hierarchies (grandchild relationships)
     */
    private isChildOfImport(childIdentifier: string, parentIdentifier: string, _fileUri: vscode.Uri): boolean {
        const allSymbols = this.symbolManager.getAllSymbols();
        
        // Find the child symbol
        const childSymbol = allSymbols.find(symbol => symbol.name === childIdentifier);
        if (!childSymbol) {
            this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Child symbol '${childIdentifier}' not found in getAllSymbols()`);
            return false;
        }

        // Find the parent symbol
        const parentSymbol = allSymbols.find(symbol => 
            symbol.name === parentIdentifier && symbol.type === 'header'
        );
        if (!parentSymbol) {
            this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Parent symbol '${parentIdentifier}' not found in getAllSymbols()`);
            return false;
        }

        this.logger.info(`🔍 IMPORT VALIDATOR v${SYLANG_VERSION} - Checking if '${childIdentifier}' is child of '${parentIdentifier}':`);
        this.logger.info(`  Child: ${childSymbol.name} (kind: ${childSymbol.kind}, type: ${childSymbol.type})`);
        this.logger.info(`  Child file: ${childSymbol.fileUri.fsPath}`);
        this.logger.info(`  Child parentSymbol: ${childSymbol.parentSymbol}`);
        this.logger.info(`  Parent: ${parentSymbol.name} (kind: ${parentSymbol.kind}, type: ${parentSymbol.type})`);
        this.logger.info(`  Parent file: ${parentSymbol.fileUri.fsPath}`);

        // Check if they're in the same file first (cross-file relationships not supported)
        const sameFile = childSymbol.fileUri.fsPath === parentSymbol.fileUri.fsPath;
        if (!sameFile) {
            this.logger.info(`  Same file: ${sameFile}`);
            this.logger.info(`  Result: false (different files)`);
            return false;
        }

        // Check direct parent relationship
        if (childSymbol.parentSymbol === parentSymbol.name) {
            this.logger.info(`  Direct parent match: true`);
            this.logger.info(`  Result: true`);
            return true;
        }

        // Check grandparent relationship by walking up the hierarchy
        let currentParentName = childSymbol.parentSymbol;
        let hierarchyLevel = 1;
        
        while (currentParentName && hierarchyLevel <= 5) { // Prevent infinite loops
            const intermediateParent = allSymbols.find(symbol => 
                symbol.name === currentParentName && symbol.fileUri.fsPath === parentSymbol.fileUri.fsPath
            );
            
            if (!intermediateParent) {
                this.logger.info(`  Hierarchy level ${hierarchyLevel}: intermediate parent '${currentParentName}' not found`);
                break;
            }

            this.logger.info(`  Hierarchy level ${hierarchyLevel}: ${intermediateParent.name} -> parent: ${intermediateParent.parentSymbol}`);
            
            if (intermediateParent.parentSymbol === parentSymbol.name) {
                this.logger.info(`  Grandparent match found at level ${hierarchyLevel}: true`);
                this.logger.info(`  Result: true`);
                return true;
            }

            currentParentName = intermediateParent.parentSymbol;
            hierarchyLevel++;
        }
        
        this.logger.info(`  No parent relationship found in hierarchy`);
        this.logger.info(`  Result: false`);
        return false;
    }

    /**
     * Tokenizes a line into words, handling quoted strings properly
     */
    private tokenizeLine(line: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes) {
                    current += char;
                    tokens.push(current);
                    current = '';
                    inQuotes = false;
                } else {
                    if (current.trim()) {
                        tokens.push(current.trim());
                    }
                    current = char;
                    inQuotes = true;
                }
            } else if (inQuotes) {
                current += char;
            } else if (char === ' ' || char === '\t' || char === ',') {
                if (current.trim()) {
                    tokens.push(current.trim());
                    current = '';
                }
            } else {
                current += char;
            }
        }
        
        if (current.trim()) {
            tokens.push(current.trim());
        }
        
        return tokens;
    }
} 