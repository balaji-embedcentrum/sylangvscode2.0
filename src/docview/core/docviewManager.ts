import * as vscode from 'vscode';
import { SylangLogger } from '../../core/logger';
import { SylangSymbolManager } from '../../core/symbolManager';
import { SylangDocViewProvider } from './docviewProvider';
import { getVersionedLogger } from '../../core/version';

/**
 * Manages docview functionality for Sylang files
 */
export class SylangDocViewManager {
    private logger: SylangLogger;
    private docViewProvider: SylangDocViewProvider;

    constructor(
        extensionUri: vscode.Uri,
        symbolManager: SylangSymbolManager,
        logger: SylangLogger
    ) {
        this.logger = logger;
        this.docViewProvider = new SylangDocViewProvider(extensionUri, logger, symbolManager);
    }

    /**
     * Initialize the docview manager
     */
    public initialize(_context: vscode.ExtensionContext): void {
        // DocView provider is ready - no registration needed for panels
        this.logger.info(`${getVersionedLogger('DOCVIEW MANAGER')} - DocView manager initialized`);
    }

    /**
     * Show docview for a specific file
     */
    public async showDocView(fileUri: vscode.Uri): Promise<void> {
        await this.docViewProvider.showDocView(fileUri);
    }

    /**
     * Check if file is supported for docview
     */
    public isDocViewSupported(fileUri: vscode.Uri): boolean {
        const fileExtension = fileUri.fsPath.toLowerCase();
        return fileExtension.endsWith('.req') || 
               fileExtension.endsWith('.tst') || 
               fileExtension.endsWith('.fml') || 
               fileExtension.endsWith('.fun');
    }

    /**
     * Handle file changes - refresh docview if needed
     */
    public async handleFileChange(fileUri: vscode.Uri): Promise<void> {
        if (this.isDocViewSupported(fileUri)) {
            // If the changed file is currently being displayed in docview, refresh it
            // This will be called by the extension when files change
            this.logger.debug(`${getVersionedLogger('DOCVIEW MANAGER')} - File changed: ${fileUri.fsPath}`);
        }
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.logger.info(`${getVersionedLogger('DOCVIEW MANAGER')} - DocView manager disposed`);
    }
}
