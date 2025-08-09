import * as vscode from 'vscode';
import * as path from 'path';
import { SylangLogger } from './logger';
import { SylangKeywordManager, KeywordType } from './keywords';
import { getVersionedLogger, SYLANG_VERSION } from './version';
import { SylangConfigManager, NodeConfigState } from './configManager';

export interface SylangSymbol {
    name: string;
    type: 'header' | 'definition';
    kind: string; // productline, featureset, feature, function, requirement, etc.
    fileUri: vscode.Uri;
    line: number;
    column: number;
    parentSymbol?: string;
    children: SylangSymbol[];
    properties: Map<string, string[]>;
    configValue?: number; // 0 = invisible, 1 = visible (legacy)
    indentLevel: number;
    
    // Config-aware state management
    configState?: NodeConfigState;
    level?: 'def' | 'hdef';
}

export interface ImportedSymbol {
    headerKeyword: string;
    headerIdentifier: string;
    fileUri: vscode.Uri;
    importedSymbols: SylangSymbol[];
}

export interface DocumentSymbols {
    uri: vscode.Uri;
    fileExtension: string;
    headerSymbol?: SylangSymbol;
    definitionSymbols: SylangSymbol[];
    importedSymbols: ImportedSymbol[];
    lastModified: number;
}

export class SylangSymbolManager {
    private documents: Map<string, DocumentSymbols> = new Map();
    private projectRoot: string | undefined;
    private logger: SylangLogger;
    private configManager: SylangConfigManager;
    
    // CRITICAL: Global identifier registry for project-wide uniqueness
    private globalIdentifiers: Map<string, {type: string, fileUri: vscode.Uri, line: number, column: number}> = new Map();
    
    // SMART RE-VALIDATION: Track 'use' dependencies for efficient validation
    private fileDependencies: Map<string, Set<string>> = new Map(); // file -> files it imports from
    private reverseDependencies: Map<string, Set<string>> = new Map(); // file -> files that import from it

    constructor(logger: SylangLogger, configManager?: SylangConfigManager) {
        this.logger = logger;
        this.configManager = configManager || new SylangConfigManager(logger);
        // Set reference to symbol manager for parent-child hierarchy lookup
        this.configManager.setSymbolManager(this);
        // Start project root discovery, which will trigger workspace initialization when complete
        this.findProjectRoot();
    }

    private async findProjectRoot(): Promise<void> {
        if (!vscode.workspace.workspaceFolders) {
            this.logger.warn('No workspace folders found');
            return;
        }

        for (const workspaceFolder of vscode.workspace.workspaceFolders) {
            const sylangrules = vscode.Uri.joinPath(workspaceFolder.uri, '.sylangrules');
            try {
                await vscode.workspace.fs.stat(sylangrules);
                this.projectRoot = workspaceFolder.uri.fsPath;
                this.logger.info(`Found Sylang project root: ${this.projectRoot}`);
                
                // Now that we have the project root, initialize the workspace
                await this.initializeWorkspace();
                return;
            } catch {
                // .sylangrules not found in this workspace folder
            }
        }
        
        // If we get here, no project root was found
        this.logger.warn('No Sylang project root found (.sylangrules file missing)');
    }

    private async initializeWorkspace(): Promise<void> {
        if (!this.projectRoot) {
            this.logger.warn('No Sylang project root found (.sylangrules file missing)');
            return;
        }

        // Find all Sylang files in the project
        const sylangFiles = await vscode.workspace.findFiles(
            '**/*.{ple,fml,vml,vcf,fun,req,tst,blk}',
            '**/node_modules/**'
        );

        this.logger.info(`🔍 ${getVersionedLogger('SYMBOL MANAGER')} - Found ${sylangFiles.length} Sylang files in project`);
        
        // Log all found files
        sylangFiles.forEach(file => {
            this.logger.info(`  📄 Found file: ${file.fsPath}`);
        });

        // Process all files to build initial symbol table
        for (const fileUri of sylangFiles) {
            await this.addDocument(fileUri);
        }

        this.logger.info(`🔍 ${getVersionedLogger('SYMBOL MANAGER')} - Symbol table initialization completed`);
        this.logger.info(`  📊 Total documents processed: ${this.documents.size}`);
        
        // Log all parsed documents and their symbols
        for (const [filePath, documentSymbols] of this.documents) {
            this.logger.info(`  📄 ${filePath}:`);
            if (documentSymbols.headerSymbol) {
                this.logger.info(`    📋 Header: ${documentSymbols.headerSymbol.name} (${documentSymbols.headerSymbol.kind})`);
            }
            this.logger.info(`    📝 Definitions: ${documentSymbols.definitionSymbols.length}`);
            this.logger.info(`    📥 Imports: ${documentSymbols.importedSymbols.length}`);
        }
    }

    async addDocument(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            await this.parseDocument(document);
            this.logger.debug(`Added document to symbol table: ${uri.fsPath}`);
        } catch (error) {
            this.logger.error(`Failed to add document ${uri.fsPath}: ${error}`);
        }
    }

    async updateDocument(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            await this.parseDocument(document);
            this.logger.debug(`Updated document in symbol table: ${uri.fsPath}`);
        } catch (error) {
            this.logger.error(`Failed to update document ${uri.fsPath}: ${error}`);
        }
    }

    updateDocumentContent(document: vscode.TextDocument): void {
        try {
            this.parseDocument(document);
            this.logger.debug(`Updated document content in symbol table: ${document.uri.fsPath}`);
        } catch (error) {
            this.logger.error(`Failed to update document content ${document.uri.fsPath}: ${error}`);
        }
    }

    removeDocument(uri: vscode.Uri): void {
        const key = uri.fsPath;
        if (this.documents.delete(key)) {
            this.logger.debug(`Removed document from symbol table: ${uri.fsPath}`);
        }
    }

    private async parseDocument(document: vscode.TextDocument): Promise<void> {
        const fileExtension = path.extname(document.fileName);
        this.logger.info(`🔍 [SYMBOL MANAGER v${SYLANG_VERSION}] Parsing document: ${document.fileName} (${fileExtension})`);
        
        const fileType = SylangKeywordManager.getFileTypeKeywords(fileExtension);
        
        if (!fileType) {
            this.logger.warn(`Unknown Sylang file type: ${fileExtension}`);
            return;
        }

        this.logger.info(`🔍 [SYMBOL MANAGER v${SYLANG_VERSION}] File type found: ${fileType.displayName} (${fileExtension})`);

        const documentSymbols: DocumentSymbols = {
            uri: document.uri,
            fileExtension,
            definitionSymbols: [],
            importedSymbols: [],
            lastModified: Date.now()
        };

        const lines = document.getText().split('\n');
        this.logger.info(`🔍 [SYMBOL MANAGER v${SYLANG_VERSION}] Processing ${lines.length} lines from ${document.fileName}`);
        let parentSymbolStack: SylangSymbol[] = [];

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const trimmedLine = line.trim();
            
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
                continue;
            }

            const indentLevel = this.getIndentLevel(line);
            const tokens = this.parseTokensWithQuotes(trimmedLine);
            const keyword = tokens[0];

            // Handle indentation-based parent-child relationships
            while (parentSymbolStack.length > 0 && indentLevel <= parentSymbolStack[parentSymbolStack.length - 1].indentLevel) {
                parentSymbolStack.pop();
            }

            if (keyword === 'use') {
                this.parseUseStatement(tokens, documentSymbols);
            } else if (keyword === 'hdef') {
                const headerSymbol = this.parseHeaderDefinition(tokens, document.uri, lineIndex, indentLevel);
                if (headerSymbol) {
                    documentSymbols.headerSymbol = headerSymbol;
                    parentSymbolStack = [headerSymbol];
                }
            } else if (keyword === 'def') {
                const defSymbol = this.parseDefinition(tokens, document.uri, lineIndex, indentLevel);
                if (defSymbol) {
                    const parentSymbol = parentSymbolStack[parentSymbolStack.length - 1];
                    if (parentSymbol) {
                        defSymbol.parentSymbol = parentSymbol.name;
                        parentSymbol.children.push(defSymbol);
                    }
                    documentSymbols.definitionSymbols.push(defSymbol);
                    parentSymbolStack.push(defSymbol);
                }
            } else if (this.isPropertyKeyword(fileExtension, keyword)) {
                // Handle multiline properties
                const { finalTokens, newLineIndex } = this.parseMultilineProperty(lines, lineIndex, tokens);
                this.parseProperty(finalTokens, parentSymbolStack[parentSymbolStack.length - 1]);
                lineIndex = newLineIndex; // Skip processed lines
            }
        }

        // Store the parsed document
        this.documents.set(document.uri.fsPath, documentSymbols);
        this.logger.debug(`Parsed ${fileExtension} file: ${documentSymbols.definitionSymbols.length} definitions found`);
    }

    private getIndentLevel(line: string): number {
        let indent = 0;
        for (const char of line) {
            if (char === ' ') {
                indent++;
            } else if (char === '\t') {
                indent += 2; // Tab counts as 2 spaces
            } else {
                break;
            }
        }
        return Math.floor(indent / 2); // 2 spaces = 1 level
    }

    private parseTokensWithQuotes(line: string): string[] {
        const tokens: string[] = [];
        let currentToken = '';
        let inQuotes = false;
        let i = 0;

        while (i < line.length) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes) {
                    // End of quoted string
                    tokens.push(currentToken);
                    currentToken = '';
                    inQuotes = false;
                } else {
                    // Start of quoted string - save any previous token
                    if (currentToken.trim()) {
                        tokens.push(currentToken.trim());
                        currentToken = '';
                    }
                    inQuotes = true;
                }
            } else if (inQuotes) {
                // Inside quotes - add everything including spaces
                currentToken += char;
            } else if (char === ' ' || char === '\t') {
                // Outside quotes - whitespace separates tokens
                if (currentToken.trim()) {
                    tokens.push(currentToken.trim());
                    currentToken = '';
                }
            } else {
                // Outside quotes - regular character
                currentToken += char;
            }
            i++;
        }

        // Add final token if any
        if (currentToken.trim()) {
            tokens.push(currentToken.trim());
        }

        return tokens;
    }

    private parseMultilineProperty(lines: string[], startLineIndex: number, initialTokens: string[]): { finalTokens: string[], newLineIndex: number } {
        const propertyName = initialTokens[0];
        let propertyValue = initialTokens.slice(1).join(' ');
        let currentLineIndex = startLineIndex;
        const startIndent = this.getIndentLevel(lines[startLineIndex]);

        // Check if the property value starts with a quote but doesn't end with one (multiline)
        if (propertyValue.startsWith('"') && !propertyValue.endsWith('"')) {
            // Remove the opening quote
            propertyValue = propertyValue.substring(1);
            
            // Look for continuation lines
            for (let i = startLineIndex + 1; i < lines.length; i++) {
                const nextLine = lines[i];
                const trimmedNextLine = nextLine.trim();
                
                // Skip empty lines
                if (!trimmedNextLine) {
                    propertyValue += '\n';
                    currentLineIndex = i;
                    continue;
                }
                
                // Check if this line is indented more than the property line (continuation)
                const nextIndent = this.getIndentLevel(nextLine);
                if (nextIndent > startIndent) {
                    // This is a continuation line
                    if (trimmedNextLine.endsWith('"')) {
                        // End of multiline property
                        propertyValue += '\n' + trimmedNextLine.substring(0, trimmedNextLine.length - 1);
                        currentLineIndex = i;
                        break;
                    } else {
                        // Continue multiline property
                        propertyValue += '\n' + trimmedNextLine;
                        currentLineIndex = i;
                    }
                } else {
                    // No more continuation lines
                    break;
                }
            }
        }

        return {
            finalTokens: [propertyName, propertyValue],
            newLineIndex: currentLineIndex
        };
    }

    private parseUseStatement(tokens: string[], documentSymbols: DocumentSymbols): void {
        if (tokens.length >= 3) {
            const headerKeyword = tokens[1];
            const identifiers = tokens.slice(2).join(' ').split(',').map(id => id.trim());
            
            for (const identifier of identifiers) {
                const importedSymbol: ImportedSymbol = {
                    headerKeyword,
                    headerIdentifier: identifier,
                    fileUri: documentSymbols.uri,
                    importedSymbols: []
                };
                documentSymbols.importedSymbols.push(importedSymbol);
                
                // SMART RE-VALIDATION: Track dependency for cross-file validation (Fix 2)
                this.addUseDependency(documentSymbols.uri.fsPath, identifier, headerKeyword);
            }
        }
    }

    private parseHeaderDefinition(tokens: string[], uri: vscode.Uri, line: number, indentLevel: number): SylangSymbol | undefined {
        if (tokens.length >= 3) {
            const kind = tokens[1]; // productline, featureset, etc.
            const name = tokens[2];
            
            // Create node config state for header (hdef level)
            const nodeId = `${uri.fsPath}:${name}`;
            const configState = this.configManager.createNodeState(nodeId);
            
            return {
                name,
                type: 'header',
                kind,
                fileUri: uri,
                line,
                column: 0,
                children: [],
                properties: new Map(),
                indentLevel,
                level: 'hdef',
                configState
            };
        }
        return undefined;
    }

    private parseDefinition(tokens: string[], uri: vscode.Uri, line: number, indentLevel: number): SylangSymbol | undefined {
        if (tokens.length >= 3) {
            const kind = tokens[1]; // feature, function, requirement, config, etc.
            const name = tokens[2];
            
            // Create node config state for definition (def level) - only for config-aware files
            const fileExtension = path.extname(uri.fsPath);
            const isConfigAwareFile = this.isConfigAwareFile(fileExtension);
            const nodeId = `${uri.fsPath}:${name}`;
            const configState = isConfigAwareFile ? this.configManager.createNodeState(nodeId) : undefined;
            
            const symbol: SylangSymbol = {
                name,
                type: 'definition',
                kind,
                fileUri: uri,
                line,
                column: 0,
                children: [],
                properties: new Map(),
                indentLevel,
                level: 'def',
                configState
            };

            // Special handling for config definitions (e.g., "def config c_FeatureName 1")
            if (kind === 'config' && tokens.length >= 4) {
                const configValue = parseInt(tokens[3]);
                if (!isNaN(configValue)) {
                    symbol.configValue = configValue;
                    // Update config manager with this config value
                    this.configManager.setConfigValue(name, configValue);
                    this.logger.debug(`Parsed config definition ${name} = ${configValue}`);
                }
            }
            
            // CRITICAL FIX: Parse optional flags that appear after symbol name
            // For lines like: "def feature UserAuthentication or"
            if (tokens.length >= 4 && kind !== 'config') {
                const optionalFlags = ['mandatory', 'optional', 'or', 'alternative', 'selected'];
                const flags: string[] = [];
                
                // Collect all flags from position 3 onwards
                for (let i = 3; i < tokens.length; i++) {
                    const token = tokens[i];
                    if (optionalFlags.includes(token)) {
                        flags.push(token);
                        this.logger.debug(`Captured optional flag '${token}' for symbol ${name}`);
                    }
                }
                
                // Store flags as properties so validateFeatureSiblings can find them
                if (flags.length > 0) {
                    for (const flag of flags) {
                        symbol.properties.set(flag, ['true']); // Store as property
                    }
                    this.logger.debug(`Stored ${flags.length} optional flags for symbol ${name}: ${flags.join(', ')}`);
                }
            }
            
            return symbol;
        }
        return undefined;
    }

    private parseProperty(tokens: string[], parentSymbol?: SylangSymbol): void {
        this.logger.info(`🔍 ${getVersionedLogger('SYMBOL MANAGER')} - parseProperty called with tokens: ${tokens.join(' ')}, parent: ${parentSymbol ? parentSymbol.name : 'NULL'}`);
        if (!parentSymbol || tokens.length < 2) return;

        const propertyName = tokens[0];
        const propertyValues = tokens.slice(1);

        // Handle when ref config properties (e.g., "when ref config c_FeatureName")
        if (propertyName === 'when' && propertyValues.length >= 3 && 
            propertyValues[0] === 'ref' && propertyValues[1] === 'config') {
            const configName = propertyValues[2];
            const configValue = this.resolveConfigValue(configName);
            if (configValue !== undefined) {
                parentSymbol.configValue = configValue;
                // Update config state if this is a config-aware symbol
                if (parentSymbol.configState) {
                    const nodeId = `${parentSymbol.fileUri.fsPath}:${parentSymbol.name}`;
                    this.configManager.updateNodeVisibility(nodeId, configName);
                }
                this.logger.debug(`Resolved 'when ref config ${configName}' = ${configValue} for symbol ${parentSymbol.name}`);
            }
        }

        // Handle ref config properties for visibility (e.g., "ref config c_FeatureName")
        if (propertyName === 'ref' && propertyValues.length >= 2 && propertyValues[0] === 'config') {
            const configName = propertyValues[1];
            const configValue = this.resolveConfigValue(configName);
            if (configValue !== undefined) {
                parentSymbol.configValue = configValue;
                // Update config state if this is a config-aware symbol
                if (parentSymbol.configState) {
                    const nodeId = `${parentSymbol.fileUri.fsPath}:${parentSymbol.name}`;
                    this.configManager.updateNodeVisibility(nodeId, configName);
                }
                this.logger.debug(`Resolved ref config ${configName} = ${configValue} for symbol ${parentSymbol.name}`);
            }
        }

        // Handle config property for visibility
        if (propertyName === 'config' && propertyValues.length > 0) {
            const configValue = parseInt(propertyValues[propertyValues.length - 1]);
            if (!isNaN(configValue)) {
                parentSymbol.configValue = configValue;
                // Update config state if this is a config-aware symbol
                if (parentSymbol.configState) {
                    const nodeId = `${parentSymbol.fileUri.fsPath}:${parentSymbol.name}`;
                    const configName = `direct_${parentSymbol.name}`; // For direct config values
                    this.configManager.setConfigValue(configName, configValue);
                    this.configManager.updateNodeVisibility(nodeId, configName);
                }
                this.logger.debug(`Set config value ${configValue} for symbol ${parentSymbol.name}`);
            }
        }

        // CRITICAL FIX: Handle optional flags in 'extends' relations only
        // Only 'extends' relations can have optional flags like 'extends ref feature FeatureName alternative selected'
        if (propertyName === 'extends') {
            this.logger.info(`🔍 ${getVersionedLogger('SYMBOL MANAGER')} - Processing extends relation: ${tokens.join(' ')}`);
            this.logger.info(`🔍 ${getVersionedLogger('SYMBOL MANAGER')} - Parent symbol: ${parentSymbol ? parentSymbol.name : 'NULL'}`);
            
            // Extract optional flags from the end of the relation line
            const optionalFlags = ['mandatory', 'optional', 'or', 'alternative', 'selected'];
            const flags: string[] = [];
            
            // Find flags in the property values and validate them
            for (const value of propertyValues) {
                if (optionalFlags.includes(value)) {
                    flags.push(value);
                    this.logger.info(`🔍 ${getVersionedLogger('SYMBOL MANAGER')} - Captured extends relation flag '${value}' for feature extension`);
                } else {
                    // Check if this looks like a typo of a valid flag
                    const potentialTypo = this.detectFlagTypo(value, optionalFlags);
                    if (potentialTypo) {
                        this.logger.error(`🔍 ${getVersionedLogger('SYMBOL MANAGER')} - Invalid flag '${value}' detected - did you mean '${potentialTypo}'?`);
                        // Note: We could add this to validation errors here if we had access to the validation engine
                    }
                }
            }
            
            // Store flags as properties on the parent symbol for validation
            if (flags.length > 0) {
                for (const flag of flags) {
                    parentSymbol.properties.set(flag, ['true']);
                }
                this.logger.info(`🔍 ${getVersionedLogger('SYMBOL MANAGER')} - Stored ${flags.length} extends relation flags for symbol ${parentSymbol.name}: ${flags.join(', ')}`);
            } else {
                this.logger.info(`🔍 ${getVersionedLogger('SYMBOL MANAGER')} - No flags found in property values: ${propertyValues.join(', ')}`);
            }
            
            // For 'extends ref feature' lines, create a virtual feature symbol for sibling validation
            if (propertyName === 'extends' && propertyValues.length >= 3 && 
                propertyValues[0] === 'ref' && propertyValues[1] === 'feature') {
                
                const featureName = propertyValues[2];
                
                // CRITICAL FIX: Use the actual parent symbol based on indentation, not just the header
                // This creates proper parent-child hierarchies for VML validation
                const actualParent = this.findActualParentSymbol(parentSymbol, parentSymbol.fileUri.fsPath);
                
                const virtualSymbol: SylangSymbol = {
                    name: featureName,
                    type: 'definition',
                    kind: 'feature',
                    fileUri: parentSymbol.fileUri,
                    line: parentSymbol.line,
                    column: 0,
                    children: [],
                    properties: new Map(),
                    indentLevel: parentSymbol.indentLevel,  // Same level as the extends line
                    parentSymbol: actualParent ? actualParent.name : undefined
                };
                
                // Store flags as properties for validation
                for (const flag of flags) {
                    virtualSymbol.properties.set(flag, ['true']);
                }
                
                // Add to actual parent's children (not header)
                if (actualParent) {
                    actualParent.children.push(virtualSymbol);
                }
                
                // Find the document symbols and add this virtual symbol
                const documentSymbols = this.documents.get(parentSymbol.fileUri.fsPath);
                if (documentSymbols) {
                    documentSymbols.definitionSymbols.push(virtualSymbol);
                }
                
                this.logger.info(`🔍 ${getVersionedLogger('SYMBOL MANAGER')} - Created virtual feature symbol '${featureName}' with parent '${actualParent?.name || 'header'}' and flags [${flags.join(', ')}] for VML validation`);
            }
        }

        // Store property values
        const existingValues = parentSymbol.properties.get(propertyName) || [];
        existingValues.push(...propertyValues);
        parentSymbol.properties.set(propertyName, existingValues);
    }

    private isPropertyKeyword(fileExtension: string, keyword: string): boolean {
        const keywordType = SylangKeywordManager.getKeywordType(fileExtension, keyword);
        return keywordType === KeywordType.PROPERTY || 
               keywordType === KeywordType.ENUM || 
               keywordType === KeywordType.RELATION;  // Include relations like 'when ref config'
    }

    // Public API for symbol resolution
    resolveSymbol(identifier: string, fileUri: vscode.Uri): SylangSymbol | undefined {
        const documentSymbols = this.documents.get(fileUri.fsPath);
        if (!documentSymbols) {
            this.logger.debug(`SYMBOL RESOLVE: No document symbols found for ${fileUri.fsPath}`);
            return undefined;
        }

        this.logger.debug(`SYMBOL RESOLVE: Looking for '${identifier}' in ${fileUri.fsPath}`);

        // First check if it's a local symbol (defined in the same file)
        if (documentSymbols.headerSymbol?.name === identifier) {
            this.logger.debug(`  Found as local header symbol: ${identifier}`);
            return documentSymbols.headerSymbol;
        }
        
        for (const symbol of documentSymbols.definitionSymbols) {
            if (symbol.name === identifier) {
                this.logger.debug(`  Found as local definition symbol: ${identifier}`);
                return symbol;
            }
        }

        this.logger.debug(`  Not found locally. Checking ${documentSymbols.importedSymbols.length} imported symbols...`);

        // Check imported symbols (external symbols are only visible through use statements)
        for (const importedSymbol of documentSymbols.importedSymbols) {
            this.logger.debug(`  Checking import: ${importedSymbol.headerKeyword} ${importedSymbol.headerIdentifier}`);
            const resolvedSymbols = this.getSymbolsFromImport(importedSymbol);
            this.logger.debug(`    Found ${resolvedSymbols.length} symbols from this import`);
            
            const found = resolvedSymbols.find(symbol => symbol.name === identifier && this.isSymbolVisible(symbol));
            if (found) {
                this.logger.debug(`  ✅ Found '${identifier}' through import: ${importedSymbol.headerKeyword} ${importedSymbol.headerIdentifier}`);
                return found;
            }
        }

        this.logger.debug(`  ❌ Symbol '${identifier}' not found through any imports`);
        // If not found locally or through imports, it's not visible
        return undefined;
    }

    private getSymbolsFromImport(importedSymbol: ImportedSymbol): SylangSymbol[] {
        this.logger.debug(`    GET_SYMBOLS_FROM_IMPORT: Looking for ${importedSymbol.headerKeyword} ${importedSymbol.headerIdentifier}`);
        
        // Find the document containing the header symbol
        for (const [filePath, documentSymbols] of this.documents) {
            this.logger.debug(`      Checking file: ${filePath}`);
            this.logger.debug(`        Header symbol: ${documentSymbols.headerSymbol?.name} (${documentSymbols.headerSymbol?.kind})`);
            
            if (documentSymbols.headerSymbol?.name === importedSymbol.headerIdentifier &&
                documentSymbols.headerSymbol?.kind === importedSymbol.headerKeyword) {
                
                this.logger.debug(`      ✅ Found matching document for import: ${filePath}`);
                const allSymbols = [documentSymbols.headerSymbol];
                allSymbols.push(...documentSymbols.definitionSymbols);
                this.logger.debug(`      Returning ${allSymbols.length} symbols from this document`);
                return allSymbols;
            }
        }
        
        this.logger.debug(`      ❌ No matching document found for ${importedSymbol.headerKeyword} ${importedSymbol.headerIdentifier}`);
        return [];
    }

    private isSymbolVisible(symbol: SylangSymbol): boolean {
        // Config definitions themselves are always visible (they define the values)
        if (symbol.kind === 'config') {
            return true;
        }
        
        // Check if entire file is disabled (hdef with disabled config)
        const documentSymbols = this.documents.get(symbol.fileUri.fsPath);
        if (documentSymbols?.headerSymbol && documentSymbols.headerSymbol !== symbol) {
            // If header uses disabled config, ALL symbols in file are invisible
            if (this.symbolUsesDisabledConfig(documentSymbols.headerSymbol)) {
                this.logger.debug(`Symbol '${symbol.name}' is invisible because file header '${documentSymbols.headerSymbol.name}' uses disabled config`);
                return false;
            }
        }
        
        // Symbol is invisible if it uses a config with value 0
        if (this.symbolUsesDisabledConfig(symbol)) {
            this.logger.debug(`Symbol '${symbol.name}' is invisible because it uses disabled config`);
            return false;
        }
        
        // Check parent symbol visibility recursively
        if (symbol.parentSymbol) {
            const parentDoc = this.documents.get(symbol.fileUri.fsPath);
            if (parentDoc) {
                const parent = this.findSymbolByName(parentDoc, symbol.parentSymbol);
                if (parent && !this.isSymbolVisible(parent)) {
                    this.logger.debug(`Symbol '${symbol.name}' is invisible because parent '${symbol.parentSymbol}' is invisible`);
                    return false;
                }
            }
        }
        
        return true;
    }

    /**
     * Check if a symbol uses a config with value 0
     */
    private symbolUsesDisabledConfig(symbol: SylangSymbol): boolean {
        // Look through all properties to find config statements
        for (const [propertyName, propertyValues] of symbol.properties.entries()) {
            // Check for "when ref config" pattern
            if (propertyName === 'when' && propertyValues.length >= 3 && 
                propertyValues[0] === 'ref' && propertyValues[1] === 'config') {
                const configName = propertyValues[2];
                const configValue = this.resolveConfigValue(configName);
                if (configValue === 0) {
                    return true; // This symbol uses a disabled config
                }
            }
            // Check for legacy "ref config" pattern  
            else if (propertyName === 'ref' && propertyValues.length >= 2 && propertyValues[0] === 'config') {
                const configName = propertyValues[1];
                const configValue = this.resolveConfigValue(configName);
                if (configValue === 0) {
                    return true; // This symbol uses a disabled config
                }
            }
        }
        
        return false;
    }

    private findSymbolByName(documentSymbols: DocumentSymbols, name: string): SylangSymbol | undefined {
        if (documentSymbols.headerSymbol?.name === name) {
            return documentSymbols.headerSymbol;
        }
        return documentSymbols.definitionSymbols.find(symbol => symbol.name === name);
    }

    getAllSymbols(): SylangSymbol[] {
        const allSymbols: SylangSymbol[] = [];
        for (const [_, documentSymbols] of this.documents) {
            if (documentSymbols.headerSymbol) {
                allSymbols.push(documentSymbols.headerSymbol);
            }
            allSymbols.push(...documentSymbols.definitionSymbols);
        }
        return allSymbols.filter(symbol => this.isSymbolVisible(symbol));
    }

    /**
     * Get all symbols without visibility filtering (for checking if disabled symbols exist)
     */
    getAllSymbolsRaw(): SylangSymbol[] {
        const allSymbols: SylangSymbol[] = [];
        for (const [_, documentSymbols] of this.documents) {
            if (documentSymbols.headerSymbol) {
                allSymbols.push(documentSymbols.headerSymbol);
            }
            allSymbols.push(...documentSymbols.definitionSymbols);
        }
        return allSymbols;
    }

    /**
     * Check if a symbol exists but is disabled by configuration
     */
    isSymbolDisabledByConfig(symbolName: string): boolean {
        const allSymbols = this.getAllSymbolsRaw();
        const symbol = allSymbols.find(s => s.name === symbolName);
        
        if (!symbol) {
            return false; // Symbol doesn't exist at all
        }
        
        // Symbol exists - check if it's disabled
        return !this.isSymbolVisible(symbol);
    }

    getDocumentSymbols(uri: vscode.Uri): DocumentSymbols | undefined {
        return this.documents.get(uri.fsPath);
    }

    hasProjectRoot(): boolean {
        return this.projectRoot !== undefined;
    }

    getProjectRoot(): string | undefined {
        return this.projectRoot;
    }

    private resolveConfigValue(configName: string): number | undefined {
        // Look for config definition in all files
        for (const [_, documentSymbols] of this.documents) {
            // Check if this document has the config definition
            for (const symbol of documentSymbols.definitionSymbols) {
                if (symbol.kind === 'config' && symbol.name === configName) {
                    // Return the config value directly from the symbol
                    this.logger.debug(`Found config ${configName} with value ${symbol.configValue}`);
                    return symbol.configValue;
                }
            }
        }
        
        this.logger.debug(`Config ${configName} not found in any document`);
        return undefined;
    }

    /**
     * Detects if a word is likely a typo of a valid optional flag
     * Uses simple string similarity to suggest corrections
     */
    private detectFlagTypo(word: string, validFlags: string[]): string | null {
        // Skip obvious non-flags (short words, numbers, etc.)
        if (word.length < 3 || /^\d+$/.test(word) || word.startsWith('"')) {
            return null;
        }

        let bestMatch: string | null = null;
        let bestScore = 0;

        for (const validFlag of validFlags) {
            const similarity = this.calculateStringSimilarity(word, validFlag);
            
            // Consider it a potential typo if similarity is > 60% and word length is similar
            if (similarity > 0.6 && Math.abs(word.length - validFlag.length) <= 2) {
                if (similarity > bestScore) {
                    bestScore = similarity;
                    bestMatch = validFlag;
                }
            }
        }

        return bestMatch;
    }

    /**
     * Find the actual parent symbol for a virtual feature based on VML hierarchy
     * For now, returns the header as parent to keep things simple
     */
    private findActualParentSymbol(currentParent: SylangSymbol, filePath: string): SylangSymbol | undefined {
        // For VML files, we'll use the header as parent for now
        // This can be enhanced later to detect hierarchical relationships
        const documentSymbols = this.documents.get(filePath);
        if (documentSymbols && documentSymbols.headerSymbol) {
            return documentSymbols.headerSymbol;
        }
        return currentParent;
    }

    /**
     * Calculates string similarity using simple character overlap
     * Returns a value between 0 and 1 (1 = identical)
     */
    private calculateStringSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;

        let matches = 0;
        for (let i = 0; i < shorter.length; i++) {
            if (longer.includes(shorter[i])) {
                matches++;
            }
        }

        return matches / longer.length;
    }

    reloadAllSymbols(): void {
        this.logger.info(`🔧 ${getVersionedLogger('SYMBOL MANAGER')} - Reloading all symbols`);
        this.documents.clear();
        
        // Reload all open documents
        vscode.workspace.textDocuments.forEach(document => {
            const fileExtension = path.extname(document.fileName);
            if (fileExtension.match(/^\.(ple|blk|fun|req|tst|fml|vml|vcf)$/)) {
                this.updateDocumentContent(document);
            }
        });
    }

    /**
     * Check if a file type is config-aware (exempt files: .ple, .fml, .vml, .vcf)
     */
    private isConfigAwareFile(fileExtension: string): boolean {
        const exemptFiles = ['.ple', '.fml', '.vml', '.vcf'];
        return !exemptFiles.includes(fileExtension);
    }

    /**
     * Get config manager instance
     */
    getConfigManager(): SylangConfigManager {
        return this.configManager;
    }

    /**
     * Update all symbols' config states when config values change
     */
    refreshConfigStates(): void {
        this.logger.info(`🔧 ${getVersionedLogger('SYMBOL MANAGER')} - Refreshing config states for all symbols`);
        
        for (const [_, documentSymbols] of this.documents) {
            // Update header symbol if it's config-aware
            if (documentSymbols.headerSymbol?.configState) {
                const nodeId = `${documentSymbols.headerSymbol.fileUri.fsPath}:${documentSymbols.headerSymbol.name}`;
                const configRef = documentSymbols.headerSymbol.configState.configReference;
                if (configRef) {
                    this.configManager.updateNodeVisibility(nodeId, configRef);
                }
            }
            
            // Update definition symbols
            for (const symbol of documentSymbols.definitionSymbols) {
                if (symbol.configState) {
                    const nodeId = `${symbol.fileUri.fsPath}:${symbol.name}`;
                    const configRef = symbol.configState.configReference;
                    if (configRef) {
                        this.configManager.updateNodeVisibility(nodeId, configRef);
                    }
                }
            }
        }
    }

    // CRITICAL: Global identifier registry methods
    getGlobalIdentifierRegistry(): Map<string, {type: string, fileUri: vscode.Uri, line: number, column: number}> {
        return this.globalIdentifiers;
    }

    addGlobalIdentifier(identifier: string, type: string, fileUri: vscode.Uri, line: number, column: number): boolean {
        if (this.globalIdentifiers.has(identifier)) {
            const existing = this.globalIdentifiers.get(identifier)!;
            this.logger.error(`🚨 GLOBAL IDENTIFIER COLLISION: '${identifier}' already defined in ${existing.fileUri.fsPath}:${existing.line + 1}`);
            return false; // Collision detected
        }
        
        this.globalIdentifiers.set(identifier, { type, fileUri, line, column });
        this.logger.debug(`✅ Global identifier registered: '${identifier}' (${type}) in ${fileUri.fsPath}:${line + 1}`);
        return true; // Successfully added
    }

    removeGlobalIdentifiersForFile(fileUri: vscode.Uri): void {
        const filePath = fileUri.fsPath;
        const toRemove: string[] = [];
        
        for (const [identifier, info] of this.globalIdentifiers.entries()) {
            if (info.fileUri.fsPath === filePath) {
                toRemove.push(identifier);
            }
        }
        
        toRemove.forEach(identifier => {
            this.globalIdentifiers.delete(identifier);
            this.logger.debug(`🗑️ Removed global identifier: '${identifier}' from ${filePath}`);
        });
        
        this.logger.info(`🔧 Removed ${toRemove.length} global identifiers from ${filePath}`);
    }

    clearGlobalIdentifiers(): void {
        this.globalIdentifiers.clear();
        this.logger.info(`🔧 Cleared all global identifiers`);
    }

    // SMART RE-VALIDATION: Dependency tracking methods (Fix 2)
    private addUseDependency(importerFile: string, identifier: string, headerKeyword: string): void {
        // Find the file that defines this identifier
        const definingFile = this.findDefiningFile(identifier, headerKeyword);
        if (definingFile && definingFile !== importerFile) {
            // Track that importerFile depends on definingFile
            if (!this.fileDependencies.has(importerFile)) {
                this.fileDependencies.set(importerFile, new Set());
            }
            this.fileDependencies.get(importerFile)!.add(definingFile);
            
            // Track reverse dependency
            if (!this.reverseDependencies.has(definingFile)) {
                this.reverseDependencies.set(definingFile, new Set());
            }
            this.reverseDependencies.get(definingFile)!.add(importerFile);
            
            this.logger.debug(`📎 Dependency tracked: ${importerFile} → ${definingFile} (${identifier})`);
        }
    }

    private findDefiningFile(identifier: string, headerKeyword: string): string | undefined {
        const registry = this.getGlobalIdentifierRegistry();
        const entry = registry.get(identifier);
        
        if (entry && entry.type.includes(headerKeyword)) {
            return entry.fileUri.fsPath;
        }
        return undefined;
    }

    getFilesToRevalidate(changedFile: string): Set<string> {
        const filesToRevalidate = new Set<string>();
        filesToRevalidate.add(changedFile); // Always include the changed file itself
        
        // Add files that import from the changed file
        const dependentFiles = this.reverseDependencies.get(changedFile);
        if (dependentFiles) {
            dependentFiles.forEach(file => filesToRevalidate.add(file));
            this.logger.debug(`🔄 Smart revalidation: ${changedFile} → affects ${dependentFiles.size} files`);
        }
        
        return filesToRevalidate;
    }

    removeDependenciesForFile(fileUri: vscode.Uri): void {
        const filePath = fileUri.fsPath;
        
        // Remove from fileDependencies
        this.fileDependencies.delete(filePath);
        
        // Remove from reverseDependencies
        for (const [definingFile, dependentFiles] of this.reverseDependencies.entries()) {
            dependentFiles.delete(filePath);
            if (dependentFiles.size === 0) {
                this.reverseDependencies.delete(definingFile);
            }
        }
        
        this.logger.debug(`🗑️ Removed dependencies for ${filePath}`);
    }

    dispose(): void {
        this.documents.clear();
        this.globalIdentifiers.clear();
        this.fileDependencies.clear();
        this.reverseDependencies.clear();
        this.logger.debug('Symbol manager disposed');
    }
} 