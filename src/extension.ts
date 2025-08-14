import * as vscode from 'vscode';
import { SylangLogger } from './core/logger';
import { SylangSymbolManager } from './core/symbolManager';
import { SylangValidationEngine } from './core/validationEngine';
import { SylangCommandManager } from './commands/commandManager';
import { SylangDiagnosticsProvider } from './diagnostics/diagnosticsProvider';
import { SylangDecorationProvider } from './core/decorationProvider';

import { SylangConfigManager } from './core/configManager';
import { SylangDiagramManager } from './diagrams/core/diagramManager';
import { SylangDocViewManager } from './docview/core/docviewManager';
import { SYLANG_VERSION, getVersionedLogger } from './core/version';
import { SylangLicenseManager } from './premium/licensing/licenseManager';
import { SylangLicenseCommands } from './premium/licensing/licenseCommands';
import { SylangFeatureGates } from './premium/features/featureGates';
import { SylangTraceabilityManager } from './traceability/core/traceabilityManager';

let logger: SylangLogger;
let symbolManager: SylangSymbolManager;
let validationEngine: SylangValidationEngine;
let commandManager: SylangCommandManager;
let diagnosticsProvider: SylangDiagnosticsProvider;
let decorationProvider: SylangDecorationProvider;

let configManager: SylangConfigManager; // Config manager
let diagramManager: SylangDiagramManager; // Diagram manager
let docViewManager: SylangDocViewManager; // DocView manager
let licenseManager: SylangLicenseManager; // Premium license manager
let licenseCommands: SylangLicenseCommands; // License commands
let featureGates: SylangFeatureGates; // Premium feature gates
let traceabilityManager: SylangTraceabilityManager; // Traceability matrix manager

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize logging system with version visibility
    logger = new SylangLogger();
    const version = getExtensionVersion();
    logger.info(`🚀 ${getVersionedLogger('EXTENSION')} - Starting activation...`);
    
    try {
        // Initialize config manager
        logger.info(`🔧 EXTENSION v${version} - Creating ConfigManager...`);
        configManager = new SylangConfigManager(logger);
        
        // Get workspace root for config manager
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        configManager.initialize(workspaceRoot);

        // Initialize premium licensing system (loosely coupled)
        logger.info(`🔑 EXTENSION v${version} - Initializing premium licensing system...`);
        licenseManager = SylangLicenseManager.getInstance(logger);
        licenseCommands = new SylangLicenseCommands(logger);
        featureGates = new SylangFeatureGates(logger);
        
        // Initialize license system
        await licenseManager.initialize();
        await featureGates.initialize();

        // NEW: Set up file watchers for real-time reactivity
        if (workspaceRoot) {
            const configWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceRoot, '.sylangconfig')
            );
            configWatcher.onDidChange(() => {
                logger.info(`🔧 EXTENSION v${version} - .sylangconfig changed, reloading...`);
                configManager.reloadConfig();
            });
            configWatcher.onDidCreate(() => {
                logger.info(`🔧 EXTENSION v${version} - .sylangconfig created, loading...`);
                configManager.reloadConfig();
            });
            configWatcher.onDidDelete(() => {
                logger.info(`🔧 EXTENSION v${version} - .sylangconfig deleted, using defaults...`);
                configManager.reloadConfig();
            });
            context.subscriptions.push(configWatcher);


        }
        
        // Initialize core components
        logger.info(`🔧 EXTENSION v${version} - Creating SymbolManager...`);
        symbolManager = new SylangSymbolManager(logger);
        
        logger.info(`🔧 EXTENSION v${version} - Creating ValidationEngine...`);
        validationEngine = new SylangValidationEngine(logger, symbolManager);
        
        logger.info(`🔧 EXTENSION v${version} - Creating DiagnosticsProvider...`);
        diagnosticsProvider = new SylangDiagnosticsProvider(logger, validationEngine);
        
        logger.info(`🔧 EXTENSION v${version} - Creating DecorationProvider...`);
        decorationProvider = new SylangDecorationProvider(logger, symbolManager);
        
        logger.info(`🔧 EXTENSION v${version} - Creating CommandManager...`);
        commandManager = new SylangCommandManager(logger, symbolManager);
        
        // NEW: Initialize diagram manager
        logger.info(`🔧 EXTENSION v${version} - Creating DiagramManager...`);
        diagramManager = new SylangDiagramManager(symbolManager, logger);
        
        // NEW: Initialize docview manager
        logger.info(`🔧 EXTENSION v${version} - Creating DocViewManager...`);
        docViewManager = new SylangDocViewManager(context.extensionUri, symbolManager, logger);
        
        // Initialize traceability analysis (loosely coupled)
        logger.info(`🔗 EXTENSION v${version} - Initializing traceability analysis...`);
        traceabilityManager = new SylangTraceabilityManager(symbolManager, logger);
        traceabilityManager.initialize();
        
        // Register all components
        logger.info(`🔧 EXTENSION v${version} - Registering language support...`);
        registerLanguageSupport(context);
        
        logger.info(`🔧 EXTENSION v${version} - Registering commands...`);
        registerCommands(context);
        
        // Register premium license commands (loosely coupled)
        logger.info(`🔑 EXTENSION v${version} - Registering license commands...`);
        licenseCommands.registerCommands(context);
        
        logger.info(`🔧 EXTENSION v${version} - Registering event handlers...`);
        registerEventHandlers(context);
        
        // NEW: Initialize docview
        logger.info(`🔧 EXTENSION v${version} - Initializing DocView...`);
        docViewManager.initialize(context);
        
        // FORCE: Manually scan for .agt files to ensure they're processed
        logger.info('🔧 [EXTENSION v2.8.0] Force scanning for .agt files...');
        const agtFiles = await vscode.workspace.findFiles('**/*.agt');
        logger.info(`🔧 [EXTENSION v2.8.0] Found ${agtFiles.length} .agt files`);
        for (const agtFile of agtFiles) {
            logger.info(`🔧 [EXTENSION v2.8.0] Force adding .agt file: ${agtFile.fsPath}`);
            await symbolManager.addDocument(agtFile);
        }

        logger.info(`✅ EXTENSION v${version} - Activation completed successfully`);
        
        // Force trigger decoration updates for debugging
        logger.debug(`🔧 EXTENSION v${version} - Force triggering decoration updates for debugging...`);
        setTimeout(() => {
            if (vscode.window.activeTextEditor) {
                logger.debug(`🔧 EXTENSION v${version} - Updating decorations for active editor: ${vscode.window.activeTextEditor.document.fileName}`);
                decorationProvider.updateDecorations(vscode.window.activeTextEditor);
            } else {
                logger.debug(`🔧 EXTENSION v${version} - No active editor found for decoration update`);
            }
        }, 2000); // Wait 2 seconds after activation
        
        // GLOBAL STARTUP VALIDATION: Validate all files on extension load (Fix 3)
        setTimeout(async () => {
            logger.info(`🔧 EXTENSION v${version} - Starting global project validation...`);
            await validationEngine.validateAllFiles();
            logger.info(`🔧 EXTENSION v${version} - Global project validation completed`);
        }, 3000); // Wait 3 seconds to ensure everything is initialized
        
    } catch (error) {
        logger.error(`❌ EXTENSION v${version} - Activation failed: ${error}`);
        logger.error(`📊 Stack trace: ${error instanceof Error ? error.stack : String(error)}`);
        throw error;
    }
}

export function deactivate() {
    logger?.info('Sylang Language Support deactivated');
    
    // Cleanup resources
    try {
        symbolManager?.dispose();
        validationEngine?.dispose();
        diagnosticsProvider?.dispose();
        decorationProvider?.dispose();
        commandManager?.dispose();
        diagramManager?.dispose(); // NEW: Dispose diagram manager
        docViewManager?.dispose(); // NEW: Dispose docview manager
        traceabilityManager?.dispose(); // NEW: Dispose traceability manager
        logger?.dispose();
    } catch (error) {
        console.error(`Error during extension deactivation: ${error}`);
    }
}

function registerLanguageSupport(context: vscode.ExtensionContext) {
    try {
        // Register document selectors for all Sylang file types
        const sylangLanguages = [
            'sylang-ple', 'sylang-fml', 'sylang-vml', 'sylang-vcf',
            'sylang-fun', 'sylang-req', 'sylang-tst', 'sylang-blk', 'sylang-spr', 'sylang-agt'
        ];
        
        logger.debug(`🔧 LANGUAGE SUPPORT: Starting registration for ${sylangLanguages.length} languages`);
        
        sylangLanguages.forEach((language, index) => {
            logger.debug(`🔧 LANGUAGE SUPPORT: Registering providers for language ${index + 1}/${sylangLanguages.length}: ${language}`);
            const documentSelector: vscode.DocumentSelector = { 
                scheme: 'file', 
                language: language 
            };
            
            // Register completion provider for autocomplete
            const completionProvider = vscode.languages.registerCompletionItemProvider(
                documentSelector,
                {
                    provideCompletionItems: (document, position) => {
                        return validationEngine.provideCompletionItems(document, position);
                    }
                },
                ' ', // Trigger completion on space
                '"' // Trigger completion on quote for string literals
            );
            
            // Register definition provider for Go to Definition
            const definitionProvider = vscode.languages.registerDefinitionProvider(
                documentSelector,
                {
                    provideDefinition: (document, position) => {
                        return validationEngine.provideDefinition(document, position);
                    }
                }
            );
            
            // Register hover provider for tooltips
            const hoverProvider = vscode.languages.registerHoverProvider(
                documentSelector,
                {
                    provideHover: (document, position) => {
                        return validationEngine.provideHover(document, position);
                    }
                }
            );
            
            // Register document symbol provider for outline
            const documentSymbolProvider = vscode.languages.registerDocumentSymbolProvider(
                documentSelector,
                {
                    provideDocumentSymbols: (document) => {
                        return validationEngine.provideDocumentSymbols(document);
                    }
                }
            );
            
            // Register references provider for Find All References
            const referencesProvider = vscode.languages.registerReferenceProvider(
                documentSelector,
                {
                    provideReferences: (document, position, context) => {
                        return validationEngine.provideReferences(document, position, context);
                    }
                }
            );
        
            context.subscriptions.push(completionProvider, definitionProvider, hoverProvider, documentSymbolProvider, referencesProvider);
            logger.debug(`🔧 LANGUAGE SUPPORT: Successfully registered all providers for ${language}`);
        });
        
        logger.info(`🔧 LANGUAGE SUPPORT: Successfully registered language support for ${sylangLanguages.length} Sylang file types`);
    } catch (error) {
        logger.error(`🔧 LANGUAGE SUPPORT: Failed to register language support: ${error}`);
        throw error;
    }
}

function registerCommands(context: vscode.ExtensionContext) {
    // Simple command registration with error handling
        const commandsToRegister = [
        { id: 'sylang.createSylangRules', handler: () => commandManager.createSylangRules() },

        { id: 'sylang.generateVmlFromFml', handler: (uri: vscode.Uri) => commandManager.generateVmlFromFml(uri) },
        { id: 'sylang.generateVcfFromVml', handler: (uri: vscode.Uri) => commandManager.generateVcfFromVml(uri) },
        { id: 'sylang.showFeatureModelDiagram', handler: (uri: vscode.Uri) => diagramManager.openDiagram(uri) },
          { id: 'sylang.showVariantModelDiagram', handler: (uri: vscode.Uri) => diagramManager.openDiagram(uri) },
        { id: 'sylang.showInternalBlockDiagram', handler: (uri: vscode.Uri) => diagramManager.openInternalBlockDiagram(uri) },
        { id: 'sylang.showGraphTraversal', handler: (uri: vscode.Uri) => diagramManager.openGraphTraversal(uri) },

        { id: 'sylang.showDocView', handler: (uri: vscode.Uri) => docViewManager.showDocView(uri) },
        { id: 'sylang.showTraceabilityMatrix', handler: (uri: vscode.Uri) => traceabilityManager.showTraceabilityMatrix(uri) },
        { id: 'sylang.exportTraceabilityMatrix', handler: (uri: vscode.Uri) => traceabilityManager.exportTraceabilityMatrix(uri) },
        { id: 'sylang.revalidateAllFiles', handler: async () => await revalidateAllFiles() }
    ];

    let registeredCount = 0;
    
    for (const cmd of commandsToRegister) {
        try {
            const disposable = vscode.commands.registerCommand(cmd.id, cmd.handler);
            context.subscriptions.push(disposable);
            registeredCount++;
        } catch (error) {
            if (error instanceof Error && error.message.includes('already exists')) {
                logger.debug(`Command ${cmd.id} already registered, skipping`);
                registeredCount++; // Count as registered
            } else {
                logger.error(`Failed to register command ${cmd.id}: ${error}`);
            }
        }
    }
    
    logger.debug(`Registered ${registeredCount}/${commandsToRegister.length} Sylang commands`);
}

function registerEventHandlers(context: vscode.ExtensionContext) {
    // Watch for file changes to update symbol table and validation
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{ple,fml,vml,vcf,fun,req,tst,blk,spr,agt}');
    
    // File creation handler
    fileWatcher.onDidCreate((uri) => {
        logger.debug(`Sylang file created: ${uri.fsPath}`);
        symbolManager.addDocument(uri);
        validateDocument(uri);
        decorationProvider.updateAllVisibleEditors();
    });
    
    // File change handler
    fileWatcher.onDidChange((uri) => {
        logger.debug(`Sylang file changed: ${uri.fsPath}`);
        symbolManager.updateDocument(uri);
        validateDocument(uri);
        decorationProvider.updateAllVisibleEditors();
        
        // NEW: Handle diagram updates
        diagramManager?.handleFileChange(uri);
        
        // NEW: Handle docview updates
        docViewManager?.handleFileChange(uri);
        
        // NEW: Handle traceability updates
        traceabilityManager?.handleFileChange(uri);
    });
    
    // File deletion handler
    fileWatcher.onDidDelete((uri) => {
        logger.debug(`Sylang file deleted: ${uri.fsPath}`);
        symbolManager.removeDocument(uri);
        symbolManager.removeGlobalIdentifiersForFile(uri); // CRITICAL: Clean up global identifiers
        symbolManager.removeDependenciesForFile(uri); // SMART RE-VALIDATION: Clean up dependencies
        diagnosticsProvider.clearDiagnostics(uri);
    });
    
    // Document change handler for real-time validation
    const documentChangeHandler = vscode.workspace.onDidChangeTextDocument((event) => {
        if (isSylangDocument(event.document)) {
            const config = vscode.workspace.getConfiguration('sylang');
            if (config.get('validation.realTime', true)) {
                // Debounce validation to avoid excessive calls
                setTimeout(() => {
                    symbolManager.updateDocumentContent(event.document);
                    validateDocument(event.document.uri);
                    decorationProvider.updateAllVisibleEditors();
                    
                    // NEW: Handle diagram updates
                    diagramManager?.handleFileChange(event.document.uri);
                    
                    // NEW: Handle docview updates
                    docViewManager?.handleFileChange(event.document.uri);
                    
                    // NEW: Handle traceability updates
                    traceabilityManager?.handleFileChange(event.document.uri);
                }, 300);
            }
        }
    });
    
    // Document save handler
    const documentSaveHandler = vscode.workspace.onDidSaveTextDocument((document) => {
        if (isSylangDocument(document)) {
            logger.debug(`Sylang file saved: ${document.uri.fsPath}`);
            symbolManager.updateDocumentContent(document);
            validateDocument(document.uri);
            decorationProvider.updateAllVisibleEditors();
            
            // NEW: Handle diagram updates
            diagramManager?.handleFileChange(document.uri);
            
            // NEW: Handle docview updates
            docViewManager?.handleFileChange(document.uri);
            
            // NEW: Handle traceability updates
            traceabilityManager?.handleFileChange(document.uri);
        }
    });

    // Active editor change handler for decorations
    const activeEditorChangeHandler = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && isSylangDocument(editor.document)) {
            decorationProvider.updateDecorations(editor);
            
            // NEW: Handle diagram focus events
            diagramManager?.handleDiagramFocus(editor.document.uri);
        }
    });

    // Visible editors change handler
    const visibleEditorsChangeHandler = vscode.window.onDidChangeVisibleTextEditors(() => {
        decorationProvider.updateAllVisibleEditors();
    });
    
    context.subscriptions.push(fileWatcher, documentChangeHandler, documentSaveHandler, activeEditorChangeHandler, visibleEditorsChangeHandler);
    logger.debug('Registered file system and document event handlers');
}

function validateDocument(uri: vscode.Uri) {
    const config = vscode.workspace.getConfiguration('sylang');
    if (config.get('validation.enabled', true)) {
        // SMART RE-VALIDATION: Only validate affected files (Fix 2)
        const filesToValidate = symbolManager.getFilesToRevalidate(uri.fsPath);
        filesToValidate.forEach(filePath => {
            const fileUri = vscode.Uri.file(filePath);
            validationEngine.validateDocument(fileUri).then((diagnostics: vscode.Diagnostic[]) => {
                diagnosticsProvider.updateDiagnostics(fileUri, diagnostics);
            }).catch((error: any) => {
                logger.error(`Validation failed for ${fileUri.fsPath}: ${error}`);
            });
        });
    }
}

function isSylangDocument(document: vscode.TextDocument): boolean {
    const sylangExtensions = ['.ple', '.fml', '.vml', '.vcf', '.fun', '.req', '.tst', '.blk', '.spr', '.agt'];
    return sylangExtensions.some(ext => document.fileName.endsWith(ext));
}

// MANUAL REVALIDATION COMMAND: Allow user to trigger full project validation (Fix 4)
async function revalidateAllFiles(): Promise<void> {
    try {
        logger.info(`🔧 EXTENSION v${SYLANG_VERSION} - Manual revalidation triggered by user`);
        
        // Show progress notification
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Revalidating all Sylang files...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "Starting validation..." });
            
            await validationEngine.validateAllFiles();
            
            progress.report({ increment: 100, message: "Validation completed!" });
        });
        
        vscode.window.showInformationMessage("✅ All Sylang files have been revalidated successfully.");
        logger.info(`🔧 EXTENSION v${SYLANG_VERSION} - Manual revalidation completed`);
        
    } catch (error) {
        logger.error(`❌ Manual revalidation failed: ${error}`);
        vscode.window.showErrorMessage(`❌ Revalidation failed: ${error}`);
    }
}

function getExtensionVersion(): string {
    try {
        // Get version from VSCode extension API - more reliable than file path
        const extension = vscode.extensions.getExtension('balaji-embedcentrum.sylang');
        return extension?.packageJSON?.version || SYLANG_VERSION;
    } catch (error) {
        return SYLANG_VERSION;
    }
} 