import * as vscode from 'vscode';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { SylangSymbolManager } from '../../core/symbolManager';
import { VariantMatrixProvider } from './variantMatrixProvider';

/**
 * Manager for Variant Matrix functionality
 * Handles command registration and lifecycle management
 */
export class SylangVariantMatrixManager {
  private logger: SylangLogger;
  private matrixProvider: VariantMatrixProvider;

  constructor(symbolManager: SylangSymbolManager, logger: SylangLogger) {
    this.logger = logger;
    this.matrixProvider = new VariantMatrixProvider(symbolManager, logger);
  }

  /**
   * Show variant matrix for .fml file
   */
  async showVariantMatrix(fmlUri: vscode.Uri): Promise<void> {
    try {
      // Validate file extension
      if (!fmlUri.fsPath.endsWith('.fml')) {
        throw new Error('Variant matrix can only be opened for .fml files');
      }

      this.logger.info(`🎯 ${getVersionedLogger('VARIANT MATRIX MANAGER')} - Opening variant matrix for ${fmlUri.fsPath}`);
      
      await this.matrixProvider.showVariantMatrix(fmlUri);
      
      this.logger.info(`✅ ${getVersionedLogger('VARIANT MATRIX MANAGER')} - Variant matrix opened successfully`);
    } catch (error) {
      this.logger.error(`❌ ${getVersionedLogger('VARIANT MATRIX MANAGER')} - Error opening variant matrix: ${error}`);
      vscode.window.showErrorMessage(`Failed to open variant matrix: ${error}`);
      throw error;
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.logger.info(`🧹 ${getVersionedLogger('VARIANT MATRIX MANAGER')} - Disposing variant matrix manager`);
    // No explicit disposal needed for the provider as webview handles its own lifecycle
  }
}
