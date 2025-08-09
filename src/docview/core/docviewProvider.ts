import * as vscode from 'vscode';
import * as path from 'path';
import { SylangLogger } from '../../core/logger';
import { SylangSymbolManager, SylangSymbol } from '../../core/symbolManager';
import { DocViewData, DocViewItem, DocViewFileType, DocViewMessage, ItemSelectionMessage, OpenSourceMessage } from '../types/docviewTypes';
import { getVersionedLogger } from '../../core/version';

/**
 * Provides docview functionality for Sylang files
 * Creates ALM-style documentation views for .req, .tst, .fml, .fun files
 */
export class SylangDocViewProvider {
    public static readonly viewType = 'sylang.docview';
    
    private _panels: Map<string, vscode.WebviewPanel> = new Map();
    private logger: SylangLogger;
    private symbolManager: SylangSymbolManager;
    private currentData?: DocViewData;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        logger: SylangLogger,
        symbolManager: SylangSymbolManager
    ) {
        this.logger = logger;
        this.symbolManager = symbolManager;
    }

    /**
     * Create and configure a webview panel
     */
    private createWebviewPanel(fileUri: vscode.Uri): vscode.WebviewPanel {
        const fileName = path.basename(fileUri.fsPath);
        const panel = vscode.window.createWebviewPanel(
            SylangDocViewProvider.viewType,
            `DocView: ${fileName}`,
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this._extensionUri]
            }
        );

        panel.webview.html = this._getHtmlForWebview(panel.webview);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage((message: DocViewMessage) => {
            this.handleWebviewMessage(message, panel);
        });

        // Clean up when panel is disposed
        panel.onDidDispose(() => {
            this._panels.delete(fileUri.fsPath);
        });

        this.logger.info(`${getVersionedLogger('DOCVIEW')} - DocView panel created for ${fileName}`);
        return panel;
    }

    /**
     * Show docview for a specific file
     */
    public async showDocView(fileUri: vscode.Uri): Promise<void> {
        const fileExtension = path.extname(fileUri.fsPath) as DocViewFileType;
        
        if (!this.isDocViewSupported(fileExtension)) {
            vscode.window.showErrorMessage(`DocView not supported for ${fileExtension} files`);
            return;
        }

        try {
            const docViewData = await this.generateDocViewData(fileUri, fileExtension);
            this.currentData = docViewData;
            
            // Check if panel already exists for this file
            let panel = this._panels.get(fileUri.fsPath);
            
            if (panel) {
                // Panel exists, update data and show it
                panel.webview.postMessage({
                    type: 'updateData',
                    data: docViewData
                });
                panel.reveal(vscode.ViewColumn.Active);
            } else {
                // Create new panel
                panel = this.createWebviewPanel(fileUri);
                this._panels.set(fileUri.fsPath, panel);
                
                // Send data once panel is ready
                setTimeout(() => {
                    panel?.webview.postMessage({
                        type: 'updateData',
                        data: docViewData
                    });
                }, 100);
            }

            this.logger.info(`${getVersionedLogger('DOCVIEW')} - Showing docview for ${fileUri.fsPath} with ${docViewData.items.length} items`);
        } catch (error) {
            this.logger.error(`${getVersionedLogger('DOCVIEW')} - Failed to generate docview: ${error}`);
            vscode.window.showErrorMessage(`Failed to generate docview: ${error}`);
        }
    }

    /**
     * Check if file type is supported for docview
     */
    private isDocViewSupported(fileExtension: string): fileExtension is DocViewFileType {
        return ['.req', '.tst', '.fml', '.fun'].includes(fileExtension);
    }

    /**
     * Generate docview data from symbols
     */
    private async generateDocViewData(fileUri: vscode.Uri, fileType: DocViewFileType): Promise<DocViewData> {
        const documentSymbols = this.symbolManager.getDocumentSymbols(fileUri);
        
        if (!documentSymbols) {
            throw new Error(`No symbols found for file: ${fileUri.fsPath}`);
        }

        const items: DocViewItem[] = [];
        const displayNames: Record<DocViewFileType, string> = {
            '.req': 'Requirements',
            '.tst': 'Test Cases',
            '.fml': 'Features',
            '.fun': 'Functions'
        };

        // Process definition symbols
        for (const symbol of documentSymbols.definitionSymbols) {
            const docViewItem = this.symbolToDocViewItem(symbol, fileType, fileUri);
            if (docViewItem) {
                items.push(docViewItem);
            }
        }

        // Extract header symbol information
        let headerSymbol;
        if (documentSymbols.headerSymbol) {
            const header = documentSymbols.headerSymbol;
            headerSymbol = {
                identifier: header.name,
                name: header.properties.get('name')?.[0],
                description: header.properties.get('description')?.[0],
                properties: Object.fromEntries(header.properties)
            };
        }

        return {
            fileType,
            displayName: displayNames[fileType],
            items,
            headerSymbol,
            sourceFile: fileUri.fsPath,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Convert symbol to docview item
     */
    private symbolToDocViewItem(symbol: SylangSymbol, fileType: DocViewFileType, fileUri: vscode.Uri): DocViewItem | null {
        // Filter based on file type and symbol kind
        const relevantKinds: Record<DocViewFileType, string[]> = {
            '.req': ['requirement'],
            '.tst': ['testcase'],
            '.fml': ['feature'],
            '.fun': ['function']
        };

        if (!relevantKinds[fileType].includes(symbol.kind)) {
            return null;
        }

        // Extract properties
        const name = symbol.properties.get('name')?.[0] || symbol.name;
        const description = symbol.properties.get('description')?.[0] || '';
        const steps = symbol.properties.get('steps')?.[0] || '';

        // Build children array
        const children = symbol.children.map(child => child.name);

        return {
            identifier: symbol.name,
            name,
            description,
            fileType,
            fileUri,
            line: symbol.line,
            properties: symbol.properties,
            steps: fileType === '.tst' ? steps : undefined,
            kind: symbol.kind,
            parentId: symbol.parentSymbol,
            children
        };
    }

    /**
     * Handle messages from webview
     */
    private async handleWebviewMessage(message: DocViewMessage, _panel: vscode.WebviewPanel): Promise<void> {
        switch (message.type) {
            case 'selectItem':
                await this.handleItemSelection(message as ItemSelectionMessage);
                break;
            case 'openSource':
                await this.handleOpenSource(message as OpenSourceMessage);
                break;
            case 'refresh':
                if (this.currentData) {
                    const fileUri = vscode.Uri.file(this.currentData.sourceFile);
                    await this.showDocView(fileUri);
                }
                break;
        }
    }

    /**
     * Handle item selection from webview
     */
    private async handleItemSelection(message: ItemSelectionMessage): Promise<void> {
        if (!this.currentData) return;

        const item = this.currentData.items.find(item => item.identifier === message.data.identifier);
        if (!item) return;

        // Send item details back to webview for right panel  
        const activePanel = Array.from(this._panels.values()).find(p => p.visible);
        activePanel?.webview.postMessage({
            type: 'showItemDetails',
            data: {
                item: {
                    identifier: item.identifier,
                    name: item.name,
                    description: item.description,
                    kind: item.kind,
                    properties: Object.fromEntries(item.properties),
                    steps: item.steps,
                    children: item.children,
                    parentId: item.parentId,
                    fileUri: item.fileUri.fsPath,
                    line: item.line
                }
            }
        });

        this.logger.debug(`${getVersionedLogger('DOCVIEW')} - Selected item: ${item.identifier}`);
    }

    /**
     * Handle opening source file
     */
    private async handleOpenSource(message: OpenSourceMessage): Promise<void> {
        try {
            const uri = vscode.Uri.file(message.data.fileUri);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            
            // Navigate to specific line
            const line = Math.max(0, message.data.line);
            const position = new vscode.Position(line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));

            this.logger.debug(`${getVersionedLogger('DOCVIEW')} - Opened source at ${uri.fsPath}:${line}`);
        } catch (error) {
            this.logger.error(`${getVersionedLogger('DOCVIEW')} - Failed to open source: ${error}`);
            vscode.window.showErrorMessage(`Failed to open source file: ${error}`);
        }
    }

    /**
     * Generate HTML for webview
     */
    private _getHtmlForWebview(_webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sylang DocView</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            padding: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-panel-background);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .title {
            font-weight: bold;
            font-size: 14px;
        }
        
        .refresh-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .refresh-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .header-info {
            padding: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
        }
        
        .header-title {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }
        
        .header-description {
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
            margin-bottom: 8px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .header-properties {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        .header-prop {
            display: flex;
            gap: 5px;
        }
        
        .header-prop-label {
            font-weight: bold;
        }
        
        .content {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        
        .left-panel {
            flex: 1;
            border-right: 1px solid var(--vscode-panel-border);
            overflow-y: auto;
        }
        
        .right-panel {
            width: 300px;
            padding: 10px;
            overflow-y: auto;
            overflow-x: hidden;
            background-color: var(--vscode-sidebar-background);
            word-wrap: break-word;
            text-align: left;
        }
        
        .table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .table th,
        .table td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
        }
        
        .table th {
            background-color: var(--vscode-panel-background);
            font-weight: bold;
            position: sticky;
            top: 0;
        }
        
        .table tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .table tr.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }
        
        .table tr {
            cursor: pointer;
        }
        
        .identifier {
            font-family: var(--vscode-editor-font-family);
            font-weight: bold;
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
        }
        
        .description {
            max-width: 400px;
            white-space: normal;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .steps {
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .empty-state {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 40px 20px;
        }
        
        .property-group {
            margin-bottom: 15px;
            text-align: left;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .property-label {
            font-weight: bold;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            text-transform: uppercase;
            margin-bottom: 5px;
            text-align: left;
        }
        
        .property-value {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            padding: 8px;
            border-radius: 3px;
            font-size: 12px;
            word-wrap: break-word;
            white-space: pre-wrap;
            overflow-wrap: break-word;
            max-width: 100%;
            text-align: left;
        }
        
        .steps-property {
            white-space: pre-line;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            text-align: left;
        }
        
        .children-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .children-list li {
            padding: 2px 0;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-align: left;
        }
        
        /* Resizable columns */
        th.th-resizable { position: relative; }
        .col-resizer {
            position: absolute;
            right: 0;
            top: 0;
            width: 6px;
            height: 100%;
            cursor: col-resize;
            user-select: none;
        }
        .col-resizer:hover { background: var(--vscode-panel-border); opacity: 0.5; }
        
        .open-source-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 6px 12px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 11px;
            margin-top: 10px;
        }
        
        .open-source-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title" id="docTitle">Sylang DocView</div>
        <button class="refresh-btn" id="refreshBtn">↻ Refresh</button>
    </div>
    
    <div id="headerInfo" class="header-info" style="display: none;">
        <div class="header-title" id="headerTitle"></div>
        <div class="header-description" id="headerDescription"></div>
        <div class="header-properties" id="headerProperties"></div>
    </div>
    
    <div class="content">
        <div class="left-panel">
            <div id="tableContainer" class="empty-state">
                Select a Sylang file (.req, .tst, .fml, .fun) to view documentation
            </div>
        </div>
        
        <div class="right-panel">
            <div id="detailsPanel" class="empty-state">
                Select an item to view details
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentData = null;
        let selectedRow = null;

        // Handle refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'refresh' });
        });

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updateData':
                    updateTableData(message.data);
                    break;
                case 'showItemDetails':
                    showItemDetails(message.data.item);
                    break;
            }
        });

        function updateTableData(data) {
            currentData = data;
            document.getElementById('docTitle').textContent = \`\${data.displayName} - \${data.items.length} items\`;
            
            // Update header information
            updateHeaderInfo(data);
            
            const tableContainer = document.getElementById('tableContainer');
            
            if (data.items.length === 0) {
                tableContainer.innerHTML = '<div class="empty-state">No items found in this file</div>';
                return;
            }

            // Create table
            const table = document.createElement('table');
            table.className = 'table';
            
            // Create header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = \`
                <th class="th-resizable" data-col="num">#<span class="col-resizer"></span></th>
                <th class="th-resizable" data-col="id">Identifier<span class="col-resizer"></span></th>
                <th class="th-resizable" data-col="name">Name<span class="col-resizer"></span></th>
                <th class="th-resizable" data-col="desc">Description<span class="col-resizer"></span></th>
            \`;
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // If .tst, append Steps header
            if (data.fileType === '.tst') {
                const th = document.createElement('th');
                th.className = 'th-resizable';
                th.dataset.col = 'steps';
                th.innerHTML = 'Steps<span class="col-resizer"></span>';
                headerRow.appendChild(th);
            }
            
            // Create body
            const tbody = document.createElement('tbody');
            data.items.forEach((item, index) => {
                const row = document.createElement('tr');
                row.dataset.identifier = item.identifier;
                row.innerHTML = \`
                    <td>\${index + 1}</td>
                    <td class="identifier">\${item.identifier}</td>
                    <td>\${item.name || ''}</td>
                    <td class="description">\${item.description || ''}</td>
                \`;
                
                // If .tst, add steps cell in table
                if (data.fileType === '.tst') {
                    const td = document.createElement('td');
                    td.className = 'steps';
                    td.textContent = item.steps || '';
                    row.appendChild(td);
                }
                
                row.addEventListener('click', () => {
                    if (selectedRow) {
                        selectedRow.classList.remove('selected');
                    }
                    row.classList.add('selected');
                    selectedRow = row;
                    
                    vscode.postMessage({
                        type: 'selectItem',
                        data: { identifier: item.identifier }
                    });
                });
                
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            
            tableContainer.innerHTML = '';
            tableContainer.appendChild(table);
            
            // Enable column resize
            (function makeColumnsResizable(table){
              const ths = table.querySelectorAll('th.th-resizable');
              ths.forEach(th => {
                const resizer = th.querySelector('.col-resizer');
                if (!resizer) return;
                let startX = 0, startWidth = 0;
                const onMouseDown = (e) => {
                  startX = e.pageX;
                  startWidth = th.offsetWidth;
                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                };
                const onMouseMove = (e) => {
                  const dx = e.pageX - startX;
                  const newWidth = Math.max(80, startWidth + dx);
                  th.style.width = newWidth + 'px';
                };
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                };
                resizer.addEventListener('mousedown', onMouseDown);
              });
            })(table);
        }

        function updateHeaderInfo(data) {
            const headerInfo = document.getElementById('headerInfo');
            const headerTitle = document.getElementById('headerTitle');
            const headerDescription = document.getElementById('headerDescription');
            const headerProperties = document.getElementById('headerProperties');

            if (data.headerSymbol) {
                const header = data.headerSymbol;
                headerTitle.textContent = \`\${header.identifier} - \${header.name || ''}\`;
                headerDescription.textContent = header.description || '';
                
                // Show header properties
                let propsHtml = '';
                if (header.properties) {
                    Object.entries(header.properties).forEach(([key, values]) => {
                        if (!['name', 'description'].includes(key) && values.length > 0) {
                            propsHtml += \`<div class="header-prop"><span class="header-prop-label">\${key}:</span><span>\${values.join(', ')}</span></div>\`;
                        }
                    });
                }
                headerProperties.innerHTML = propsHtml;
                headerInfo.style.display = 'block';
            } else {
                headerInfo.style.display = 'none';
            }
        }

        function showItemDetails(item) {
            const detailsPanel = document.getElementById('detailsPanel');
            
            let html = \`
                <div class="property-group">
                    <div class="property-label">Identifier</div>
                    <div class="property-value identifier">\${item.identifier}</div>
                </div>
            \`;
            
            // Show steps for test cases (only if not displayed in table)
            if (item.steps && (!currentData || currentData.fileType !== '.tst')) {
                html += \`
                    <div class="property-group">
                        <div class="property-label">Test Steps</div>
                        <div class="property-value steps-property">\${item.steps}</div>
                    </div>
                \`;
            }
            
            // Show other properties
            if (item.properties) {
                Object.entries(item.properties).forEach(([key, values]) => {
                    if (!['name', 'description', 'steps'].includes(key) && values.length > 0) {
                        html += \`
                            <div class="property-group">
                                <div class="property-label">\${key}</div>
                                <div class="property-value">\${values.join(', ')}</div>
                            </div>
                        \`;
                    }
                });
            }
            
            // Show children if any
            if (item.children && item.children.length > 0) {
                html += \`
                    <div class="property-group">
                        <div class="property-label">Children (\${item.children.length})</div>
                        <ul class="children-list">
                            \${item.children.map(child => \`<li>• \${child}</li>\`).join('')}
                        </ul>
                    </div>
                \`;
            }
            
            // Add open source button
            html += \`
                <button class="open-source-btn" onclick="openSource('\${item.fileUri}', \${item.line})">
                    📄 Open Source (Line \${item.line + 1})
                </button>
            \`;
            
            detailsPanel.innerHTML = html;
        }

        function openSource(fileUri, line) {
            vscode.postMessage({
                type: 'openSource',
                data: { fileUri, line }
            });
        }
    </script>
</body>
</html>`;
    }
}
