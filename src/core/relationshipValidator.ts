import * as vscode from 'vscode';
import { ValidationError } from './validationEngine';
import { SylangLogger } from './logger';
import { getVersionedLogger } from './version';
import { SylangConfigManager } from './configManager';

export interface RelationshipRule {
    relationKeyword: string;
    allowedTargetTypes: string[];
    description: string;
}

export interface ConfigAwareValidationResult {
    isValid: boolean;
    shouldSkip: boolean;
    reason: 'enabled' | 'consistent_skip' | 'inconsistent_reference' | 'validation_error';
    message?: string;
}

// Relationship validation rules as specified in NewSylang.md
export const RELATIONSHIP_RULES: RelationshipRule[] = [
    {
        relationKeyword: 'listedfor',
        allowedTargetTypes: ['productline'],
        description: 'Listed for relation can only reference productline'
    },
    {
        relationKeyword: 'implements',
        allowedTargetTypes: ['function'],
        description: 'Implements relation can only reference function'
    },
    {
        relationKeyword: 'enables',
        allowedTargetTypes: ['feature'],
        description: 'Enables relation can only reference feature'
    },
    {
        relationKeyword: 'allocatedto',
        allowedTargetTypes: ['block'],
        description: 'Allocated to relation can only reference block'
    },
    {
        relationKeyword: 'derivedfrom',
        allowedTargetTypes: ['requirement'],
        description: 'Derived from relation can only reference requirement'
    },
    {
        relationKeyword: 'satisfies',
        allowedTargetTypes: ['requirement'],
        description: 'Satisfies relation can only reference requirement'
    },
    {
        relationKeyword: 'extends',
        allowedTargetTypes: ['feature'],
        description: 'Extends relation can only reference feature'
    },
    {
        relationKeyword: 'refinedfrom',
        allowedTargetTypes: ['requirement'],
        description: 'Refined from relation can only reference requirement'
    },
    {
        relationKeyword: 'requires',
        allowedTargetTypes: ['feature'],
        description: 'Requires relation can only reference feature'
    },
    {
        relationKeyword: 'excludes',
        allowedTargetTypes: ['feature'],
        description: 'Excludes relation can only reference feature'
    },
    {
        relationKeyword: 'generatedfrom',
        allowedTargetTypes: ['variantset'],
        description: 'Generated from relation can only reference variantset'
    },
    {
        relationKeyword: 'composedof',
        allowedTargetTypes: ['block'],
        description: 'Composed of relation can only reference block'
    },
    {
        relationKeyword: 'needs',
        allowedTargetTypes: ['port'],
        description: 'Needs relation can only reference port'
    },
    {
        relationKeyword: 'when',
        allowedTargetTypes: ['config'],
        description: 'When relation can only reference config'
    },
    {
        relationKeyword: 'inherits',
        allowedTargetTypes: ['featureset', 'variantset', 'configset'],
        description: 'Inherits relation can only reference featureset, variantset, or configset'
    },
    {
        relationKeyword: 'assignedto',
        allowedTargetTypes: ['agent'],
        description: 'Assigned to relation can only reference agent (format: assignedto ref agent AgentName)'
    }
];

export class SylangRelationshipValidator {
    private logger: SylangLogger;
    private configManager: SylangConfigManager;

    constructor(logger: SylangLogger, configManager: SylangConfigManager) {
        this.logger = logger;
        this.configManager = configManager;
    }

    // =================== CONFIG-AWARE VALIDATION ===================

    /**
     * Validates config-aware cross-references between source and target items
     */
    validateConfigAwareReference(
        sourceNodeId: string,
        targetNodeId: string,
        relationKeyword: string
    ): ConfigAwareValidationResult {
        this.logger.debug(`🔗 ${getVersionedLogger('RELATIONSHIP VALIDATOR')} - Validating config-aware reference: ${sourceNodeId} -> ${targetNodeId} (${relationKeyword})`);

        const sourceState = this.configManager.getNodeState(sourceNodeId);
        const targetState = this.configManager.getNodeState(targetNodeId);

        // If either doesn't have config state, treat as enabled (legacy behavior)
        const sourceEnabled = sourceState?.isVisible ?? true;
        const targetEnabled = targetState?.isVisible ?? true;

        this.logger.debug(`🔗 ${getVersionedLogger('RELATIONSHIP VALIDATOR')} - Source enabled: ${sourceEnabled}, Target enabled: ${targetEnabled}`);

        // Config consistency rules
        if (!targetEnabled) {
            if (sourceEnabled) {
                // Enabled item referencing disabled item - WARNING
                const message = `Inconsistent config state: enabled item references disabled item '${targetNodeId}' (disabled by config '${targetState?.configReference}')`;
                this.logger.warn(`🔗 ${getVersionedLogger('RELATIONSHIP VALIDATOR')} - ${message}`);
                return {
                    isValid: false,
                    shouldSkip: false,
                    reason: 'inconsistent_reference',
                    message
                };
            } else {
                // Both disabled - CONSISTENT SKIP
                const message = `Consistent skip: both items disabled by config`;
                this.logger.debug(`🔗 ${getVersionedLogger('RELATIONSHIP VALIDATOR')} - ${message}`);
                return {
                    isValid: true,
                    shouldSkip: true,
                    reason: 'consistent_skip',
                    message
                };
            }
        }

        if (!sourceEnabled && targetEnabled) {
            // Disabled item referencing enabled item - IMPOSSIBLE STATE (should not happen)
            const message = `Invalid state: disabled item '${sourceNodeId}' referencing enabled item '${targetNodeId}'`;
            this.logger.error(`🔗 ${getVersionedLogger('RELATIONSHIP VALIDATOR')} - ${message}`);
            return {
                isValid: false,
                shouldSkip: false,
                reason: 'validation_error',
                message
            };
        }

        // Both enabled - proceed with normal validation
        this.logger.debug(`🔗 ${getVersionedLogger('RELATIONSHIP VALIDATOR')} - Both items enabled, proceeding with normal validation`);
        return {
            isValid: true,
            shouldSkip: false,
            reason: 'enabled'
        };
    }

    /**
     * Enhanced relationship validation with config awareness
     */
    validateConfigAwareRelationshipRule(
        relationKeyword: string,
        targetType: string,
        sourceNodeId: string,
        targetNodeId: string,
        lineIndex: number,
        line: string,
        errors: ValidationError[],
        fileExtension?: string
    ): boolean {
        this.logger.debug(`🔗 ${getVersionedLogger('RELATIONSHIP VALIDATOR')} - Config-aware relationship validation: ${relationKeyword} ${targetType}`);

        // First check config states
        const configResult = this.validateConfigAwareReference(sourceNodeId, targetNodeId, relationKeyword);

        if (configResult.shouldSkip) {
            this.logger.info(`🔗 ${getVersionedLogger('RELATIONSHIP VALIDATOR')} - Skipping validation: ${configResult.message}`);
            return true; // Skip validation but don't report as error
        }

        if (!configResult.isValid) {
            errors.push({
                message: configResult.message || 'Config state validation failed',
                severity: configResult.reason === 'inconsistent_reference' 
                    ? vscode.DiagnosticSeverity.Warning 
                    : vscode.DiagnosticSeverity.Error,
                line: lineIndex,
                column: line.indexOf(relationKeyword),
                length: relationKeyword.length,
                code: 'SYLANG_CONFIG_INCONSISTENT_REFERENCE'
            });
            return false;
        }

        // Proceed with normal relationship validation
        this.validateRelationshipRule(relationKeyword, targetType, lineIndex, line, errors, fileExtension);
        return true;
    }
    
    /**
     * Validates that a relationship keyword is used with the correct target type
     */
    validateRelationshipRule(
        relationKeyword: string, 
        targetType: string, 
        lineIndex: number, 
        line: string,
        errors: ValidationError[],
        fileExtension?: string
    ): void {
        const rule = RELATIONSHIP_RULES.find(r => r.relationKeyword === relationKeyword);
        
        if (!rule) {
            // Unknown relationship keyword
            errors.push({
                message: `Unknown relationship keyword '${relationKeyword}'. Valid relationships: ${RELATIONSHIP_RULES.map(r => r.relationKeyword).join(', ')}`,
                severity: vscode.DiagnosticSeverity.Error,
                line: lineIndex,
                column: line.indexOf(relationKeyword),
                length: relationKeyword.length,
                code: 'SYLANG_UNKNOWN_RELATIONSHIP'
            });
            return;
        }

        // Special validation for 'resolves' - not allowed in high-level files
        if (relationKeyword === 'resolves') {
            const highLevelExtensions = ['.ple', '.fml', '.vml', '.vcf'];
            if (fileExtension && highLevelExtensions.includes(fileExtension)) {
                errors.push({
                    message: `'when ref config' is not allowed in ${fileExtension} files. Use only in implementation files (.blk, .fun, .req, .tst) with 'def' or 'hdef' structures.`,
                    severity: vscode.DiagnosticSeverity.Error,
                    line: lineIndex,
                    column: line.indexOf(relationKeyword),
                    length: relationKeyword.length,
                    code: 'SYLANG_RESOLVES_IN_HIGH_LEVEL_FILE'
                });
                return;
            }
        }

        if (!rule.allowedTargetTypes.includes(targetType)) {
            errors.push({
                message: `Invalid relationship usage. '${relationKeyword}' can only reference ${rule.allowedTargetTypes.join(' or ')}, but found '${targetType}'.`,
                severity: vscode.DiagnosticSeverity.Error,
                line: lineIndex,
                column: line.indexOf(targetType),
                length: targetType.length,
                code: 'SYLANG_INVALID_RELATIONSHIP_TARGET'
            });
        }
    }

    /**
     * Validates that all references (including local ones) use the 'ref' keyword
     */
    validateMandatoryRefKeyword(
        tokens: string[], 
        lineIndex: number, 
        line: string,
        errors: ValidationError[]
    ): void {
        // Skip if already has 'ref' keyword
        if (tokens.includes('ref')) return;

        // Check if this line contains potential identifier references
        // Look for relationship keywords followed by identifiers
        for (let i = 0; i < tokens.length - 1; i++) {
            const token = tokens[i];
            const nextToken = tokens[i + 1];
            
            // Check if this is a relationship keyword followed by what looks like an identifier
            const isRelationshipKeyword = RELATIONSHIP_RULES.some(rule => rule.relationKeyword === token);
            
            if (isRelationshipKeyword && this.looksLikeIdentifier(nextToken)) {
                errors.push({
                    message: `Missing 'ref' keyword. Use '${token} ref <type> ${nextToken}' for any symbol reference.`,
                    severity: vscode.DiagnosticSeverity.Error,
                    line: lineIndex,
                    column: line.indexOf(nextToken),
                    length: nextToken.length,
                    code: 'SYLANG_MISSING_REF_KEYWORD'
                });
            }
        }
    }

    private looksLikeIdentifier(token: string): boolean {
        // Check if token looks like an identifier (not a string literal, number, or keyword)
        if (!token) return false;
        if (token.startsWith('"') && token.endsWith('"')) return false; // String literal
        if (!isNaN(parseInt(token))) return false; // Number
        if (['mandatory', 'optional', 'or', 'alternative', 'selected'].includes(token)) return false; // Flags
        
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token);
    }

    // =================== CONFIG UTILITY METHODS ===================

    /**
     * Generate consistent node ID for config manager
     */
    generateNodeId(fileUri: vscode.Uri, symbolName: string): string {
        return `${fileUri.fsPath}:${symbolName}`;
    }

    /**
     * Check if a file extension supports config awareness
     */
    isConfigAwareFile(fileExtension: string): boolean {
        const exemptFiles = ['.ple', '.fml', '.vml', '.vcf'];
        return !exemptFiles.includes(fileExtension);
    }

    /**
     * Get config manager debugging info
     */
    getConfigDebugInfo(): string {
        const configInfo = this.configManager.getConfigValuesInfo();
        const nodeInfo = this.configManager.getNodeStatesInfo();
        return `Config Debug Info:\n${configInfo}\n${nodeInfo}`;
    }

    /**
     * Log config-aware validation summary
     */
    logValidationSummary(totalValidations: number, skippedValidations: number, errorCount: number): void {
        this.logger.info(`🔗 ${getVersionedLogger('RELATIONSHIP VALIDATOR')} - Validation Summary:`);
        this.logger.info(`  Total validations: ${totalValidations}`);
        this.logger.info(`  Skipped (config disabled): ${skippedValidations}`);
        this.logger.info(`  Errors found: ${errorCount}`);
        this.logger.info(`  Success rate: ${((totalValidations - errorCount) / totalValidations * 100).toFixed(1)}%`);
    }
} 