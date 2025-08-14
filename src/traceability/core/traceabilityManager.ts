import * as vscode from 'vscode';
import { SylangSymbolManager } from '../../core/symbolManager';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { TraceabilityMatrixProvider } from './traceabilityProvider';

/**
 * Manager for traceability analysis features
 * Loosely coupled - does not modify existing components
 */
export class SylangTraceabilityManager {
  private logger: SylangLogger;
  private symbolManager: SylangSymbolManager;
  private matrixProvider: TraceabilityMatrixProvider;

  constructor(symbolManager: SylangSymbolManager, logger: SylangLogger) {
    this.logger = logger;
    this.symbolManager = symbolManager;
    this.matrixProvider = new TraceabilityMatrixProvider(symbolManager, logger);
  }

  /**
   * Initialize traceability manager
   */
  initialize(): void {
    this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY MANAGER')} - Initialized traceability analysis features`);
  }

  /**
   * Show traceability matrix for the given file
   */
  async showTraceabilityMatrix(sourceFileUri: vscode.Uri): Promise<void> {
    this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY MANAGER')} - Opening traceability matrix for: ${sourceFileUri.fsPath}`);
    
    try {
      // Validate file
      if (!this.isValidSylangFile(sourceFileUri)) {
        vscode.window.showErrorMessage('Please select a Sylang file to open the traceability matrix.');
        return;
      }

      // Check if symbol manager exists and is initialized
      if (!this.symbolManager) {
        this.logger.error(`🔗 ${getVersionedLogger('TRACEABILITY MANAGER')} - Symbol manager is not initialized`);
        vscode.window.showErrorMessage('Symbol manager is not initialized. Please try again.');
        return;
      }

      // Check if symbol manager has project root
      if (!this.symbolManager.hasProjectRoot()) {
        this.logger.warn(`🔗 ${getVersionedLogger('TRACEABILITY MANAGER')} - No project root found, but proceeding anyway`);
        // Don't return here - let it proceed and show what symbols are available
      }

      // Show the matrix
      await this.matrixProvider.showTraceabilityMatrix(sourceFileUri);
      
    } catch (error) {
      this.logger.error(`🔗 ${getVersionedLogger('TRACEABILITY MANAGER')} - Failed to show traceability matrix: ${error}`);
      vscode.window.showErrorMessage(`Failed to open traceability matrix: ${error}`);
    }
  }

  /**
   * Export traceability matrix to Excel
   */
  async exportTraceabilityMatrix(sourceFileUri: vscode.Uri): Promise<void> {
    this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY MANAGER')} - Exporting traceability matrix to Excel`);
    
    try {
      await this.matrixProvider.exportToExcel(sourceFileUri);
      
    } catch (error) {
      this.logger.error(`🔗 ${getVersionedLogger('TRACEABILITY MANAGER')} - Failed to export matrix: ${error}`);
      vscode.window.showErrorMessage(`Failed to export traceability matrix: ${error}`);
    }
  }

  /**
   * Handle file changes - refresh if matrix is open
   */
  handleFileChange(uri: vscode.Uri): void {
    if (this.isValidSylangFile(uri)) {
      this.matrixProvider.handleFileChange(uri);
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.matrixProvider.dispose();
    this.logger.info(`🔗 ${getVersionedLogger('TRACEABILITY MANAGER')} - Disposed`);
  }

  /**
   * Check if file is a valid Sylang file
   */
  private isValidSylangFile(uri: vscode.Uri): boolean {
    const sylangExtensions = ['.ple', '.fml', '.vml', '.vcf', '.fun', '.req', '.tst', '.blk', '.spr', '.agt'];
    const fileExtension = uri.fsPath.split('.').pop()?.toLowerCase();
    return fileExtension ? sylangExtensions.includes(`.${fileExtension}`) : false;
  }
}
