import * as vscode from 'vscode';
import * as path from 'path';
import { SylangSymbolManager, SylangSymbol } from './symbolManager';
import { SylangLogger } from './logger';
import { SylangKeywordManager, KeywordType, SYLANG_ENUMS } from './keywords';
import { SylangImportValidator } from './importValidator';
import { SylangRelationshipValidator } from './relationshipValidator';
import { getVersionedMessage, getVersionedSource, getVersionedLogger, SYLANG_VERSION } from './version';
import * as fs from 'fs'; // Added for folder file limitation

export interface ValidationError {
    message: string;
    severity: vscode.DiagnosticSeverity;
    line: number;
    column: number;
    length: number;
    code?: string;
}

export class SylangValidationEngine {
    private logger: SylangLogger;
    private symbolManager: SylangSymbolManager;
    private relationshipValidator: SylangRelationshipValidator;
    private importValidator: SylangImportValidator;
    constructor(logger: SylangLogger, symbolManager: SylangSymbolManager) {
        this.logger = logger;
        this.symbolManager = symbolManager;
        // Use config-aware relationship validator
        const configManager = symbolManager.getConfigManager();
        this.relationshipValidator = new SylangRelationshipValidator(logger, configManager);
        this.importValidator = new SylangImportValidator(symbolManager, logger);
        
        this.logger.info(`🔧 ${getVersionedLogger('VALIDATION ENGINE')} - Config-aware validation engine initialized`);
    }

    async validateDocument(uri: vscode.Uri): Promise<vscode.Diagnostic[]> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const errors = this.validateSylangDocument(document);
            
            return errors.map(error => {
                const range = new vscode.Range(
                    error.line,
                    error.column,
                    error.line,
                    error.column + error.length
                );
                
                const diagnostic = new vscode.Diagnostic(
                    range,
                    error.message,
                    error.severity
                );
                
                if (error.code) {
                    diagnostic.code = error.code;
                }
                
                diagnostic.source = getVersionedSource();
                return diagnostic;
            });
        } catch (error) {
            this.logger.error(`Validation failed for ${uri.fsPath}: ${error}`);
            return [];
        }
    }

    private validateSylangDocument(document: vscode.TextDocument): ValidationError[] {
        const errors: ValidationError[] = [];
        const fileExtension = path.extname(document.fileName);
        const fileUri = document.uri;
        const fileType = SylangKeywordManager.getFileTypeKeywords(fileExtension);
        
        this.logger.info(`🔍 ${getVersionedLogger('VALIDATION ENGINE')} - Starting validation for: ${document.fileName}`);
        this.logger.debug(`${getVersionedLogger('v')} - Validating document: ${document.fileName} (${fileExtension})`);
        
        if (!fileType) {
            this.logger.debug(`No file type found for extension: ${fileExtension}`);
            return errors;
        }
        
        // NEW: Validate folder-level file limitations
        this.validateFolderFileLimitations(fileUri, fileExtension, errors);
        
        // Get all lines and process line continuations
        const rawLines = document.getText().split('\n');
        const { processedLines, lineMapping } = this.processLineContinuations(rawLines);
        let hasHeader = false;
        const definedSymbols = new Set<string>();
        // Remove any existing identifiers from this file (for re-validation)
        this.symbolManager.removeGlobalIdentifiersForFile(fileUri);
        
        let currentDefinitionProperties = new Set<string>(); // Track properties in current definition
        let inDefinitionBlock = false; // Track if we're inside a definition block
        let definitionIndentLevel = -1; // Track the indent level of current definition
        let currentDefinitionName = ''; // Track the current definition name for config-aware validation
        
        for (let lineIndex = 0; lineIndex < processedLines.length; lineIndex++) {
            const line = processedLines[lineIndex];
            const originalLineIndex = lineMapping[lineIndex]; // Map back to original line for errors
            const trimmedLine = line.trim();
            
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
                continue;
            }

            const indentLevel = this.getIndentLevel(line);
            const tokens = this.tokenizeLine(trimmedLine);
            const keyword = tokens[0];
            
            // Reset property tracking if we exit current definition block
            if (inDefinitionBlock && indentLevel <= definitionIndentLevel && keyword !== 'def') {
                if (this.isPropertyKeyword(fileExtension, keyword)) {
                    // This is a property at same/lower level, likely in parent definition
                    currentDefinitionProperties.clear();
                    inDefinitionBlock = false;
                    definitionIndentLevel = -1;
                    currentDefinitionName = '';
                }
            }

            // Validate indentation
            if (indentLevel * 2 !== line.length - line.trimStart().length) {
                errors.push({
                    message: 'Invalid indentation. Use 2 spaces or 1 tab per indentation level.',
                    severity: vscode.DiagnosticSeverity.Error,
                    line: originalLineIndex,
                    column: 0,
                    length: line.length - line.trimStart().length,
                    code: 'SYLANG_INDENT'
                });
            }

            // Validate keywords (only the first token, not inside strings)
            if (!SylangKeywordManager.isKeywordAllowed(fileExtension, keyword)) {
                const fileTypeName = fileType?.displayName || `${fileExtension}`;
                errors.push({
                    message: `Keyword '${keyword}' is not allowed in ${fileTypeName} files.`,
                    severity: vscode.DiagnosticSeverity.Error,
                    line: originalLineIndex,
                    column: line.indexOf(keyword),
                    length: keyword.length,
                    code: 'SYLANG_INVALID_KEYWORD'
                });
                continue;
            }

            // Check for 'use' before 'hdef' (except .ple files)
            if (keyword === 'use' && fileExtension !== '.ple') {
                if (hasHeader) {
                    errors.push({
                        message: "'use' statements must appear before 'hdef' statement.",
                        severity: vscode.DiagnosticSeverity.Error,
                        line: originalLineIndex,
                        column: 0,
                        length: keyword.length,
                        code: 'SYLANG_USE_AFTER_HEADER'
                    });
                }
                this.validateUseStatement(tokens, errors, originalLineIndex, line);
            } else if (keyword === 'hdef') {
                if (hasHeader) {
                    errors.push({
                        message: 'Multiple header definitions found. Only one header definition is allowed per file.',
                        severity: vscode.DiagnosticSeverity.Error,
                        line: originalLineIndex,
                        column: 0,
                        length: keyword.length,
                        code: 'SYLANG_MULTIPLE_HEADERS'
                    });
                } else {
                    hasHeader = true;
                    // Reset property tracking for header definition
                    currentDefinitionProperties.clear();
                    inDefinitionBlock = true;
                    definitionIndentLevel = indentLevel;
                    
                    // Capture current header definition name for config-aware validation
                    if (tokens.length >= 3) {
                        currentDefinitionName = tokens[2]; // e.g., "hdef testset EPBSystemValidationTests"
                        this.logger.info(`🔗 ${getVersionedLogger('VALIDATION ENGINE')} - ✅ Entering header definition: ${currentDefinitionName}`);
                        
                        // SIMPLE FIX: If hdef is disabled by config, skip ALL validation for entire file
                        const fileExtension = document.fileName.substring(document.fileName.lastIndexOf('.'));
                        if (this.relationshipValidator.isConfigAwareFile(fileExtension)) {
                            const headerNodeId = this.relationshipValidator.generateNodeId(document.uri, currentDefinitionName);
                            const configManager = this.symbolManager.getConfigManager();
                            const headerState = configManager.getNodeState(headerNodeId);
                            
                            if (headerState && !headerState.isVisible) {
                                this.logger.info(`🔗 ${getVersionedLogger('VALIDATION ENGINE')} - 🚫 SKIPPING ENTIRE FILE validation: hdef '${currentDefinitionName}' is disabled by config (${headerState.configReference})`);
                                return errors; // Skip all validation for this file
                            }
                        }
                    }
                    
                    this.validateHeaderDefinition(tokens, errors, originalLineIndex, line, fileType, fileUri);
                }
            } else if (keyword === 'def') {
                // Check if def is at level 0 (same as hdef) - this is invalid
                if (indentLevel === 0) {
                    errors.push({
                        message: "'def' statements must be indented. Only 'hdef' can be at the top level (indent 0).",
                        severity: vscode.DiagnosticSeverity.Error,
                        line: originalLineIndex,
                        column: 0,
                        length: keyword.length,
                        code: 'SYLANG_DEF_AT_LEVEL_ZERO'
                    });
                }
                
                // Reset property tracking for new definition block
                currentDefinitionProperties.clear();
                inDefinitionBlock = true;
                definitionIndentLevel = indentLevel; // Store current indent level
                
                                    // Capture current definition name for config-aware validation
                    if (tokens.length >= 3) {
                        currentDefinitionName = tokens[2]; // e.g., "def testcase TEST_SAFE_001_1_FORCE_VERIFICATION"
                        this.logger.info(`🔗 ${getVersionedLogger('VALIDATION ENGINE')} - ✅ Entering def definition: ${currentDefinitionName}`);
                    }
                
                if (!hasHeader) {
                    errors.push({
                        message: "'def' statements must appear after 'hdef' statement.",
                        severity: vscode.DiagnosticSeverity.Error,
                        line: originalLineIndex,
                        column: 0,
                        length: keyword.length,
                        code: 'SYLANG_DEF_BEFORE_HEADER'
                    });
                }
                this.validateDefinition(tokens, errors, originalLineIndex, line, fileExtension, definedSymbols, fileUri);
            } else if (this.isPropertyKeyword(fileExtension, keyword)) {
                if (!hasHeader) {
                    errors.push({
                        message: `Property '${keyword}' must appear after 'hdef' statement.`,
                        severity: vscode.DiagnosticSeverity.Error,
                        line: originalLineIndex,
                        column: 0,
                        length: keyword.length,
                        code: 'SYLANG_PROPERTY_BEFORE_HEADER'
                    });
                }
                
                // Check for property uniqueness within current definition
                // EXCEPTION: In VML files, relation keywords (like 'extends') can appear multiple times
                const keywordType = SylangKeywordManager.getKeywordType(fileExtension, keyword);
                const isRelationKeyword = keywordType === KeywordType.RELATION;
                const isVmlFile = fileExtension === '.vml';
                const shouldCheckUniqueness = !(isVmlFile && isRelationKeyword);
                

                if (inDefinitionBlock && shouldCheckUniqueness && currentDefinitionProperties.has(keyword)) {
                    errors.push({
                        message: `Duplicate property '${keyword}' found. Each property can only appear once per definition block.`,
                        severity: vscode.DiagnosticSeverity.Error,
                        line: originalLineIndex,
                        column: 0,
                        length: keyword.length,
                        code: 'SYLANG_DUPLICATE_PROPERTY'
                    });
                } else if (inDefinitionBlock && shouldCheckUniqueness) {
                    currentDefinitionProperties.add(keyword);
                }
                
                this.validateProperty(tokens, errors, originalLineIndex, line, fileExtension);
                this.validateExternalIdentifierUsage(tokens, errors, originalLineIndex, line, document.uri);
                
                // Validate relationship keywords and mandatory ref usage
                this.relationshipValidator.validateMandatoryRefKeyword(tokens, originalLineIndex, line, errors);
                
                // If this contains a ref statement, validate the relationship rules and reference
                const refIndex = tokens.indexOf('ref');
                if (refIndex !== -1 && refIndex + 2 < tokens.length) {
                    const relationKeyword = tokens[0];
                    const refType = tokens[refIndex + 1];
                    const refIdentifier = tokens[refIndex + 2];
                    
                    this.logger.debug(`🔗 ${getVersionedLogger('VALIDATION ENGINE')} - Found ref in property line: ${line.trim()} - validating ${refIdentifier}`);
                    
                    // Get file extension for validation
                    const fileExtension = document.fileName.substring(document.fileName.lastIndexOf('.'));
                    
                    // Use config-aware validation if file supports it
                    if (this.relationshipValidator.isConfigAwareFile(fileExtension)) {
                        // Generate node IDs for config-aware validation
                        const sourceNodeId = this.relationshipValidator.generateNodeId(document.uri, currentDefinitionName);
                        const targetNodeId = this.relationshipValidator.generateNodeId(document.uri, refIdentifier);
                        
                        // Check if source node is disabled - if so, skip all validation for its internal relations
                        const configManager = this.symbolManager.getConfigManager();
                        const sourceState = configManager.getNodeState(sourceNodeId);
                        
                        if (sourceState && !sourceState.isVisible) {
                            this.logger.info(`🔗 ${getVersionedLogger('VALIDATION ENGINE')} - ✅ SKIPPING ALL validation for disabled source ${currentDefinitionName}: relations, cardinality, and references ignored (config: ${sourceState.configReference})`);
                            // Skip ALL validation entirely when source is disabled - no relations, cardinality, or reference validation
                        } else {
                            const sourceVisibility = sourceState ? `visible=${sourceState.isVisible}, config=${sourceState.configReference}` : 'no_config_state';
                            this.logger.debug(`🔗 ${getVersionedLogger('VALIDATION ENGINE')} - Source ${currentDefinitionName} is enabled (${sourceVisibility}), proceeding with validation`);
                            this.logger.debug(`🔗 ${getVersionedLogger('VALIDATION ENGINE')} - Using config-aware validation for ${sourceNodeId} -> ${targetNodeId}`);
                            this.relationshipValidator.validateConfigAwareRelationshipRule(
                                relationKeyword, refType, sourceNodeId, targetNodeId, 
                                originalLineIndex, line, errors, fileExtension
                            );
                            
                            // Validate relation cardinality - only for enabled sources
                            this.validateRelationCardinality(tokens, relationKeyword, fileExtension, errors, originalLineIndex);
                            
                            // Also validate the reference itself (symbol existence and import validation) - only for enabled sources
                            const refTokens = tokens.slice(refIndex);
                            this.validateReference(refTokens, errors, originalLineIndex, line, document.uri);
                        }
                    } else {
                        // Use legacy validation for exempt files (.ple, .fml, .vml, .vcf)
                        this.logger.debug(`🔗 ${getVersionedLogger('VALIDATION ENGINE')} - Using legacy validation for exempt file ${fileExtension}`);
                        this.relationshipValidator.validateRelationshipRule(relationKeyword, refType, originalLineIndex, line, errors, fileExtension);
                        
                        // For exempt files, always validate cardinality and references (no config skip)
                        this.validateRelationCardinality(tokens, relationKeyword, fileExtension, errors, originalLineIndex);
                        const refTokens = tokens.slice(refIndex);
                        this.validateReference(refTokens, errors, originalLineIndex, line, document.uri);
                    }
                }
            } else if (keyword === 'ref') {
                // Check if we should skip validation for disabled source (config-aware files only)
                const fileExtension = document.fileName.substring(document.fileName.lastIndexOf('.'));
                if (this.relationshipValidator.isConfigAwareFile(fileExtension)) {
                    const sourceNodeId = this.relationshipValidator.generateNodeId(document.uri, currentDefinitionName);
                    const configManager = this.symbolManager.getConfigManager();
                    const sourceState = configManager.getNodeState(sourceNodeId);
                    
                    if (sourceState && !sourceState.isVisible) {
                        this.logger.info(`🔗 ${getVersionedLogger('VALIDATION ENGINE')} - ✅ SKIPPING standalone ref validation for disabled source ${currentDefinitionName} (config: ${sourceState.configReference})`);
                        // Skip validation entirely when source is disabled
                    } else {
                        this.validateReference(tokens, errors, originalLineIndex, line, document.uri);
                    }
                } else {
                    // For exempt files, always validate
                    this.validateReference(tokens, errors, originalLineIndex, line, document.uri);
                }
            }
        }

        // Check for required header
        if (!hasHeader) {
            const fileTypeName = fileType?.displayName || `${fileExtension}`;
            errors.push({
                message: `Missing required header definition. ${fileTypeName} files must have an 'hdef' statement.`,
                severity: vscode.DiagnosticSeverity.Error,
                line: 0,
                column: 0,
                length: 0,
                code: 'SYLANG_MISSING_HEADER'
            });
        }

        // File-specific validations
        this.performFileSpecificValidation(document, errors, fileExtension);

        // Validate unused imports at document level
        this.importValidator.validateUnusedImports(document.getText(), document.uri, errors);

        return errors;
    }

    // NEW: Validate folder-level file limitations
    private validateFolderFileLimitations(fileUri: vscode.Uri, fileExtension: string, errors: ValidationError[]): void {
        if (fileExtension !== '.fml' && fileExtension !== '.vcf') {
            return; // Only validate .fml and .vcf files
        }
        
        const folderPath = path.dirname(fileUri.fsPath);
        
        // Check for multiple .fml files in the same folder
        if (fileExtension === '.fml') {
            const fmlFiles = this.findFilesInFolder(folderPath, '.fml');
            if (fmlFiles.length > 1) {
                errors.push({
                    message: getVersionedMessage(`Multiple .fml files found in folder. Only one .fml file allowed per folder. Found: ${fmlFiles.join(', ')}`),
                    severity: vscode.DiagnosticSeverity.Error,
                    line: 0,
                    column: 0,
                    length: 1,
                    code: 'SYLANG_MULTIPLE_FML_FILES'
                });
            }
        }
        
        // Check for multiple .vcf files in the same folder
        if (fileExtension === '.vcf') {
            const vcfFiles = this.findFilesInFolder(folderPath, '.vcf');
            if (vcfFiles.length > 1) {
                errors.push({
                    message: getVersionedMessage(`Multiple .vcf files found in folder. Only one .vcf file allowed per folder. Found: ${vcfFiles.join(', ')}`),
                    severity: vscode.DiagnosticSeverity.Error,
                    line: 0,
                    column: 0,
                    length: 1,
                    code: 'SYLANG_MULTIPLE_VCF_FILES'
                });
            }
        }
    }

    // Helper method to find files with specific extension in a folder
    private findFilesInFolder(folderPath: string, extension: string): string[] {
        try {
            const files = fs.readdirSync(folderPath);
            return files.filter(file => file.endsWith(extension));
        } catch (error) {
            this.logger.warn(`Could not read folder ${folderPath}: ${error}`);
            return [];
        }
    }

    private validateUseStatement(tokens: string[], errors: ValidationError[], originalLineIndex: number, line: string): void {
        if (tokens.length < 3) {
            errors.push({
                message: "Invalid 'use' statement format. Expected: 'use <type> <identifier>'",
                severity: vscode.DiagnosticSeverity.Error,
                line: originalLineIndex,
                column: 0,
                length: line.length,
                code: 'SYLANG_INVALID_USE_FORMAT'
            });
            return;
        }

        const symbolType = tokens[1]; // should be 'productline', 'featureset', etc.
        const symbolName = tokens[2]; // the identifier

        // Valid symbol types that can be imported
        const validImportTypes = [
            'productline', 'featureset', 'variantset', 'configset', 'functionset',
            'requirementset', 'testset', 'block', 'agentset'
        ];

        if (!validImportTypes.includes(symbolType)) {
            errors.push({
                message: `Invalid import type '${symbolType}'. Valid types: ${validImportTypes.join(', ')}`,
                severity: vscode.DiagnosticSeverity.Error,
                line: originalLineIndex,
                column: line.indexOf(symbolType),
                length: symbolType.length,
                code: 'SYLANG_INVALID_IMPORT_TYPE'
            });
        }

        // Validate identifier format
        if (!this.isValidIdentifier(symbolName)) {
            errors.push({
                message: `Invalid identifier '${symbolName}'. Identifiers must start with a letter or underscore and contain only letters, numbers, and underscores.`,
                severity: vscode.DiagnosticSeverity.Error,
                line: originalLineIndex,
                column: line.indexOf(symbolName),
                length: symbolName.length,
                code: 'SYLANG_INVALID_IDENTIFIER'
            });
        }
    }

    private validateHeaderDefinition(tokens: string[], errors: ValidationError[], originalLineIndex: number, line: string, fileType: any, fileUri: vscode.Uri): void {
        if (tokens.length < 3) {
            errors.push({
                message: `Invalid header definition. Expected format: 'hdef ${fileType.headerKeyword} <identifier>'`,
                severity: vscode.DiagnosticSeverity.Error,
                line: originalLineIndex,
                column: 0,
                length: line.length,
                code: 'SYLANG_INVALID_HEADER'
            });
            return;
        }

        const headerKeyword = tokens[1];
        if (headerKeyword !== fileType.headerKeyword) {
            errors.push({
                message: `Invalid header keyword '${headerKeyword}'. Expected '${fileType.headerKeyword}' for ${fileType.displayName} files.`,
                severity: vscode.DiagnosticSeverity.Error,
                line: originalLineIndex,
                column: line.indexOf(headerKeyword),
                length: headerKeyword.length,
                code: 'SYLANG_WRONG_HEADER_KEYWORD'
            });
        }

        const identifier = tokens[2];
        if (!this.isValidIdentifier(identifier)) {
            errors.push({
                message: `Invalid identifier '${identifier}'. Identifiers must start with a letter or underscore, followed by letters, numbers, or underscores.`,
                severity: vscode.DiagnosticSeverity.Error,
                line: originalLineIndex,
                column: line.indexOf(identifier),
                length: identifier.length,
                code: 'SYLANG_INVALID_IDENTIFIER'
            });
        }

        // CRITICAL: Add hdef identifier to global registry (Fix 1)
        if (identifier) {
            const globalIdentifiers = this.symbolManager.getGlobalIdentifierRegistry();
            
            // Check for duplicate identifier across the entire project
            if (globalIdentifiers.has(identifier)) {
                const existing = globalIdentifiers.get(identifier)!;
                errors.push({
                    message: `🚨 DUPLICATE IDENTIFIER: '${identifier}' already defined as '${existing.type}' in ${path.basename(existing.fileUri.fsPath)} at line ${existing.line + 1}.`,
                    severity: vscode.DiagnosticSeverity.Error,
                    line: originalLineIndex,
                    column: line.indexOf(identifier),
                    length: identifier.length,
                    code: 'SYLANG_GLOBAL_DUPLICATE_IDENTIFIER'
                });
            } else {
                // Add hdef identifier to global registry
                this.symbolManager.addGlobalIdentifier(identifier, `hdef ${headerKeyword}`, fileUri, originalLineIndex, line.indexOf(identifier));
            }
        }
    }

    private validateDefinition(tokens: string[], errors: ValidationError[], originalLineIndex: number, line: string, fileExtension: string, definedSymbols: Set<string>, fileUri: vscode.Uri): void {
        const defKeyword = tokens[1];
        
        // For all definitions, identifier is at position 2
        const identifier = tokens[2];
        
        // Get global identifier registry
        const globalIdentifiers = this.symbolManager.getGlobalIdentifierRegistry();
        
        // Validate minimum token requirements
        if (tokens.length < 3) {
            errors.push({
                message: "Invalid definition. Expected format: 'def <definition-keyword> <identifier> [optional-flags]'",
                severity: vscode.DiagnosticSeverity.Error,
                line: originalLineIndex,
                column: 0,
                length: line.length,
                code: 'SYLANG_INVALID_DEF'
            });
            return;
        }

        // Check if definition keyword is allowed
        if (!SylangKeywordManager.isKeywordAllowed(fileExtension, defKeyword)) {
            errors.push({
                message: `Definition keyword '${defKeyword}' is not allowed in this file type.`,
                severity: vscode.DiagnosticSeverity.Error,
                line: originalLineIndex,
                column: line.indexOf(defKeyword),
                length: defKeyword.length,
                code: 'SYLANG_INVALID_DEF_KEYWORD'
            });
        }

        // Check identifier validity
        if (identifier && !this.isValidIdentifier(identifier)) {
            errors.push({
                message: `Invalid identifier '${identifier}'.`,
                severity: vscode.DiagnosticSeverity.Error,
                line: originalLineIndex,
                column: line.indexOf(identifier),
                length: identifier.length,
                code: 'SYLANG_INVALID_IDENTIFIER'
            });
        }

        // CRITICAL: Check for duplicate identifiers PROJECT-WIDE
        if (identifier) {
            // Check for duplicate identifier across the entire project
            if (globalIdentifiers.has(identifier)) {
                const existing = globalIdentifiers.get(identifier)!;
                errors.push({
                    message: `🚨 DUPLICATE IDENTIFIER: '${identifier}' already defined as '${existing.type}' in ${path.basename(existing.fileUri.fsPath)} at line ${existing.line + 1}.`,
                    severity: vscode.DiagnosticSeverity.Error,
                    line: originalLineIndex,
                    column: line.indexOf(identifier),
                    length: identifier.length,
                    code: 'SYLANG_GLOBAL_DUPLICATE_IDENTIFIER'
                });
            } else {
                // Add to global registry
                this.symbolManager.addGlobalIdentifier(identifier, defKeyword, fileUri, originalLineIndex, line.indexOf(identifier));
            }
            
            // Also check for duplicate definitions of same type (legacy check)
            const fullIdentifier = `${defKeyword}.${identifier}`;
            if (definedSymbols.has(fullIdentifier)) {
                errors.push({
                    message: `Duplicate definition '${identifier}' of type '${defKeyword}'.`,
                    severity: vscode.DiagnosticSeverity.Error,
                    line: originalLineIndex,
                    column: line.indexOf(identifier),
                    length: identifier.length,
                    code: 'SYLANG_DUPLICATE_DEF'
                });
            } else {
                definedSymbols.add(fullIdentifier);
            }
        }

        // Validate optional flags
        if (tokens.length > 3) {
            // Normal validation for all definitions
            for (let i = 3; i < tokens.length; i++) {
                const flag = tokens[i];
                
                // Special handling for config definitions - they use 1 or 0 instead of keyword flags
                if (defKeyword === 'config') {
                    if (flag !== '1' && flag !== '0') {
                        errors.push({
                            message: `Invalid config value '${flag}'. Config definitions must use '1' (enabled) or '0' (disabled).`,
                            severity: vscode.DiagnosticSeverity.Error,
                            line: originalLineIndex,
                            column: line.indexOf(flag),
                            length: flag.length,
                            code: 'SYLANG_INVALID_CONFIG_VALUE'
                        });
                    }
                } else {
                    // Regular optional flag validation
                    const flagType = SylangKeywordManager.getKeywordType(fileExtension, flag);
                    if (flagType !== KeywordType.OPTIONAL_FLAG) {
                        errors.push({
                            message: `Invalid optional flag '${flag}'.`,
                            severity: vscode.DiagnosticSeverity.Error,
                            line: originalLineIndex,
                            column: line.indexOf(flag),
                            length: flag.length,
                            code: 'SYLANG_INVALID_FLAG'
                        });
                    }
                }
            }
        }
    }

    private validateProperty(tokens: string[], errors: ValidationError[], originalLineIndex: number, line: string, fileExtension: string): void {
        if (tokens.length < 2) {
            errors.push({
                message: "Invalid property. Properties must have at least one value.",
                severity: vscode.DiagnosticSeverity.Error,
                line: originalLineIndex,
                column: 0,
                length: line.length,
                code: 'SYLANG_EMPTY_PROPERTY'
            });
            return;
        }

        const propertyName = tokens[0];
        const keywordType = SylangKeywordManager.getKeywordType(fileExtension, propertyName);
        
        // Validate enum properties
        if (keywordType === KeywordType.ENUM) {
            const enumValues = SylangKeywordManager.getEnumValues(propertyName);
            const propertyValue = tokens[1];
            
            if (enumValues.length > 0 && !enumValues.includes(propertyValue)) {
                errors.push({
                    message: `Invalid enum value '${propertyValue}' for '${propertyName}'. Valid values: ${enumValues.join(', ')}`,
                    severity: vscode.DiagnosticSeverity.Error,
                    line: originalLineIndex,
                    column: line.indexOf(propertyValue),
                    length: propertyValue.length,
                    code: 'SYLANG_INVALID_ENUM'
                });
            }
        }

        // CRITICAL: Validate flags in 'extends' relations for VML files
        if (propertyName === 'extends' && tokens.length >= 4 && tokens[1] === 'ref' && tokens[2] === 'feature') {
            const validFlags = ['mandatory', 'optional', 'or', 'alternative', 'selected'];
            
            // Check tokens after the feature name (position 4 onwards) for invalid flags
            // Structure: extends ref feature <FeatureName> <flag1> <flag2> ...
            //           0       1   2       3            4       5
            for (let i = 4; i < tokens.length; i++) {
                const token = tokens[i];
                
                // Skip obvious non-flags
                if (token.startsWith('"') || /^\d+$/.test(token)) {
                    continue;
                }
                
                // If it's not a valid flag, check if it's a typo
                if (!validFlags.includes(token)) {
                    const suggestedFlag = this.detectFlagTypo(token, validFlags);
                    
                    if (suggestedFlag) {
                        errors.push({
                            message: `Invalid optional flag '${token}' in extends relation. Did you mean '${suggestedFlag}'?`,
                            severity: vscode.DiagnosticSeverity.Error,
                            line: originalLineIndex,
                            column: line.indexOf(token),
                            length: token.length,
                            code: 'SYLANG_INVALID_EXTENDS_FLAG'
                        });
                    } else if (token.length >= 3) {
                        // Only flag potential typos for words that could be flags
                        errors.push({
                            message: `Invalid optional flag '${token}' in extends relation. Valid flags: ${validFlags.join(', ')}`,
                            severity: vscode.DiagnosticSeverity.Error,
                            line: originalLineIndex,
                            column: line.indexOf(token),
                            length: token.length,
                            code: 'SYLANG_INVALID_EXTENDS_FLAG'
                        });
                    }
                }
            }
        }

        // NEW: Validate property cardinality (core + extensions)
        this.validatePropertyCardinality(tokens, propertyName, fileExtension, errors, originalLineIndex);
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

    /**
     * Property cardinality validation (removed - core validation only)
     */
    private validatePropertyCardinality(_tokens: string[], _propertyName: string, _fileExtension: string, _errors: ValidationError[], _originalLineIndex: number): void {
        // Extension manager removed - skip cardinality validation
        return;
    }

    /**
     * Relation cardinality validation (removed - core validation only)
     */
    private validateRelationCardinality(_tokens: string[], _relationName: string, _fileExtension: string, _errors: ValidationError[], _originalLineIndex: number): void {
        // Extension manager removed - skip cardinality validation
        return;
    }

    private validateReference(tokens: string[], errors: ValidationError[], originalLineIndex: number, line: string, fileUri: vscode.Uri): void {
        if (tokens.length < 3) {
            errors.push({
                message: "Invalid reference. Expected format: 'ref <type> <identifier>'",
                severity: vscode.DiagnosticSeverity.Error,
                line: originalLineIndex,
                column: 0,
                length: line.length,
                code: 'SYLANG_INVALID_REF'
            });
            return;
        }

        const refType = tokens[1];
        
        // Validate ALL identifiers after 'ref <type>' (comma-separated)
        const identifiers = tokens.slice(2).filter(token => 
            !token.startsWith('"') && // Not string literals
            !['mandatory', 'optional', 'or', 'alternative', 'selected'].includes(token) // Not flags
        );

        // Debug logging
        this.logger.debug(`${getVersionedLogger('VALIDATION')}: Validating ${identifiers.length} references: ${identifiers.join(', ')} (type: ${refType}) in file: ${fileUri.fsPath}`);
        
        // Check what imports are available in this file
        const documentSymbols = this.symbolManager.getDocumentSymbols(fileUri);
        if (documentSymbols) {
            this.logger.debug(`  Available imports: ${documentSymbols.importedSymbols.map(imp => `${imp.headerKeyword} ${imp.headerIdentifier}`).join(', ')}`);
        }
        
        // Calculate exact positions for each identifier in the original line
        const identifierPositions = this.calculateIdentifierPositions(line, identifiers);
        
        // Validate each identifier
        for (let i = 0; i < identifiers.length; i++) {
            const identifier = identifiers[i];
            const position = identifierPositions[i];
            
            // Check if referenced symbol exists and is visible through use statements
            const symbol = this.symbolManager.resolveSymbol(identifier, fileUri);
            this.logger.debug(`  Symbol resolved for ${identifier}: ${symbol ? `${symbol.name} (${symbol.kind})` : 'NOT FOUND'}`);
            
            if (!symbol) {
                // Check if the symbol exists in other files but is not imported/visible
                const externalSymbol = this.findExternalSymbol(identifier, fileUri);
                this.logger.debug(`  External symbol found for ${identifier}: ${externalSymbol ? `${externalSymbol.name} (${externalSymbol.kind}) in ${externalSymbol.fileUri.fsPath}` : 'NOT FOUND'}`);
                
                if (externalSymbol) {
                    // Check if the symbol is disabled by checking if it's in the visible symbols list
                    const allVisibleSymbols = this.symbolManager.getAllSymbols();
                    const isVisible = allVisibleSymbols.some(visible => 
                        visible.name === externalSymbol.name && visible.fileUri.fsPath === externalSymbol.fileUri.fsPath
                    );
                    
                    if (isVisible) {
                        // Symbol exists and is visible, just needs import
                        errors.push({
                            message: getVersionedMessage(`Reference to '${identifier}' requires a 'use' statement. Add 'use ${externalSymbol.kind} ${identifier}' at the top of the file.`),
                            severity: vscode.DiagnosticSeverity.Error,
                            line: originalLineIndex,
                            column: position,
                            length: identifier.length,
                            code: 'SYLANG_MISSING_USE_STATEMENT'
                        });
                    } else {
                        // Symbol exists but is disabled by configuration
                        errors.push({
                            message: getVersionedMessage(`Reference to '${identifier}' is not available because the symbol is disabled by configuration.`),
                            severity: vscode.DiagnosticSeverity.Error,
                            line: originalLineIndex,
                            column: position,
                            length: identifier.length,
                            code: 'SYLANG_DISABLED_SYMBOL'
                        });
                    }
                } else {
                    errors.push({
                        message: getVersionedMessage(`Unresolved reference to '${identifier}'. Symbol not found in project.`),
                        severity: vscode.DiagnosticSeverity.Error,
                        line: originalLineIndex,
                        column: position,
                        length: identifier.length,
                        code: 'SYLANG_UNRESOLVED_REF'
                    });
                }
            } else {
                // Check for duplicate identifier across files with different types
                const allSymbols = this.symbolManager.getAllSymbolsRaw();
                const duplicateSymbols = allSymbols.filter(s => s.name === identifier && s.fileUri.fsPath !== fileUri.fsPath);
                
                if (duplicateSymbols.length > 0) {
                    // Found duplicate identifiers in other files
                    const duplicateTypes = duplicateSymbols.map(s => s.kind);
                    const currentType = symbol.kind;
                    
                    // If the current symbol type doesn't match the reference type, but there's a duplicate with the reference type
                    if (currentType !== refType && duplicateTypes.includes(refType)) {
                        const duplicateFile = duplicateSymbols.find(s => s.kind === refType)?.fileUri.fsPath;
                        errors.push({
                            message: getVersionedMessage(`Duplicate identifier '${identifier}'. You have a '${currentType}' in this file and a '${refType}' in ${duplicateFile ? path.basename(duplicateFile) : 'another file'}. Use unique identifiers.`),
                            severity: vscode.DiagnosticSeverity.Error,
                            line: originalLineIndex,
                            column: position,
                            length: identifier.length,
                            code: 'SYLANG_DUPLICATE_IDENTIFIER'
                        });
                    } else if (symbol.kind !== refType) {
                        // Regular type mismatch (no duplicate with correct type)
                        errors.push({
                            message: getVersionedMessage(`Reference type mismatch. Expected '${symbol.kind}' but found '${refType}' for '${identifier}'.`),
                            severity: vscode.DiagnosticSeverity.Error,
                            line: originalLineIndex,
                            column: position,
                            length: identifier.length,
                            code: 'SYLANG_REF_TYPE_MISMATCH'
                        });
                    } else {
                        this.logger.debug(`  ✅ Reference validation passed for ${identifier}`);
                    }
                } else if (symbol.kind !== refType) {
                    errors.push({
                        message: getVersionedMessage(`Reference type mismatch. Expected '${symbol.kind}' but found '${refType}' for '${identifier}'.`),
                        severity: vscode.DiagnosticSeverity.Error,
                        line: originalLineIndex,
                        column: position,
                        length: identifier.length,
                        code: 'SYLANG_REF_TYPE_MISMATCH'
                    });
                } else {
                    this.logger.debug(`  ✅ Reference validation passed for ${identifier}`);
                }
            }
        }
    }

    /**
     * Calculate exact positions of identifiers in a line, accounting for comma separation
     */
    private calculateIdentifierPositions(line: string, identifiers: string[]): number[] {
        const positions: number[] = [];
        let currentPos = 0;
        
        for (const identifier of identifiers) {
            // Find the next occurrence of this identifier starting from currentPos
            const pos = line.indexOf(identifier, currentPos);
            if (pos !== -1) {
                positions.push(pos);
                currentPos = pos + identifier.length; // Move past this identifier
            } else {
                // Fallback: use line.indexOf if not found
                positions.push(line.indexOf(identifier));
            }
        }
        
        return positions;
    }

    private performFileSpecificValidation(document: vscode.TextDocument, errors: ValidationError[], fileExtension: string): void {
        switch (fileExtension) {
            case '.ple':
                this.validatePleFile(document, errors);
                break;
            case '.fml':
                this.validateFmlFile(document, errors);
                break;
            case '.vml':
                this.validateVmlFile(document, errors);
                break;
            case '.vcf':
                this.validateVcfFile(document, errors);
                break;
            case '.spr':
                this.validateSprFile(document, errors);
                break;
            case '.agt':
                this.validateAgtFile(document, errors);
                break;
            // Add more file-specific validations as needed
        }
    }

    private validatePleFile(document: vscode.TextDocument, errors: ValidationError[]): void {
        // .ple files should not have 'use' statements
        const lines = document.getText().split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('use ')) {
                errors.push({
                    message: "'use' statements are not allowed in Product Line (.ple) files.",
                    severity: vscode.DiagnosticSeverity.Error,
                    line: i,
                    column: 0,
                    length: 3,
                    code: 'SYLANG_PLE_NO_USE'
                });
            }
        }
    }

    private validateFmlFile(document: vscode.TextDocument, errors: ValidationError[]): void {
        // Validate .fml specific sibling rules for features
        const documentSymbols = this.symbolManager.getDocumentSymbols(document.uri);
        if (!documentSymbols) return;

        // Group siblings by parent and validate they have consistent flags
        const siblingGroups = new Map<string, SylangSymbol[]>();
        
        for (const symbol of documentSymbols.definitionSymbols) {
            if (symbol.kind === 'feature') {
                const parentKey = symbol.parentSymbol || 'root';
                if (!siblingGroups.has(parentKey)) {
                    siblingGroups.set(parentKey, []);
                }
                siblingGroups.get(parentKey)!.push(symbol);
            }
        }

        // Validate sibling consistency
        for (const [_parentKey, siblings] of siblingGroups) {
            if (siblings.length > 1) {
                this.validateFeatureSiblings(siblings, errors);
            }
        }
    }

    private validateVmlFile(document: vscode.TextDocument, errors: ValidationError[]): void {
        // VML files have flat 'extends ref feature' structure - parse directly from text
        this.logger.info(`🔍 ${getVersionedLogger('VML VALIDATION')} - Starting VML constraint validation`);
        
        const lines = document.getText().split('\n');
        const features = new Map<string, {name: string, flags: string[], selected: boolean, line: number, parent?: string}>();
        
        // Parse extends ref feature lines directly
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex].trim();
            
            if (line.startsWith('extends ref feature ')) {
                const tokens = line.split(/\s+/);
                if (tokens.length >= 4) {
                    const featureName = tokens[3];
                    const flags = tokens.slice(4).filter(token => 
                        ['mandatory', 'optional', 'or', 'alternative', 'selected'].includes(token)
                    );
                    const isSelected = flags.includes('selected');
                    
                    // Determine parent from indentation hierarchy (simplified for now)
                    const indentLevel = lines[lineIndex].length - lines[lineIndex].trimStart().length;
                    const parent = indentLevel > 2 ? this.findVmlParent(lines, lineIndex) : undefined;
                    
                    features.set(featureName, {
                        name: featureName,
                        flags: flags.filter(f => f !== 'selected'),
                        selected: isSelected,
                        line: lineIndex,
                        parent: parent
                    });
                    
                    this.logger.info(`🔍 ${getVersionedLogger('VML VALIDATION')} - Parsed feature: ${featureName}, flags: [${flags.join(', ')}], selected: ${isSelected}, parent: ${parent || 'root'}`);
                }
            }
        }

        this.logger.info(`🔍 ${getVersionedLogger('VML VALIDATION')} - Found ${features.size} features to validate`);
        
        // Group features by constraint type and parent for validation
        this.validateVmlConstraints(features, errors);
        
        this.logger.info(`🔍 ${getVersionedLogger('VML VALIDATION')} - Completed VML constraint validation`);
    }

    /**
     * Find the parent feature for a VML line based on indentation
     */
    private findVmlParent(lines: string[], currentLineIndex: number): string | undefined {
        const currentIndent = lines[currentLineIndex].length - lines[currentLineIndex].trimStart().length;
        
        // Look backwards for a less indented line with 'extends ref feature'
        for (let i = currentLineIndex - 1; i >= 0; i--) {
            const line = lines[i].trim();
            const lineIndent = lines[i].length - lines[i].trimStart().length;
            
            if (lineIndent < currentIndent && line.startsWith('extends ref feature ')) {
                const tokens = line.split(/\s+/);
                if (tokens.length >= 4) {
                    return tokens[3]; // Return the feature name
                }
            }
        }
        return undefined;
    }

    /**
     * Validate VML constraints: alternative (only one), or (at least one), mandatory (must be selected when parent selected)
     */
    private validateVmlConstraints(features: Map<string, {name: string, flags: string[], selected: boolean, line: number, parent?: string}>, errors: ValidationError[]): void {
        // Group features by parent
        const parentGroups = new Map<string, Array<{name: string, flags: string[], selected: boolean, line: number}>>();
        
        for (const [, feature] of features) {
            const parentKey = feature.parent || 'root';
            if (!parentGroups.has(parentKey)) {
                parentGroups.set(parentKey, []);
            }
            parentGroups.get(parentKey)!.push({
                name: feature.name,
                flags: feature.flags,
                selected: feature.selected,
                line: feature.line
            });
        }

        // Validate each parent group
        for (const [parentKey, children] of parentGroups) {
            // Check if parent is selected (for dependency validation)
            const parentFeature = features.get(parentKey);
            const parentSelected = !parentFeature || parentFeature.selected; // root or selected parent
            
            this.logger.info(`🔍 ${getVersionedLogger('VML CONSTRAINTS')} - Validating parent '${parentKey}' (selected: ${parentSelected}) with ${children.length} children`);

            if (parentSelected) {
                // Group children by flag type
                const mandatoryFeatures = children.filter(f => f.flags.includes('mandatory'));
                const alternativeFeatures = children.filter(f => f.flags.includes('alternative'));
                const orFeatures = children.filter(f => f.flags.includes('or'));

                // 1. Validate mandatory features are selected
                for (const mandatory of mandatoryFeatures) {
                    if (!mandatory.selected) {
                        errors.push({
                            message: `Mandatory constraint violation: Feature '${mandatory.name}' must be selected when its parent '${parentKey}' is selected`,
                            severity: vscode.DiagnosticSeverity.Error,
                            line: mandatory.line,
                            column: 0,
                            length: mandatory.name.length,
                            code: 'SYLANG_MANDATORY_NOT_SELECTED'
                        });
                    }
                }

                // 2. Validate alternative features (only one selected)
                if (alternativeFeatures.length > 1) {
                    const selectedAlternatives = alternativeFeatures.filter(f => f.selected);
                    if (selectedAlternatives.length > 1) {
                        for (let i = 1; i < selectedAlternatives.length; i++) {
                            errors.push({
                                message: `Alternative constraint violation: Only one alternative feature can be selected, but multiple are selected: ${selectedAlternatives.map(f => f.name).join(', ')}`,
                                severity: vscode.DiagnosticSeverity.Error,
                                line: selectedAlternatives[i].line,
                                column: 0,
                                length: selectedAlternatives[i].name.length,
                                code: 'SYLANG_ALTERNATIVE_MULTIPLE_SELECTED'
                            });
                        }
                    }
                }

                // 3. Validate or features (at least one selected)
                if (orFeatures.length > 0) {
                    const selectedOrFeatures = orFeatures.filter(f => f.selected);
                    if (selectedOrFeatures.length === 0) {
                        errors.push({
                            message: `Or constraint violation: At least one 'or' feature must be selected from: ${orFeatures.map(f => f.name).join(', ')}`,
                            severity: vscode.DiagnosticSeverity.Error,
                            line: orFeatures[0].line,
                            column: 0,
                            length: orFeatures[0].name.length,
                            code: 'SYLANG_OR_NONE_SELECTED'
                        });
                    }
                }

                this.logger.info(`🔍 ${getVersionedLogger('VML CONSTRAINTS')} - Validated parent '${parentKey}': ${mandatoryFeatures.length} mandatory, ${alternativeFeatures.length} alternative, ${orFeatures.length} or`);
            } else {
                this.logger.info(`🔍 ${getVersionedLogger('VML CONSTRAINTS')} - Skipping validation for children of unselected parent '${parentKey}'`);
            }
        }
    }



    private validateFeatureSiblings(siblings: SylangSymbol[], errors: ValidationError[]): void {
        if (siblings.length <= 1) return;

        this.logger.info(`🔍 SIBLING VALIDATION v${getVersionedLogger('VALIDATION')} - Validating ${siblings.length} siblings:`);
        
        // Extract optional flags from sibling symbols
        const siblingFlags: Array<{symbol: SylangSymbol, flags: string[], line: number}> = [];
        
        for (const sibling of siblings) {
            const flags = this.extractOptionalFlags(sibling);
            const line = sibling.line || 0;
            siblingFlags.push({ symbol: sibling, flags, line });
            
            this.logger.info(`  - ${sibling.name} (line ${line}): flags=[${flags.join(', ')}], parent=${sibling.parentSymbol}`);
        }

        // Validate consistency: all siblings must have the same flag type
        const firstSiblingFlags = siblingFlags[0].flags;
        const firstFlagType = this.categorizeFlags(firstSiblingFlags);
        
        this.logger.info(`  First sibling '${siblingFlags[0].symbol.name}' uses flag type: '${firstFlagType}'`);

        for (let i = 1; i < siblingFlags.length; i++) {
            const currentFlags = siblingFlags[i].flags;
            const currentFlagType = this.categorizeFlags(currentFlags);
            
            this.logger.info(`  Sibling '${siblingFlags[i].symbol.name}' uses flag type: '${currentFlagType}'`);

            if (firstFlagType !== currentFlagType) {
                this.logger.info(`  ❌ SIBLING INCONSISTENCY DETECTED!`);
                errors.push({
                    message: `Sibling feature flag inconsistency. All siblings must use the same flag type. First sibling '${siblingFlags[0].symbol.name}' uses '${firstFlagType}' but '${siblingFlags[i].symbol.name}' uses '${currentFlagType}'. Valid combinations: (mandatory/optional) OR (or) OR (alternative).`,
                    severity: vscode.DiagnosticSeverity.Error,
                    line: siblingFlags[i].line,
                    column: 0,
                    length: siblingFlags[i].symbol.name.length,
                    code: 'SYLANG_SIBLING_FLAG_INCONSISTENCY'
                });
            }
        }
        
        this.logger.info(`🔍 SIBLING VALIDATION COMPLETE - Found ${errors.length} sibling errors`);
    }

    private extractOptionalFlags(symbol: SylangSymbol): string[] {
        // Extract flags from symbol properties
        const flags: string[] = [];
        const optionalFlags = ['mandatory', 'optional', 'or', 'alternative', 'selected'];
        
        // Check symbol properties
        if (symbol.properties) {
            for (const [key, _value] of symbol.properties.entries()) {
                if (optionalFlags.includes(key)) {
                    flags.push(key);
                }
            }
        }
        
        return flags;
    }

    private categorizeFlags(flags: string[]): string {
        // Categorize flags into compatible groups
        if (flags.includes('mandatory') || flags.includes('optional')) {
            return 'mandatory-optional';
        } else if (flags.includes('or')) {
            return 'or';
        } else if (flags.includes('alternative')) {
            return 'alternative';
        }
        return 'none';
    }

    private validateVcfFile(document: vscode.TextDocument, errors: ValidationError[]): void {
        // .vcf files should have flat structure (no nested defs)
        const lines = document.getText().split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('def ')) {
                const indentLevel = this.getIndentLevel(line);
                if (indentLevel > 1) {
                    errors.push({
                        message: 'Variant Config (.vcf) files should have flat structure. Nested definitions are not allowed.',
                        severity: vscode.DiagnosticSeverity.Error,
                        line: i,
                        column: 0,
                        length: line.length,
                        code: 'SYLANG_VCF_NESTED_DEF'
                    });
                }
            }
        }
    }

    private validateSprFile(document: vscode.TextDocument, errors: ValidationError[]): void {
        const lines = document.getText().split('\n');
        
        // Basic sprint file validation - ensure proper hierarchy
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Validate issuestatus enum values
            if (trimmedLine.includes('issuestatus ')) {
                const statusMatch = trimmedLine.match(/issuestatus\s+"?([^"\s]+)"?/);
                if (statusMatch) {
                    const statusValue = statusMatch[1];
                    const validStatuses = ['backlog', 'open', 'inprogress', 'blocked', 'canceled', 'done'];
                    if (!validStatuses.includes(statusValue)) {
                        errors.push({
                            message: `Invalid issuestatus value '${statusValue}'. Valid values: ${validStatuses.join(', ')}`,
                            severity: vscode.DiagnosticSeverity.Error,
                            line: i,
                            column: trimmedLine.indexOf(statusValue),
                            length: statusValue.length,
                            code: 'SYLANG_SPR_INVALID_ISSUESTATUS'
                        });
                    }
                }
            }
            
            // Validate priority enum values
            if (trimmedLine.includes('priority ')) {
                const priorityMatch = trimmedLine.match(/priority\s+"?([^"\s]+)"?/);
                if (priorityMatch) {
                    const priorityValue = priorityMatch[1];
                    const validPriorities = ['low', 'medium', 'high', 'critical'];
                    if (!validPriorities.includes(priorityValue)) {
                        errors.push({
                            message: `Invalid priority value '${priorityValue}'. Valid values: ${validPriorities.join(', ')}`,
                            severity: vscode.DiagnosticSeverity.Error,
                            line: i,
                            column: trimmedLine.indexOf(priorityValue),
                            length: priorityValue.length,
                            code: 'SYLANG_SPR_INVALID_PRIORITY'
                        });
                    }
                }
            }
            
            // Validate assignedto agent references
            if (trimmedLine.includes('assignedto ')) {
                const agentMatch = trimmedLine.match(/assignedto\s+ref\s+agent\s+([A-Za-z_][A-Za-z0-9_]*)/);
                if (agentMatch) {
                    const agentName = agentMatch[1];
                    this.logger.info(`🔍 [SPR VALIDATION v${getVersionedLogger('DEBUG')}] Looking for agent: ${agentName}`);
                    
                    // Check if agent is defined in .agt files
                    const allSymbols = this.symbolManager.getAllSymbolsRaw();
                    this.logger.info(`🔍 [SPR VALIDATION v${getVersionedLogger('DEBUG')}] Total symbols in project: ${allSymbols.length}`);
                    
                    // Log all .agt file symbols
                    const agtSymbols = allSymbols.filter(s => s.fileUri.fsPath.endsWith('.agt'));
                    this.logger.info(`🔍 [SPR VALIDATION v${getVersionedLogger('DEBUG')}] .agt file symbols: ${agtSymbols.length}`);
                    
                    for (const agtSymbol of agtSymbols) {
                        this.logger.info(`  📋 ${agtSymbol.name} (kind: ${agtSymbol.kind}, type: ${agtSymbol.type}) in ${agtSymbol.fileUri.fsPath}`);
                    }
                    
                    const agentSymbol = allSymbols.find(symbol => 
                        symbol.name === agentName && 
                        symbol.fileUri.fsPath.endsWith('.agt') &&
                        symbol.kind === 'agent'
                    );
                    
                    this.logger.info(`🔍 [SPR VALIDATION v${getVersionedLogger('DEBUG')}] Agent '${agentName}' found: ${agentSymbol ? 'YES' : 'NO'}`);
                    
                    if (!agentSymbol) {
                        errors.push({
                            message: `Agent '${agentName}' is not defined. Define it in a .agt file with 'def agent ${agentName}'.`,
                            severity: vscode.DiagnosticSeverity.Error,
                            line: i,
                            column: trimmedLine.indexOf(agentName),
                            length: agentName.length,
                            code: 'SYLANG_SPR_UNDEFINED_AGENT'
                        });
                    } else {
                        this.logger.debug(`✅ Agent reference '${agentName}' found in ${agentSymbol.fileUri.fsPath}`);
                    }
                } else if (trimmedLine.match(/assignedto\s+(?!ref\s+agent)/)) {
                    // Invalid assignedto format - missing 'ref agent'
                    const invalidMatch = trimmedLine.match(/assignedto\s+(.+)/);
                    if (invalidMatch) {
                        errors.push({
                            message: `Invalid assignedto syntax. Use 'assignedto ref agent AgentName' format.`,
                            severity: vscode.DiagnosticSeverity.Error,
                            line: i,
                            column: trimmedLine.indexOf('assignedto'),
                            length: 'assignedto'.length,
                            code: 'SYLANG_SPR_INVALID_ASSIGNEDTO_SYNTAX'
                        });
                    }
                }
            }
        }
    }

    private validateAgtFile(document: vscode.TextDocument, _errors: ValidationError[]): void {
        // .agt files specific validation
        const lines = document.getText().split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('//')) continue;
            
            // Add any .agt specific validation rules here
            // For now, just basic structure validation is handled by core validation
        }
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

    /**
     * Tokenize a line while respecting quoted strings
     * This prevents validation of keywords inside string literals
     */
    private tokenizeLine(line: string): string[] {
        const tokens: string[] = [];
        let currentToken = '';
        let inQuotes = false;
        let quoteChar = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (!inQuotes && (char === '"' || char === "'")) {
                // Start of quoted string
                inQuotes = true;
                quoteChar = char;
                if (currentToken.trim()) {
                    tokens.push(currentToken.trim());
                    currentToken = '';
                }
                currentToken += char;
            } else if (inQuotes && char === quoteChar) {
                // End of quoted string
                inQuotes = false;
                currentToken += char;
                tokens.push(currentToken);
                currentToken = '';
            } else if (inQuotes) {
                // Inside quoted string - add character without validation
                currentToken += char;
            } else if (char === ' ' || char === '\t') {
                // Whitespace outside quotes
                if (currentToken.trim()) {
                    tokens.push(currentToken.trim());
                    currentToken = '';
                }
            } else if (char === ',') {
                // Comma separator - split identifiers
                if (currentToken.trim()) {
                    tokens.push(currentToken.trim());
                    currentToken = '';
                }
                // Don't add comma as a token, just use it as separator
            } else {
                // Regular character outside quotes
                currentToken += char;
            }
        }
        
        // Add any remaining token
        if (currentToken.trim()) {
            tokens.push(currentToken.trim());
        }
        
        return tokens;
    }

    private isPropertyKeyword(fileExtension: string, keyword: string): boolean {
        const keywordType = SylangKeywordManager.getKeywordType(fileExtension, keyword);
        const result = keywordType === KeywordType.PROPERTY || 
               keywordType === KeywordType.ENUM || 
               keywordType === KeywordType.RELATION;
               
        // Add extensive logging for assignedto debugging
        if (keyword === 'assignedto') {
            this.logger.info(`🔍 [VALIDATION v${getVersionedLogger('DEBUG')}] Checking assignedto keyword:`);
            this.logger.info(`  - File extension: ${fileExtension}`);
            this.logger.info(`  - Keyword type returned: ${keywordType}`);
            this.logger.info(`  - Is RELATION? ${keywordType === KeywordType.RELATION}`);
            this.logger.info(`  - Final result: ${result}`);
        }
               
        return result;
    }

    private isValidIdentifier(identifier: string): boolean {
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
    }

    private validateExternalIdentifierUsage(tokens: string[], errors: ValidationError[], originalLineIndex: number, line: string, fileUri: vscode.Uri): void {
        // Check if property values reference external identifiers without 'ref' keyword
        if (tokens.length < 2) return;

        const propertyName = tokens[0];
        const propertyValues = tokens.slice(1);

        // Skip if this is a 'ref' statement (already handled separately)
        if (propertyName === 'ref') return;
        
        // Skip if this statement contains 'ref' keyword (e.g., "listedfor ref productline BloodPressureProductLine")
        if (tokens.includes('ref')) return;

        // Check each property value to see if it's an external identifier
        for (let i = 0; i < propertyValues.length; i++) {
            const value = propertyValues[i];
            
            // Skip string literals (quoted values)
            if (value.startsWith('"') && value.endsWith('"')) continue;
            
            // Skip numeric values and known enum values
            if (this.isNumericOrEnumValue(value)) continue;

            // Check if this looks like an identifier and if it's external
            if (this.isValidIdentifier(value)) {
                const isExternalIdentifier = this.isExternalIdentifier(value, fileUri);
                
                if (isExternalIdentifier) {
                    errors.push({
                        message: `External identifier '${value}' must be used with 'ref' keyword. Use 'ref <type> ${value}' instead.`,
                        severity: vscode.DiagnosticSeverity.Error,
                        line: originalLineIndex,
                        column: line.indexOf(value),
                        length: value.length,
                        code: 'SYLANG_EXTERNAL_ID_WITHOUT_REF'
                    });
                }
            }
        }
    }

    private isNumericOrEnumValue(value: string): boolean {
        // Check if it's a number
        if (!isNaN(parseInt(value))) return true;
        
        // Check if it's a known enum value
        for (const enumDef of SYLANG_ENUMS) {
            if (enumDef.values.includes(value)) return true;
        }
        
        return false;
    }

        private isExternalIdentifier(identifier: string, fileUri: vscode.Uri): boolean {
        // Check if this identifier exists in the current file
        const documentSymbols = this.symbolManager.getDocumentSymbols(fileUri);
        if (!documentSymbols) return false;

        // Check if it's defined in the current file
        if (documentSymbols.headerSymbol?.name === identifier) return false;
        
        for (const symbol of documentSymbols.definitionSymbols) {
            if (symbol.name === identifier) return false;
        }

        // Check if it exists in other files (making it external)
        const externalSymbol = this.findExternalSymbol(identifier, fileUri);
        return externalSymbol !== undefined;
    }

     private findExternalSymbol(identifier: string, fileUri: vscode.Uri): SylangSymbol | undefined {
         // Look for the symbol in all other files (including disabled symbols)
         const allSymbolsRaw = this.symbolManager.getAllSymbolsRaw();
         this.logger.debug(`Looking for external symbol '${identifier}'. Total symbols in project: ${allSymbolsRaw.length}`);
         
         const foundSymbol = allSymbolsRaw.find(symbol => 
             symbol.name === identifier && symbol.fileUri.fsPath !== fileUri.fsPath
         );
         
         if (foundSymbol) {
             // Check if the symbol is visible (not disabled)
             const allVisibleSymbols = this.symbolManager.getAllSymbols();
             const isVisible = allVisibleSymbols.some(visible => 
                 visible.name === foundSymbol.name && visible.fileUri.fsPath === foundSymbol.fileUri.fsPath
             );
             this.logger.debug(`External symbol '${identifier}': ${isVisible ? 'FOUND and VISIBLE' : 'FOUND but DISABLED'}`);
         } else {
             this.logger.debug(`External symbol search result for '${identifier}': NOT FOUND`);
         }
         
         return foundSymbol;
     }

    // Autocomplete support
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
        const completionItems: vscode.CompletionItem[] = [];
        const fileExtension = path.extname(document.fileName);
        const line = document.lineAt(position.line).text;
        const linePrefix = line.substring(0, position.character);
        
        // Get allowed keywords for this file type
        const allowedKeywords = SylangKeywordManager.getAllowedKeywords(fileExtension);
        
        // Add keyword completions
        for (const keyword of allowedKeywords) {
            const completionItem = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            completionItem.detail = `Sylang keyword for ${fileExtension} files`;
            completionItems.push(completionItem);
        }

        // Add enum value completions
        for (const enumDef of SYLANG_ENUMS) {
            if (linePrefix.includes(enumDef.name)) {
                for (const value of enumDef.values) {
                    const completionItem = new vscode.CompletionItem(value, vscode.CompletionItemKind.EnumMember);
                    completionItem.detail = enumDef.description;
                    completionItems.push(completionItem);
                }
            }
        }

        // Extension keywords removed - core keywords only
        
        return completionItems;
    }

    // Go to Definition support
    provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.Definition | undefined {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }
        
        const identifier = document.getText(wordRange);
        const symbol = this.symbolManager.resolveSymbol(identifier, document.uri);
        
        if (symbol) {
            return new vscode.Location(symbol.fileUri, new vscode.Position(symbol.line, symbol.column));
        }
        
        return undefined;
    }

    // Go to References support
    provideReferences(document: vscode.TextDocument, position: vscode.Position, _context: vscode.ReferenceContext): vscode.Location[] {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            this.logger.debug('🔍 REFERENCES: No word range at position');
            return [];
        }
        
        const identifier = document.getText(wordRange);
        this.logger.debug(`🔍 REFERENCES: Looking for references to '${identifier}'`);
        const references: vscode.Location[] = [];
        
        // Get all symbols to find references
        const allSymbols = this.symbolManager.getAllSymbolsRaw();
        this.logger.debug(`🔍 REFERENCES: Searching through ${allSymbols.length} symbols`);
        
        // Find the definition of this identifier
        const definition = allSymbols.find(s => s.name === identifier);
        if (definition) {
            this.logger.debug(`🔍 REFERENCES: Found definition at ${definition.fileUri.fsPath}:${definition.line}`);
            references.push(new vscode.Location(definition.fileUri, new vscode.Position(definition.line, definition.column)));
        } else {
            this.logger.debug(`🔍 REFERENCES: No definition found for '${identifier}'`);
        }
        
        // Find all references to this identifier across all files
        for (const symbol of allSymbols) {
            // Check properties that reference this identifier
            for (const [propertyName, propertyValues] of symbol.properties) {
                // Check for direct value matches
                if (propertyValues.includes(identifier)) {
                    this.logger.debug(`🔍 REFERENCES: Found reference in ${symbol.fileUri.fsPath}:${symbol.line} property '${propertyName}'`);
                    references.push(new vscode.Location(symbol.fileUri, new vscode.Position(symbol.line, symbol.column)));
                    break;
                }
                
                // Check for relationship references like "enables ref feature Identifier"
                // Property values are stored as arrays, e.g., ["ref", "feature", "SomeIdentifier"]
                const refIndex = propertyValues.indexOf('ref');
                if (refIndex !== -1 && refIndex + 2 < propertyValues.length) {
                    const referencedIdentifier = propertyValues[refIndex + 2];
                    if (referencedIdentifier === identifier) {
                        this.logger.debug(`🔍 REFERENCES: Found relation reference in ${symbol.fileUri.fsPath}:${symbol.line} property '${propertyName}' -> ${referencedIdentifier}`);
                        references.push(new vscode.Location(symbol.fileUri, new vscode.Position(symbol.line, symbol.column)));
                        break;
                    }
                }
                
                // Check for multi-identifier references like "enables ref feature Id1, Id2, Id3"
                for (let i = 0; i < propertyValues.length; i++) {
                    const value = propertyValues[i];
                    if (value.includes(',')) {
                        const identifiers = value.split(',').map(id => id.trim());
                        if (identifiers.includes(identifier)) {
                            this.logger.debug(`🔍 REFERENCES: Found multi-ref in ${symbol.fileUri.fsPath}:${symbol.line} property '${propertyName}' -> ${identifier}`);
                            references.push(new vscode.Location(symbol.fileUri, new vscode.Position(symbol.line, symbol.column)));
                            break;
                        }
                    }
                }
            }
        }
        
        // Remove duplicates (same file and line)
        const uniqueReferences = references.filter((ref, index, self) => 
            index === self.findIndex(r => 
                r.uri.fsPath === ref.uri.fsPath && 
                r.range.start.line === ref.range.start.line &&
                r.range.start.character === ref.range.start.character
            )
        );
        
        this.logger.debug(`🔍 REFERENCES: Found ${uniqueReferences.length} unique references for '${identifier}'`);
        return uniqueReferences;
    }

    // Hover support
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }
        
        const identifier = document.getText(wordRange);
        const symbol = this.symbolManager.resolveSymbol(identifier, document.uri);
        
        if (symbol) {
            const contents = new vscode.MarkdownString();
            contents.appendMarkdown(`**${symbol.kind}**: ${symbol.name}\n\n`);
            
            if (symbol.properties.has('description')) {
                const description = symbol.properties.get('description')?.[0];
                if (description) {
                    contents.appendMarkdown(`*${description}*\n\n`);
                }
            }
            
            contents.appendMarkdown(`**File**: ${symbol.fileUri.fsPath}\n`);
            contents.appendMarkdown(`**Line**: ${symbol.line + 1}\n`);
            
            if (symbol.properties.has('owner')) {
                const owner = symbol.properties.get('owner')?.[0];
                if (owner) {
                    contents.appendMarkdown(`**Owner**: ${owner}\n`);
                }
            }
            
            return new vscode.Hover(contents, wordRange);
        }
        
        return undefined;
    }

    // Document symbols support
    provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
        const symbols: vscode.DocumentSymbol[] = [];
        const documentSymbols = this.symbolManager.getDocumentSymbols(document.uri);
        
        if (!documentSymbols) {
            return symbols;
        }
        
        // Add header symbol
        if (documentSymbols.headerSymbol) {
            const headerSymbol = new vscode.DocumentSymbol(
                documentSymbols.headerSymbol.name,
                documentSymbols.headerSymbol.kind,
                vscode.SymbolKind.Class,
                new vscode.Range(
                    new vscode.Position(documentSymbols.headerSymbol.line, documentSymbols.headerSymbol.column),
                    new vscode.Position(documentSymbols.headerSymbol.line, documentSymbols.headerSymbol.column + documentSymbols.headerSymbol.name.length)
                ),
                new vscode.Range(
                    new vscode.Position(documentSymbols.headerSymbol.line, documentSymbols.headerSymbol.column),
                    new vscode.Position(documentSymbols.headerSymbol.line, documentSymbols.headerSymbol.column + documentSymbols.headerSymbol.name.length)
                )
            );
            symbols.push(headerSymbol);
        }
        
        // Add definition symbols
        for (const symbol of documentSymbols.definitionSymbols) {
            const definitionSymbol = new vscode.DocumentSymbol(
                symbol.name,
                symbol.kind,
                vscode.SymbolKind.Field,
                new vscode.Range(
                    new vscode.Position(symbol.line, symbol.column),
                    new vscode.Position(symbol.line, symbol.column + symbol.name.length)
                ),
                new vscode.Range(
                    new vscode.Position(symbol.line, symbol.column),
                    new vscode.Position(symbol.line, symbol.column + symbol.name.length)
                )
            );
            symbols.push(definitionSymbol);
        }
        
        return symbols;
    }

    reloadSymbols(): void {
        this.logger.info(`🔧 ${getVersionedLogger('VALIDATION ENGINE')} - Reloading symbols after extension changes`);
        // Trigger re-validation of all open documents
        vscode.workspace.textDocuments.forEach(document => {
            if (document.fileName.match(/\.(ple|blk|fun|req|tst|fml|vml|vcf)$/)) {
                this.validateDocument(document.uri);
            }
        });
    }

    // GLOBAL STARTUP VALIDATION: Validate all Sylang files in workspace (Fix 3)
    async validateAllFiles(): Promise<void> {
        this.logger.info(`🔧 ${getVersionedLogger('VALIDATION ENGINE')} - Starting global project validation...`);
        
        // Clear global identifiers before full validation
        this.symbolManager.clearGlobalIdentifiers();
        
        try {
            // Find all Sylang files in workspace
            const sylangFiles = await vscode.workspace.findFiles(
                '**/*.{ple,fml,vml,vcf,blk,fun,req,tst,spr,agt}',
                '**/node_modules/**' // Exclude node_modules
            );
            
            this.logger.info(`🔧 ${getVersionedLogger('VALIDATION ENGINE')} - Found ${sylangFiles.length} Sylang files to validate`);
            
            // Validate each file
            for (const fileUri of sylangFiles) {
                try {
                    await this.validateDocument(fileUri);
                    this.logger.debug(`✅ Validated: ${fileUri.fsPath}`);
                } catch (error) {
                    this.logger.error(`❌ Validation failed for ${fileUri.fsPath}: ${error}`);
                }
            }
            
            this.logger.info(`🔧 ${getVersionedLogger('VALIDATION ENGINE')} - Global project validation completed for ${sylangFiles.length} files`);
        } catch (error) {
            this.logger.error(`🔧 ${getVersionedLogger('VALIDATION ENGINE')} - Global validation failed: ${error}`);
        }
    }

         dispose(): void {
         this.logger.debug('Validation engine disposed');
     }

    /**
     * Process line continuations using backslash (\) at end of lines
     * Returns processed lines and mapping back to original line numbers
     */
    private processLineContinuations(rawLines: string[]): { processedLines: string[], lineMapping: number[] } {
        const processedLines: string[] = [];
        const lineMapping: number[] = [];
        
        for (let i = 0; i < rawLines.length; i++) {
            let currentLine = rawLines[i];
            let originalLineIndex = i;
            
            // Check if this line ends with backslash (with optional whitespace)
            while (i < rawLines.length && /\\\s*$/.test(currentLine)) {
                // Remove the backslash and any trailing whitespace
                currentLine = currentLine.replace(/\\\s*$/, '');
                i++; // Move to next line
                
                if (i < rawLines.length) {
                    // Append the next line (preserving its leading whitespace for proper continuation)
                    const nextLine = rawLines[i];
                    // Add a space if the current line doesn't end with whitespace and next line doesn't start with whitespace
                    const needsSpace = !/\s$/.test(currentLine) && !/^\s/.test(nextLine);
                    currentLine += (needsSpace ? ' ' : '') + nextLine;
                }
            }
            
            processedLines.push(currentLine);
            lineMapping.push(originalLineIndex);
        }
        
        this.logger.debug(`🔧 [VALIDATION v${SYLANG_VERSION}] Processed ${rawLines.length} raw lines into ${processedLines.length} processed lines`);
        
        return { processedLines, lineMapping };
    }
} 