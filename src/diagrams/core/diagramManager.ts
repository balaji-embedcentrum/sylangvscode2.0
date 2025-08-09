import * as vscode from 'vscode';
import * as path from 'path';
import { DiagramDataTransformer } from './diagramDataTransformer';
import { DiagramRenderer } from './diagramRenderer';
import { DiagramUpdateQueue } from './diagramUpdateQueue';
import { SylangSymbolManager } from '../../core/symbolManager';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { 
  DiagramType,
  DiagramData,
  UpdateTrigger,
  PerformanceMetrics
} from '../types/diagramTypes';

export class SylangDiagramManager {
  private symbolManager: SylangSymbolManager;
  private logger: SylangLogger;
  private renderer: DiagramRenderer;
  private dataTransformer: DiagramDataTransformer;
  private updateQueue: DiagramUpdateQueue;
  private activeDiagrams: Map<string, vscode.WebviewPanel> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();

  constructor(symbolManager: SylangSymbolManager, logger: SylangLogger) {
    this.symbolManager = symbolManager;
    this.logger = logger;
    this.renderer = new DiagramRenderer(logger);
    this.dataTransformer = new DiagramDataTransformer(symbolManager, logger);
    this.updateQueue = new DiagramUpdateQueue(logger, this);
    
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Initialized`);
  }

  /**
   * Opens a diagram for the specified file
   */
  async openDiagram(fileUri: vscode.Uri): Promise<void> {
    try {
      const diagramType = this.getDiagramTypeFromFile(fileUri);
      if (!diagramType) {
        this.logger.warn(`No diagram type found for file: ${fileUri.fsPath}`);
        return;
      }

      // Check if diagram is already open
      const existingPanel = this.activeDiagrams.get(fileUri.toString());
      if (existingPanel) {
        existingPanel.reveal();
        return;
      }

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Opening diagram for: ${fileUri.fsPath}`);

      const extensionPath = vscode.extensions.getExtension('balaji-embedcentrum.sylang')!.extensionPath;
      const fileName = path.basename(fileUri.fsPath);
      const panel = vscode.window.createWebviewPanel(
        'sylangDiagram',
        `Feature Model - ${fileName}`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(extensionPath, 'src', 'diagrams', 'webview', 'dist'))
          ]
        }
      );

      // Store the panel
      this.activeDiagrams.set(fileUri.toString(), panel);

      // Set up message handling
      this.setupWebviewMessageHandling(panel);

      // Load initial diagram data
      await this.loadDiagramData(panel, fileUri, diagramType);

      // Handle panel disposal
      panel.onDidDispose(() => {
        this.activeDiagrams.delete(fileUri.toString());
        this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Diagram closed: ${fileUri.fsPath}`);
      });

    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Failed to open diagram: ${error}`);
      vscode.window.showErrorMessage(`Failed to open diagram: ${error}`);
    }
  }

  /**
   * Refreshes the current diagram
   */
  async refreshCurrentDiagram(): Promise<void> {
    const activePanel = vscode.window.activeTextEditor?.document.uri;
    if (activePanel && this.activeDiagrams.has(activePanel.toString())) {
      const panel = this.activeDiagrams.get(activePanel.toString())!;
      const diagramType = this.getDiagramTypeFromFile(activePanel);
      if (diagramType) {
        await this.loadDiagramData(panel, activePanel, diagramType);
      }
    }
  }

  /**
   * Exports the current diagram
   */
  async exportDiagram(format: 'png' | 'svg' | 'pdf'): Promise<void> {
    const activePanel = vscode.window.activeTextEditor?.document.uri;
    if (activePanel && this.activeDiagrams.has(activePanel.toString())) {
      const panel = this.activeDiagrams.get(activePanel.toString())!;
      
      // Send export message to webview
      panel.webview.postMessage({
        type: 'export',
        payload: { format },
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handles file changes and triggers diagram updates
   */
  async handleFileChange(fileUri: vscode.Uri): Promise<void> {
    if (this.isDiagramFile(fileUri)) {
      this.updateQueue.queueUpdate(fileUri, UpdateTrigger.FileChange);
    }
  }

  /**
   * Handles diagram focus events
   */
  async handleDiagramFocus(fileUri: vscode.Uri): Promise<void> {
    if (this.activeDiagrams.has(fileUri.toString())) {
      this.updateQueue.queueUpdate(fileUri, UpdateTrigger.DiagramFocus);
    }
  }

  /**
   * Processes a diagram update
   */
  async processUpdate(fileUri: vscode.Uri, trigger: UpdateTrigger): Promise<void> {
    try {
      const panel = this.activeDiagrams.get(fileUri.toString());
      if (!panel) {
        return;
      }

      const diagramType = this.getDiagramTypeFromFile(fileUri);
      if (!diagramType) {
        return;
      }

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Processing update for: ${fileUri.fsPath} (trigger: ${trigger})`);

      // Transform data
      const startTime = Date.now();
      const diagramData = await this.dataTransformer.transformFileToDiagram(fileUri, diagramType);
      const transformTime = Date.now() - startTime;

      if (diagramData.success && diagramData.data) {
        // Send update to webview
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Sending update to webview with ${diagramData.data.nodes.length} nodes, ${diagramData.data.edges.length} edges`);
        panel.webview.postMessage({
          type: 'update',
          payload: {
            diagramType: diagramType,
            data: diagramData.data
          },
          timestamp: Date.now()
        });
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Update message sent to webview successfully`);

        // Update performance metrics
        this.updatePerformanceMetrics(fileUri.toString(), {
          renderTime: 0, // Will be updated by webview
          layoutTime: 0, // Will be updated by webview
          dataTransformTime: transformTime,
          totalTime: transformTime,
          memoryUsage: 0, // Will be updated by webview
          nodeCount: diagramData.data.nodes.length,
          edgeCount: diagramData.data.edges.length
        });

        this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Update completed for: ${fileUri.fsPath}`);
      } else {
        this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Failed to transform diagram data: ${diagramData.error}`);
      }

    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Error processing update: ${error}`);
    }
  }

  /**
   * Loads diagram data and sends it to the webview
   */
  private async loadDiagramData(panel: vscode.WebviewPanel, fileUri: vscode.Uri, diagramType: DiagramType): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Transform file to diagram data
      const diagramData = await this.dataTransformer.transformFileToDiagram(fileUri, diagramType);
      
      if (diagramData.success && diagramData.data) {
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Data transformation successful, generating webview HTML`);
        
        // Generate HTML content
        const htmlContent = this.generateWebviewHTML(panel.webview, diagramType, diagramData.data);
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - HTML content generated, setting webview HTML`);
        panel.webview.html = htmlContent;

        // Update performance metrics
        this.updatePerformanceMetrics(fileUri.toString(), {
          renderTime: 0,
          layoutTime: 0,
          dataTransformTime: Date.now() - startTime,
          totalTime: Date.now() - startTime,
          memoryUsage: 0,
          nodeCount: diagramData.data.nodes.length,
          edgeCount: diagramData.data.edges.length
        });

        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Diagram loaded: ${fileUri.fsPath} (${diagramData.data.nodes.length} nodes, ${diagramData.data.edges.length} edges)`);
      } else {
        throw new Error(diagramData.error || 'Failed to transform diagram data');
      }

    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Failed to load diagram data: ${error}`);
      panel.webview.html = this.generateErrorHTML(error as string);
    }
  }

  /**
   * Sets up webview message handling
   */
  private setupWebviewMessageHandling(panel: vscode.WebviewPanel): void {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting up webview message handling`);
    
    panel.webview.onDidReceiveMessage(message => {
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Received webview message: ${message.type}`);
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Full message: ${JSON.stringify(message)}`);
      
      switch (message.type) {
        case 'ready':
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview ready`);
          break;
          
        case 'performance':
          this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Performance metrics: ${JSON.stringify(message.payload)}`);
          break;
          
        case 'error':
          this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview error: ${JSON.stringify(message.payload)}`);
          break;
          
        case 'log':
          const logData = message.payload;
          switch (logData.level) {
            case 'debug':
              this.logger.debug(`🔧 WEBVIEW: ${logData.message}`);
              break;
            case 'info':
              this.logger.info(`🔧 WEBVIEW: ${logData.message}`);
              break;
            case 'warn':
              this.logger.warn(`🔧 WEBVIEW: ${logData.message}`);
              break;
            case 'error':
              this.logger.error(`🔧 WEBVIEW: ${logData.message}`);
              break;
            default:
              this.logger.info(`🔧 WEBVIEW: ${logData.message}`);
          }
          break;
          
        case 'console':
          // Handle console.log messages from the webview
          this.logger.info(`🔧 WEBVIEW CONSOLE: ${message.payload.message}`);
          break;
          
        case 'refreshDiagram':
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Refresh diagram requested from webview`);
          // Find the file URI for this panel and trigger a refresh
          let foundPanel = false;
          for (const [uriString, webviewPanel] of this.activeDiagrams.entries()) {
            if (webviewPanel === panel) {
              foundPanel = true;
              this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Found matching panel for URI: ${uriString}`);
              const fileUri = vscode.Uri.parse(uriString);
              this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Triggering processUpdate for refresh`);
              this.processUpdate(fileUri, UpdateTrigger.ManualRefresh);
              break;
            }
          }
          if (!foundPanel) {
            this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Could not find matching panel for refresh request`);
          }
          break;
        case 'export':
          // Webview requested an export; bounce the message back so the webview's main handler can generate the PNG
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Export requested from webview: ${JSON.stringify(message.payload || {})}`);
          try {
            panel.webview.postMessage({
              type: 'export',
              payload: message.payload || { format: 'png' },
              timestamp: Date.now()
            });
          } catch (e) {
            this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Failed to forward export message: ${e}`);
          }
          break;
          
        default:
          this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Unknown message type: ${message.type}`);
      }
    });
  }

  /**
   * Determines diagram type from file extension
   */
  private getDiagramTypeFromFile(fileUri: vscode.Uri): DiagramType | undefined {
    const ext = path.extname(fileUri.fsPath);
    switch (ext) {
      case '.fml':
        return DiagramType.FeatureModel;
      case '.vml':
        return DiagramType.VariantModel;
      case '.blk':
        return DiagramType.InternalBlockDiagram;
      default:
        return undefined;
    }
  }

  /**
   * Checks if file is a diagram file
   */
  private isDiagramFile(fileUri: vscode.Uri): boolean {
    return this.getDiagramTypeFromFile(fileUri) !== undefined;
  }

  /**
   * Generates webview HTML content
   */
  private generateWebviewHTML(webview: vscode.Webview, diagramType: DiagramType, data: DiagramData): string {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Starting HTML generation for diagram type: ${diagramType}`);
    
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(
      path.join(vscode.extensions.getExtension('balaji-embedcentrum.sylang')!.extensionPath, 'src/diagrams/webview/dist/main.js')
    ));

    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Generating HTML with data: ${data.nodes.length} nodes, ${data.edges.length} edges`);
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Script URI: ${scriptUri}`);
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview CSP source: ${webview.cspSource}`);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline';">
    <title>Sylang Diagram</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        #diagram-container {
            width: 100vw;
            height: 100vh;
            overflow: hidden;
        }
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-size: 16px;
        }
        .error {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-size: 16px;
            color: red;
        }
    </style>
</head>
<body>
    <div id="diagram-container">
        <div class="loading">Calculating layout...</div>
    </div>
    
    <script>
        // POLYFILL FOR CUSTOMEVENT - MUST BE FIRST!
        if (typeof window !== 'undefined' && !window.CustomEvent) {
            window.CustomEvent = function(event, params) {
                params = params || { bubbles: false, cancelable: false, detail: undefined };
                var evt = document.createEvent('CustomEvent');
                evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
                return evt;
            };
            window.CustomEvent.prototype = window.Event.prototype;
        }
        
        // ALTERNATIVE POLYFILL - More robust approach
        if (typeof window !== 'undefined' && !window.CustomEvent) {
            window.CustomEvent = function(type, eventInitDict) {
                eventInitDict = eventInitDict || { bubbles: false, cancelable: false, detail: null };
                var event = document.createEvent('CustomEvent');
                event.initCustomEvent(type, eventInitDict.bubbles, eventInitDict.cancelable, eventInitDict.detail);
                return event;
            };
            window.CustomEvent.prototype = window.Event.prototype;
        }
        
        // IMMEDIATE DEBUG - This should execute immediately
        console.log('🔧 HTML SCRIPT - HTML is executing, about to set up webview');
        
        // Don't declare vscode here - let main.js handle it
        // Override console.log to send messages to extension (without vscode dependency)
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;
        
        // Store original functions for later use
        window._originalConsole = {
            log: originalConsoleLog,
            error: originalConsoleError,
            warn: originalConsoleWarn
        };
        
        console.log('🔧 HTML SCRIPT - Console override set up, main.js will handle vscode messaging');
        
        // Error handling for script loading
        window.addEventListener('error', function(e) {
            console.error('🔧 HTML SCRIPT - Script loading error:', e);
            const container = document.getElementById('diagram-container');
            if (container) {
                container.innerHTML = '<div class="error">Error loading diagram script: ' + e.message + '</div>';
            }
        });
        
        // Initialize diagram data BEFORE loading main.js
        window.diagramData = ${JSON.stringify(data)};
        window.diagramType = '${diagramType}';
        
        console.log('🔧 HTML SCRIPT - Diagram data initialized. Nodes:', window.diagramData.nodes.length, 'Edges:', window.diagramData.edges.length);
        console.log('🔧 HTML SCRIPT - Diagram type:', window.diagramType);
        
        // Load the Preact app with immediate execution
        console.log('🔧 HTML SCRIPT - About to load main script from:', '${scriptUri}');
        
        const script = document.createElement('script');
        script.src = '${scriptUri}';
        script.onload = function() {
            console.log('🔧 HTML SCRIPT - Main script loaded successfully');
            // Trigger a custom event to notify the app that data is ready
            try {
                var event = new CustomEvent('diagramDataReady', {
                    detail: { data: window.diagramData, type: window.diagramType }
                });
                window.dispatchEvent(event);
                console.log('🔧 HTML SCRIPT - diagramDataReady event dispatched');
            } catch (e) {
                console.log('🔧 HTML SCRIPT - CustomEvent failed, using alternative method');
                // Alternative: directly call the initialization
                if (window.diagramData && window.diagramType) {
                    console.log('🔧 HTML SCRIPT - Data available, triggering immediate render');
                    // The main.js will handle this when it loads
                }
            }
        };
        script.onerror = function(error) {
            console.error('🔧 HTML SCRIPT - Failed to load main script:', error);
            const container = document.getElementById('diagram-container');
            if (container) {
                container.innerHTML = '<div class="error">Failed to load diagram script</div>';
            }
        };
        
        console.log('🔧 HTML SCRIPT - Appending script to head');
        document.head.appendChild(script);
        console.log('🔧 HTML SCRIPT - Script appended, waiting for load');
    </script>
</body>
</html>`;
  }

  /**
   * Generates error HTML content
   */
  private generateErrorHTML(error: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagram Error</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .error-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            text-align: center;
        }
        .error-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .error-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .error-message {
            font-size: 16px;
            color: var(--vscode-errorForeground);
            max-width: 600px;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">⚠️</div>
        <div class="error-title">Failed to Load Diagram</div>
        <div class="error-message">${error}</div>
    </div>
</body>
</html>`;
  }

  /**
   * Updates performance metrics
   */
  private updatePerformanceMetrics(fileUri: string, metrics: Partial<PerformanceMetrics>): void {
    const existing = this.performanceMetrics.get(fileUri) || {
      renderTime: 0,
      layoutTime: 0,
      dataTransformTime: 0,
      totalTime: 0,
      memoryUsage: 0,
      nodeCount: 0,
      edgeCount: 0
    };

    this.performanceMetrics.set(fileUri, { ...existing, ...metrics });
  }

  /**
   * Gets performance metrics for a file
   */
  getPerformanceMetrics(fileUri: string): PerformanceMetrics | undefined {
    return this.performanceMetrics.get(fileUri);
  }

  /**
   * Gets the symbol manager instance
   */
  getSymbolManager(): SylangSymbolManager {
    return this.symbolManager;
  }

  /**
   * Opens a graph traversal diagram for the entire project
   */
  async openGraphTraversal(sourceFileUri: vscode.Uri): Promise<void> {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Starting graph traversal diagram creation`);
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Source file: ${sourceFileUri.fsPath}`);
    
    try {
      // Validate file extension
      const fileExtension = sourceFileUri.fsPath.split('.').pop()?.toLowerCase();
      const sylangExtensions = ['ple', 'fml', 'vml', 'vcf', 'fun', 'req', 'tst', 'blk', 'spr', 'agt'];
      
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - File extension detected: ${fileExtension}`);
      
      if (!fileExtension || !sylangExtensions.includes(fileExtension)) {
        this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Invalid file extension: ${fileExtension}`);
        vscode.window.showErrorMessage('Please select a Sylang file to open the graph traversal view.');
        return;
      }

      // Check if symbol manager has project root
      if (!this.symbolManager.hasProjectRoot()) {
        this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - No Sylang project root found (.sylangrules missing)`);
        vscode.window.showErrorMessage('No Sylang project found. Please ensure .sylangrules file exists in workspace root.');
        return;
      }

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Project root validated: ${this.symbolManager.getProjectRoot()}`);

      // Get symbol statistics for logging
      const allSymbols = this.symbolManager.getAllSymbols();
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Found ${allSymbols.length} symbols in project`);
      // Check if diagram is already open
      const existingPanel = this.activeDiagrams.get('graph-traversal');
      if (existingPanel) {
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Graph traversal already open, revealing existing panel`);
        existingPanel.reveal();
        return;
      }

      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Creating new webview panel for graph traversal`);
      
      const extensionPath = vscode.extensions.getExtension('balaji-embedcentrum.sylang')!.extensionPath;
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Extension path: ${extensionPath}`);
      
      // Check if webview script file exists
      const webviewScriptPath = path.join(extensionPath, 'src', 'diagrams', 'webview', 'dist', 'main.js');
      const fs = require('fs');
      if (fs.existsSync(webviewScriptPath)) {
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview script file found: ${webviewScriptPath}`);
      } else {
        this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview script file NOT found: ${webviewScriptPath}`);
      }
      
      const panel = vscode.window.createWebviewPanel(
        'sylangGraphTraversal',
        'Sylang: Traceability View',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(extensionPath, 'src', 'diagrams', 'webview', 'dist'))
          ]
        }
      );

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview panel created successfully`);

      // Store the panel with a special key for graph traversal
      this.activeDiagrams.set('graph-traversal', panel);
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Panel stored in active diagrams map`);

      // Set up message handling
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting up webview message handling`);
      this.setupWebviewMessageHandling(panel);

      // Load graph traversal data
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Loading graph traversal data`);
      await this.loadGraphTraversalData(panel, sourceFileUri);

      // Handle panel disposal
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting up panel disposal handler`);
      panel.onDidDispose(() => {
        this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Graph traversal panel disposal triggered`);
        this.activeDiagrams.delete('graph-traversal');
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Graph traversal panel disposed and removed from active diagrams`);
      });

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Graph traversal diagram opened successfully`);

    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Failed to open graph traversal: ${error}`);
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Error stack: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
      vscode.window.showErrorMessage(`Failed to open graph traversal: ${error}`);
    }
  }

  /**
   * Opens an internal internal block diagram for the given .blk file
   */
  async openInternalBlockDiagram(sourceFileUri: vscode.Uri): Promise<void> {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Starting internal block diagram creation`);
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Source file: ${sourceFileUri.fsPath}`);
    
    try {
      // Validate file extension
      const fileExtension = sourceFileUri.fsPath.split('.').pop()?.toLowerCase();
      
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - File extension detected: ${fileExtension}`);
      
      if (fileExtension !== 'blk') {
        this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Invalid file extension for internal block diagram: ${fileExtension}`);
        vscode.window.showErrorMessage('Please select a .blk file to open the internal block diagram view.');
        return;
      }

      // Check if symbol manager has project root
      if (!this.symbolManager.hasProjectRoot()) {
        this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - No Sylang project root found (.sylangrules missing)`);
        vscode.window.showErrorMessage('No Sylang project found. Please ensure .sylangrules file exists in workspace root.');
        return;
      }

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Project root validated: ${this.symbolManager.getProjectRoot()}`);

      // Check if diagram is already open
      const diagramKey = `block-diagram-${sourceFileUri.toString()}`;
      const existingPanel = this.activeDiagrams.get(diagramKey);
      if (existingPanel) {
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Block diagram already open, revealing existing panel`);
        existingPanel.reveal();
        return;
      }

      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Creating new webview panel for internal block diagram`);
      
      const extensionPath = vscode.extensions.getExtension('balaji-embedcentrum.sylang')!.extensionPath;
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Extension path: ${extensionPath}`);
      
      // Check if webview script file exists
      const webviewScriptPath = path.join(extensionPath, 'src', 'diagrams', 'webview', 'dist', 'main.js');
      const fs = require('fs');
      if (fs.existsSync(webviewScriptPath)) {
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview script file found: ${webviewScriptPath}`);
      } else {
        this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview script file NOT found: ${webviewScriptPath}`);
      }
      
      const fileName = path.basename(sourceFileUri.fsPath);
      const panel = vscode.window.createWebviewPanel(
        'sylangInternalBlockDiagram',
        `Sylang: Internal Block Diagram - ${fileName}`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(extensionPath, 'src', 'diagrams', 'webview', 'dist'))
          ]
        }
      );

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview panel created successfully`);

      // Store the panel with file-specific key
      this.activeDiagrams.set(diagramKey, panel);
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Panel stored in active diagrams map`);

      // Set up message handling
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting up webview message handling`);
      this.setupWebviewMessageHandling(panel);

      // Load internal block diagram data
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Loading internal block diagram data`);
      await this.loadInternalBlockDiagramData(panel, sourceFileUri);

      // Handle panel disposal
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting up panel disposal handler`);
      panel.onDidDispose(() => {
        this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Block diagram panel disposal triggered`);
        this.activeDiagrams.delete(diagramKey);
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Block diagram panel disposed and removed from active diagrams`);
      });

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Block diagram opened successfully`);

    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Failed to open internal block diagram: ${error}`);
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Error stack: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
      vscode.window.showErrorMessage(`Failed to open internal block diagram: ${error}`);
    }
  }

  /**
   * Opens a trace tree diagram for the given file
   */
  async openTraceTree(sourceFileUri: vscode.Uri): Promise<void> {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Starting trace tree diagram creation`);
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Source file: ${sourceFileUri.fsPath}`);

    try {
      // Validate file extension
      if (!sourceFileUri.fsPath.match(/\.(ple|fml|fun|blk|agt|req|spr|tst|vcf|vml)$/i)) {
        throw new Error('Trace tree view is only available for Sylang files');
      }

      // Validate project root
      const projectRoot = this.symbolManager.getProjectRoot();
      if (!projectRoot) {
        throw new Error('No Sylang project root found (.sylangrules file missing)');
      }
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Project root validated: ${projectRoot}`);

      // Check if trace tree panel is already open
      const existingPanel = this.activeDiagrams.get('trace-tree');
      if (existingPanel) {
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Trace tree panel already exists, revealing it`);
        existingPanel.reveal();
        return;
      }

      // Get extension path for webview resources
      const extensionPath = vscode.extensions.getExtension('balaji-embedcentrum.sylang')?.extensionPath;
      if (!extensionPath) {
        throw new Error('Extension path not found');
      }

      // Check if webview script exists
      const webviewScriptPath = path.join(extensionPath, 'src', 'diagrams', 'webview', 'dist', 'main.js');
      if (!require('fs').existsSync(webviewScriptPath)) {
        throw new Error(`Webview script not found: ${webviewScriptPath}`);
      }
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview script file found: ${webviewScriptPath}`);

      // Create webview panel
      const panel = vscode.window.createWebviewPanel(
        'traceTree',
        'Sylang: Trace Tree View',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(extensionPath, 'src', 'diagrams', 'webview', 'dist'))
          ]
        }
      );

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview panel created successfully`);

      // Store the panel with a special key for trace tree
      this.activeDiagrams.set('trace-tree', panel);
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Panel stored in active diagrams map`);

      // Set up message handling
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting up webview message handling`);
      this.setupWebviewMessageHandling(panel);

      // Load trace tree data
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Loading trace tree data`);
      await this.loadTraceTreeData(panel, sourceFileUri);

      // Handle panel disposal
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting up panel disposal handler`);
      panel.onDidDispose(() => {
        this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Trace tree panel disposal triggered`);
        this.activeDiagrams.delete('trace-tree');
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Trace tree panel disposed and removed from active diagrams`);
      });

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Trace tree diagram opened successfully`);

    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Failed to open trace tree: ${error}`);
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Error stack: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
      vscode.window.showErrorMessage(`Failed to open trace tree: ${error}`);
    }
  }

  /**
   * Opens a trace table for the given file
   */
  async openTraceTable(sourceFileUri: vscode.Uri): Promise<void> {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Starting trace table creation`);
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Source file: ${sourceFileUri.fsPath}`);
    
    try {
      // Validate file extension
      const fileExtension = sourceFileUri.fsPath.split('.').pop()?.toLowerCase();
      const sylangExtensions = ['ple', 'fml', 'vml', 'vcf', 'fun', 'req', 'tst', 'blk', 'spr', 'agt'];
      
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - File extension detected: ${fileExtension}`);
      
      if (!fileExtension || !sylangExtensions.includes(fileExtension)) {
        this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Invalid file extension: ${fileExtension}`);
        vscode.window.showErrorMessage('Please select a Sylang file to open the trace table view.');
        return;
      }

      // Check if symbol manager has project root
      if (!this.symbolManager.hasProjectRoot()) {
        this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - No Sylang project root found (.sylangrules missing)`);
        vscode.window.showErrorMessage('No Sylang project found. Please ensure .sylangrules file exists in workspace root.');
        return;
      }

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Project root validated: ${this.symbolManager.getProjectRoot()}`);

      // Check if diagram is already open
      const existingPanel = this.activeDiagrams.get('trace-table');
      if (existingPanel) {
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Trace table already open, revealing existing panel`);
        existingPanel.reveal();
        return;
      }

      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Creating new webview panel for trace table`);
      
      const extensionPath = vscode.extensions.getExtension('balaji-embedcentrum.sylang')!.extensionPath;
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Extension path: ${extensionPath}`);
      
      const panel = vscode.window.createWebviewPanel(
        'sylangTraceTable',
        'Sylang: Traceability Table',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(extensionPath, 'src', 'diagrams', 'webview', 'dist'))
          ]
        }
      );

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview panel created successfully`);

      // Store the panel
      this.activeDiagrams.set('trace-table', panel);
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Panel stored in active diagrams map`);

      // Set up message handling
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting up webview message handling`);
      this.setupWebviewMessageHandling(panel);

      // Load trace table data
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Loading trace table data`);
      await this.loadTraceTableData(panel, sourceFileUri);

      // Handle panel disposal
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting up panel disposal handler`);
      panel.onDidDispose(() => {
        this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Trace table panel disposal triggered`);
        this.activeDiagrams.delete('trace-table');
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Trace table panel disposed and removed from active diagrams`);
      });

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Trace table opened successfully`);

    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Failed to open trace table: ${error}`);
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Error stack: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
      vscode.window.showErrorMessage(`Failed to open trace table: ${error}`);
    }
  }

  /**
   * Loads internal block diagram data into the webview
   */
  private async loadInternalBlockDiagramData(panel: vscode.WebviewPanel, sourceFileUri: vscode.Uri): Promise<void> {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Starting internal block diagram data loading`);
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Source file: ${sourceFileUri.fsPath}`);
    
    try {
      const startTime = Date.now();
      
      // Transform data for internal block diagram
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Calling data transformer for internal block diagram`);
              const result = await this.dataTransformer.transformFileToDiagram(sourceFileUri, DiagramType.InternalBlockDiagram);
      
      if (!result.success || !result.data) {
        this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Data transformation failed: ${result.error}`);
        throw new Error(result.error || 'Failed to transform data for internal block diagram');
      }

      const transformTime = Date.now() - startTime;
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Data transformation completed in ${transformTime}ms`);
      
      // Cast to BlockDiagramData to access blocks and connections
      const blockData = result.data as any;
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Generated internal block diagram data with ${blockData.blocks?.length || 0} blocks`);
      
      this.updatePerformanceMetrics(sourceFileUri.toString(), {
        dataTransformTime: transformTime,
        nodeCount: blockData.blocks?.length || 0,
        edgeCount: blockData.connections?.length || 0
      });

      // Generate initial HTML content for the webview
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Generating initial HTML content for internal block diagram webview`);
      const htmlContent = this.generateWebviewHTML(panel.webview, DiagramType.InternalBlockDiagram, result.data);
      
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting internal block diagram webview HTML content`);
      panel.webview.html = htmlContent;
      
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Block diagram webview HTML content set successfully`);

      // Send data to webview via postMessage for dynamic updates
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Sending data to internal block diagram webview via postMessage`);
      panel.webview.postMessage({
        type: 'update',
        payload: {
          diagramType: DiagramType.InternalBlockDiagram,
          data: result.data
        }
      });

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Block diagram data loaded successfully`);
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Total processing time: ${Date.now() - startTime}ms`);

    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Failed to load internal block diagram data: ${error}`);
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Error stack: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
      
      // Set error HTML content
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting error HTML content`);
      panel.webview.html = this.generateErrorHTML(`Failed to load internal block diagram data: ${error}`);
      
      // Send error to webview
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Sending error message to webview`);
      panel.webview.postMessage({
        type: 'error',
        payload: {
          message: `Failed to load internal block diagram data: ${error}`
        }
      });
    }
  }

  /**
   * Loads trace table data into the webview
   */
  private async loadTraceTableData(panel: vscode.WebviewPanel, sourceFileUri: vscode.Uri): Promise<void> {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Starting trace table data loading`);
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Source file: ${sourceFileUri.fsPath}`);
    
    try {
      const startTime = Date.now();
      
      // Transform data for trace table (use GraphTraversal data)
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Calling data transformer for trace table`);
      const result = await this.dataTransformer.transformFileToDiagram(sourceFileUri, DiagramType.GraphTraversal);
      
      if (!result.success || !result.data) {
        this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Data transformation failed: ${result.error}`);
        throw new Error(result.error || 'Failed to transform data for trace table');
      }

      const transformTime = Date.now() - startTime;
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Data transformation completed in ${transformTime}ms`);
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Generated ${result.data.nodes.length} nodes and ${result.data.edges.length} edges`);
      
      this.updatePerformanceMetrics(sourceFileUri.toString(), {
        dataTransformTime: transformTime,
        nodeCount: result.data.nodes.length,
        edgeCount: result.data.edges.length
      });

      // Generate initial HTML content for the webview
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Generating initial HTML content for trace table webview`);
      const htmlContent = this.generateWebviewHTML(panel.webview, DiagramType.TraceTable, result.data);
      
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting trace table webview HTML content`);
      panel.webview.html = htmlContent;
      
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Trace table webview HTML content set successfully`);

      // Send data to webview via postMessage for dynamic updates
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Sending data to trace table webview via postMessage`);
      panel.webview.postMessage({
        type: 'update',
        payload: {
          diagramType: DiagramType.TraceTable,
          data: result.data
        }
      });

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Trace table data loaded successfully`);
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Total processing time: ${Date.now() - startTime}ms`);

    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Failed to load trace table data: ${error}`);
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Error stack: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
      
      // Set error HTML content
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting error HTML content`);
      panel.webview.html = this.generateErrorHTML(`Failed to load trace table data: ${error}`);
      
      // Send error to webview
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Sending error message to webview`);
      panel.webview.postMessage({
        type: 'error',
        payload: {
          message: `Failed to load trace table data: ${error}`
        }
      });
    }
  }

  /**
   * Loads graph traversal data into the webview
   */
  private async loadGraphTraversalData(panel: vscode.WebviewPanel, sourceFileUri: vscode.Uri): Promise<void> {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Starting graph traversal data loading`);
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Source file: ${sourceFileUri.fsPath}`);
    
    try {
      const startTime = Date.now();
      
      // Transform data for graph traversal
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Calling data transformer for graph traversal`);
      const result = await this.dataTransformer.transformFileToDiagram(sourceFileUri, DiagramType.GraphTraversal);
      
      if (!result.success || !result.data) {
        this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Data transformation failed: ${result.error}`);
        throw new Error(result.error || 'Failed to transform data for graph traversal');
      }

      const transformTime = Date.now() - startTime;
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Data transformation completed in ${transformTime}ms`);
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Generated ${result.data.nodes.length} nodes and ${result.data.edges.length} edges`);
      
      this.updatePerformanceMetrics(sourceFileUri.toString(), {
        dataTransformTime: transformTime,
        nodeCount: result.data.nodes.length,
        edgeCount: result.data.edges.length
      });

      // Generate initial HTML content for the webview
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Generating initial HTML content for webview`);
      const htmlContent = this.generateWebviewHTML(panel.webview, DiagramType.GraphTraversal, result.data);
      
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting webview HTML content`);
      panel.webview.html = htmlContent;
      
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview HTML content set successfully`);

      // Send data to webview via postMessage for dynamic updates
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Sending data to webview via postMessage`);
      panel.webview.postMessage({
        type: 'update',
        payload: {
          diagramType: DiagramType.GraphTraversal,
          data: result.data
        }
      });

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Graph traversal data loaded successfully`);
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Total processing time: ${Date.now() - startTime}ms`);

    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Failed to load graph traversal data: ${error}`);
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Error stack: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
      
      // Set error HTML content
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting error HTML content`);
      panel.webview.html = this.generateErrorHTML(`Failed to load graph traversal data: ${error}`);
      
      // Send error to webview
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Sending error message to webview`);
      panel.webview.postMessage({
        type: 'error',
        payload: {
          message: `Failed to load graph traversal data: ${error}`
        }
      });
    }
  }

  /**
   * Loads trace tree data into the webview
   */
  private async loadTraceTreeData(panel: vscode.WebviewPanel, sourceFileUri: vscode.Uri): Promise<void> {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Starting trace tree data loading`);
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Source file: ${sourceFileUri.fsPath}`);
    
    try {
      const startTime = Date.now();
      
      // Transform data for trace tree
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Calling data transformer for trace tree`);
      const result = await this.dataTransformer.transformFileToDiagram(sourceFileUri, DiagramType.TraceTree);
      
      if (!result.success || !result.data) {
        this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Data transformation failed: ${result.error}`);
        throw new Error(result.error || 'Failed to transform data for trace tree');
      }

      const transformTime = Date.now() - startTime;
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Data transformation completed in ${transformTime}ms`);
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Generated ${result.data.nodes.length} nodes and ${result.data.edges.length} edges`);
      
      this.updatePerformanceMetrics(sourceFileUri.toString(), {
        dataTransformTime: transformTime,
        nodeCount: result.data.nodes.length,
        edgeCount: result.data.edges.length
      });

      // Generate initial HTML content for the webview
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Generating initial HTML content for webview`);
      const htmlContent = this.generateWebviewHTML(panel.webview, DiagramType.TraceTree, result.data);
      
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting webview HTML content`);
      panel.webview.html = htmlContent;
      
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Webview HTML content set successfully`);

      // Send data to webview via postMessage for dynamic updates
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Sending data to webview via postMessage`);
      panel.webview.postMessage({
        type: 'update',
        payload: {
          diagramType: DiagramType.TraceTree,
          data: result.data
        }
      });

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Trace tree data loaded successfully`);
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Total processing time: ${Date.now() - startTime}ms`);

    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Failed to load trace tree data: ${error}`);
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Error stack: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
      
      // Set error HTML content
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Setting error HTML content`);
      panel.webview.html = this.generateErrorHTML(`Failed to load trace tree data: ${error}`);
      
      // Send error to webview
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Sending error message to webview`);
      panel.webview.postMessage({
        type: 'error',
        payload: {
          message: `Failed to load trace tree data: ${error}`
        }
      });
    }
  }

  /**
   * Disposes the diagram manager
   */
  dispose(): void {
    // Close all active diagrams
    for (const [, panel] of this.activeDiagrams) {
      panel.dispose();
    }
    this.activeDiagrams.clear();
    
    // Dispose components
    this.renderer.dispose();
    this.updateQueue.dispose();
    
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM MANAGER')} - Disposed`);
  }
} 