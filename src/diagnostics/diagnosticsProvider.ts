import * as vscode from 'vscode';
import { SylangLogger } from '../core/logger';
import { SylangValidationEngine } from '../core/validationEngine';

export class SylangDiagnosticsProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private logger: SylangLogger;
    private validationEngine: SylangValidationEngine;

    constructor(logger: SylangLogger, validationEngine: SylangValidationEngine) {
        this.logger = logger;
        this.validationEngine = validationEngine;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('sylang');
    }

    async updateDiagnostics(uri: vscode.Uri, diagnostics?: vscode.Diagnostic[]): Promise<void> {
        try {
            let finalDiagnostics: vscode.Diagnostic[];
            
            if (diagnostics) {
                finalDiagnostics = diagnostics;
            } else {
                // Generate diagnostics using validation engine
                finalDiagnostics = await this.validationEngine.validateDocument(uri);
            }

            // Update the diagnostic collection (shows in Problems panel and inline)
            this.diagnosticCollection.set(uri, finalDiagnostics);

            // Log diagnostics to output console
            this.logDiagnosticsToConsole(uri, finalDiagnostics);

            this.logger.debug(`Updated diagnostics for ${uri.fsPath}: ${finalDiagnostics.length} issues found`);

        } catch (error) {
            this.logger.error(`Failed to update diagnostics for ${uri.fsPath}: ${error}`);
        }
    }

    clearDiagnostics(uri: vscode.Uri): void {
        this.diagnosticCollection.delete(uri);
        this.logger.debug(`Cleared diagnostics for ${uri.fsPath}`);
    }

    clearAllDiagnostics(): void {
        this.diagnosticCollection.clear();
        this.logger.debug('Cleared all diagnostics');
    }

    private logDiagnosticsToConsole(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]): void {
        if (diagnostics.length === 0) {
            return;
        }

        const fileName = vscode.workspace.asRelativePath(uri);
        this.logger.info(`Validation results for ${fileName}:`);

        // Group diagnostics by severity
        const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
        const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning);
        const infos = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Information);
        const hints = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Hint);

        // Log summary
        if (errors.length > 0) {
            this.logger.error(`  ${errors.length} error(s) found`);
        }
        if (warnings.length > 0) {
            this.logger.warn(`  ${warnings.length} warning(s) found`);
        }
        if (infos.length > 0) {
            this.logger.info(`  ${infos.length} info message(s) found`);
        }
        if (hints.length > 0) {
            this.logger.info(`  ${hints.length} hint(s) found`);
        }

        // Log detailed diagnostics for errors and warnings
        for (const diagnostic of [...errors, ...warnings]) {
            const severityText = this.getSeverityText(diagnostic.severity);
            const line = diagnostic.range.start.line + 1; // Convert to 1-based line numbers
            const column = diagnostic.range.start.character + 1;
            const code = diagnostic.code ? ` [${diagnostic.code}]` : '';
            
            const message = `  ${severityText} at line ${line}, column ${column}: ${diagnostic.message}${code}`;
            
            if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
                this.logger.error(message);
            } else {
                this.logger.warn(message);
            }
        }
    }

    private getSeverityText(severity: vscode.DiagnosticSeverity): string {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error:
                return 'ERROR';
            case vscode.DiagnosticSeverity.Warning:
                return 'WARNING';
            case vscode.DiagnosticSeverity.Information:
                return 'INFO';
            case vscode.DiagnosticSeverity.Hint:
                return 'HINT';
            default:
                return 'UNKNOWN';
        }
    }

    // Get all current diagnostics for a specific file
    getDiagnostics(uri: vscode.Uri): readonly vscode.Diagnostic[] {
        return this.diagnosticCollection.get(uri) || [];
    }

    // Get all diagnostics across all files
    getAllDiagnostics(): readonly [vscode.Uri, readonly vscode.Diagnostic[]][] {
        const allDiagnostics: [vscode.Uri, readonly vscode.Diagnostic[]][] = [];
        
        this.diagnosticCollection.forEach((uri, diagnostics) => {
            if (diagnostics.length > 0) {
                allDiagnostics.push([uri, diagnostics]);
            }
        });
        
        return allDiagnostics;
    }

    // Get summary statistics
    getDiagnosticsSummary(): { errors: number; warnings: number; infos: number; hints: number; totalFiles: number } {
        let errors = 0;
        let warnings = 0;
        let infos = 0;
        let hints = 0;
        let totalFiles = 0;

        this.diagnosticCollection.forEach((_uri, diagnostics) => {
            if (diagnostics.length > 0) {
                totalFiles++;
                for (const diagnostic of diagnostics) {
                    switch (diagnostic.severity) {
                        case vscode.DiagnosticSeverity.Error:
                            errors++;
                            break;
                        case vscode.DiagnosticSeverity.Warning:
                            warnings++;
                            break;
                        case vscode.DiagnosticSeverity.Information:
                            infos++;
                            break;
                        case vscode.DiagnosticSeverity.Hint:
                            hints++;
                            break;
                    }
                }
            }
        });

        return { errors, warnings, infos, hints, totalFiles };
    }

    // Show diagnostics summary in status bar message
    showSummaryMessage(): void {
        const summary = this.getDiagnosticsSummary();
        
        if (summary.errors === 0 && summary.warnings === 0) {
            if (summary.totalFiles > 0) {
                vscode.window.showInformationMessage(`Sylang: All ${summary.totalFiles} files validated successfully`);
            }
        } else {
            const errorText = summary.errors > 0 ? `${summary.errors} error(s)` : '';
            const warningText = summary.warnings > 0 ? `${summary.warnings} warning(s)` : '';
            const separator = errorText && warningText ? ', ' : '';
            
            const message = `Sylang: ${errorText}${separator}${warningText} found in ${summary.totalFiles} file(s)`;
            
            if (summary.errors > 0) {
                vscode.window.showErrorMessage(message, 'Show Problems').then(selection => {
                    if (selection === 'Show Problems') {
                        vscode.commands.executeCommand('workbench.panel.markers.view.focus');
                    }
                });
            } else {
                vscode.window.showWarningMessage(message, 'Show Problems').then(selection => {
                    if (selection === 'Show Problems') {
                        vscode.commands.executeCommand('workbench.panel.markers.view.focus');
                    }
                });
            }
        }
    }

    // Command to validate all Sylang files in workspace
    async validateAllFiles(): Promise<void> {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showWarningMessage('No workspace folder open');
            return;
        }

        try {
            // Find all Sylang files
            const sylangFiles = await vscode.workspace.findFiles(
                '**/*.{ple,fml,vml,vcf,fun,req,tst,blk}',
                '**/node_modules/**'
            );

            this.logger.info(`Validating ${sylangFiles.length} Sylang files...`);
            
            // Clear existing diagnostics
            this.clearAllDiagnostics();

            // Validate each file
            const validationPromises = sylangFiles.map(uri => this.updateDiagnostics(uri));
            await Promise.all(validationPromises);

            // Show summary
            this.showSummaryMessage();
            
            this.logger.info('Validation completed for all Sylang files');
            
        } catch (error) {
            this.logger.error(`Failed to validate all files: ${error}`);
            vscode.window.showErrorMessage(`Failed to validate Sylang files: ${error}`);
        }
    }

    dispose(): void {
        this.diagnosticCollection.dispose();
        this.logger.debug('Diagnostics provider disposed');
    }
} 