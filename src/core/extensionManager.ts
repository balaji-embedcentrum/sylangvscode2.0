import * as path from 'path';
import { Keyword, KeywordType, EnumDefinition } from './keywords';
import { SylangExtensionParser, FileExtension } from './extensionParser';
import { SylangLogger } from './logger';
import { getVersionedLogger } from './version';

export class SylangExtensionManager {
    private extensions: Map<string, FileExtension> | null = null;
    private parser: SylangExtensionParser;
    private logger: SylangLogger;
    private workspaceRoot: string | undefined;

    // Core cardinality mappings (preserving existing behavior)
    private readonly CORE_PROPERTY_CARDINALITY = new Map<string, 'single' | 'multiple'>([
        // Single value properties
        ['name', 'single'],
        ['description', 'single'],
        ['owner', 'single'],
        ['designrationale', 'single'],
        ['rationale', 'single'],
        ['verificationcriteria', 'single'],
        ['setup', 'single'],
        ['expected', 'single'],
        ['passcriteria', 'single'],
        
        // Multiple value properties
        ['tags', 'multiple'],
        ['domain', 'multiple'],
        ['compliance', 'multiple'],
        ['region', 'multiple']
    ]);

    private readonly CORE_RELATION_CARDINALITY = new Map<string, 'single' | 'multiple'>([
        // Single identifier relations
        ['listedfor', 'single'],
        ['generatedfrom', 'single'],
        ['allocatedto', 'single'],
        ['extends', 'single'],
        ['inherits', 'single'],
        
        // Multiple identifier relations
        ['requires', 'multiple'],
        ['excludes', 'multiple'],
        ['composedof', 'multiple'],
        ['enables', 'multiple'],
        ['needs', 'multiple']
    ]);

    constructor(logger: SylangLogger) {
        this.logger = logger;
        this.parser = new SylangExtensionParser(logger);
    }

    /**
     * Initialize the extension manager with workspace root
     */
    initialize(workspaceRoot: string | undefined): void {
        this.workspaceRoot = workspaceRoot;
        this.loadExtensions();
    }

    /**
     * Load extensions from .sylangconfig file
     */
    loadExtensions(): void {
        if (!this.workspaceRoot) {
            this.logger.info(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - No workspace root, extensions disabled`);
            return;
        }

        const configPath = path.join(this.workspaceRoot, '.sylangextend');
        this.extensions = this.parser.parseExtensionFile(configPath);
        
        if (this.extensions) {
            const validationErrors = this.parser.validateExtensions(this.extensions);
            if (validationErrors.length > 0) {
                this.logger.warn(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - Found ${validationErrors.length} validation issues in .sylangextend`);
                validationErrors.forEach(error => {
                    if (error.severity === 'error') {
                        this.logger.error(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - ${error.message}`);
                    } else {
                        this.logger.warn(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - ${error.message}`);
                    }
                });
            }
            
            this.logger.info(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - Extensions loaded successfully for ${this.extensions.size} file types`);
        } else {
            this.logger.info(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - No extensions loaded, using core keywords only`);
        }
    }

    /**
     * Check if extensions are available
     */
    hasExtensions(): boolean {
        return this.extensions !== null && this.extensions.size > 0;
    }

    /**
     * Get extended keywords for a specific file type (non-breaking)
     */
    extendKeywords(baseKeywords: Keyword[], fileType: string): Keyword[] {
        // Fallback to existing behavior if no extensions
        if (!this.extensions) {
            return baseKeywords;
        }

        const extension = this.extensions.get(fileType);
        if (!extension) {
            return baseKeywords;
        }

        let extended: Keyword[];
        
        // NEW: For new file types, start with core keywords instead of baseKeywords
        if (extension.isNewFileType && extension.headerKeyword) {
            extended = this.getCoreKeywordsForNewFileType(extension.headerKeyword);
            this.logger.info(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - Creating new file type ${fileType} with core keywords and header '${extension.headerKeyword}'`);
        } else {
            extended = [...baseKeywords]; // Copy existing keywords for extensions
            this.logger.debug(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - Extending keywords for ${fileType}`);
        }

        // Add custom properties
        extension.properties.forEach(prop => {
            extended.push({
                name: prop.name,
                type: KeywordType.PROPERTY,
                description: `Custom property: ${prop.name} (${prop.cardinality})`,
                allowMultiple: prop.cardinality === 'multiple',
                isExtension: true
            });
            this.logger.debug(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - Added property: ${prop.name}`);
        });

        // Add custom relations
        extension.relations.forEach(rel => {
            extended.push({
                name: rel.relationName,
                type: KeywordType.RELATION,
                description: `Custom relation: ${rel.relationName} → ${rel.targetType} (${rel.cardinality})`,
                allowMultiple: rel.cardinality === 'multiple',
                isExtension: true
            });
            this.logger.debug(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - Added relation: ${rel.relationName}`);
        });

        this.logger.info(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - ${extension.isNewFileType ? 'Created' : 'Extended'} ${fileType} with ${extension.properties.length} properties and ${extension.relations.length} relations`);
        return extended;
    }

    /**
     * Get core keywords that every Sylang file type needs
     */
    private getCoreKeywordsForNewFileType(headerKeyword: string): Keyword[] {
        return [
            // Core structural keywords
            { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
            { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition', required: true },
            { name: headerKeyword, type: KeywordType.HEADER_DEFINITION, description: `${headerKeyword} identifier` },
            
            // Core properties
            { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', supportsMultiLine: true },
            { name: 'description', type: KeywordType.PROPERTY, description: 'Description property', supportsMultiLine: true },
            { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
            { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
            
            // Core definition keyword
            { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
            
            // Core enums
            { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
            
            // Core references
            { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
            { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' },
            { name: 'when', type: KeywordType.RELATION, description: 'When relation for conditional config references' },
            { name: 'configset', type: KeywordType.REFERENCE, description: 'Config set reference' }
        ];
    }

    /**
     * Get extended enums for a specific file type
     */
    getExtendedEnums(baseEnums: EnumDefinition[], fileType: string): EnumDefinition[] {
        if (!this.extensions) {
            return baseEnums;
        }

        const extension = this.extensions.get(fileType);
        if (!extension) {
            return baseEnums;
        }

        const extended = [...baseEnums];
        
        extension.enums.forEach(enumExt => {
            extended.push({
                name: enumExt.name,
                values: enumExt.values,
                description: `Custom enum: ${enumExt.name}`,
                isExtension: true
            });
            this.logger.debug(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - Added enum: ${enumExt.name} with ${enumExt.values.length} values`);
        });

        return extended;
    }

    /**
     * Get property cardinality (core + extensions)
     */
    getPropertyCardinality(propertyName: string, fileType: string): 'single' | 'multiple' | null {
        // Check core properties first
        const coreCardinality = this.CORE_PROPERTY_CARDINALITY.get(propertyName);
        if (coreCardinality) {
            return coreCardinality;
        }

        // Check extensions
        if (this.extensions) {
            const extension = this.extensions.get(fileType);
            if (extension) {
                const extProperty = extension.properties.find(p => p.name === propertyName);
                if (extProperty) {
                    return extProperty.cardinality;
                }
            }
        }

        return null; // Unknown property
    }

    /**
     * Get relation cardinality (core + extensions)
     */
    getRelationCardinality(relationName: string, targetType: string, fileType: string): 'single' | 'multiple' | null {
        // Check core relations first (simplified - just by relation name for now)
        const coreCardinality = this.CORE_RELATION_CARDINALITY.get(relationName);
        if (coreCardinality) {
            return coreCardinality;
        }

        // Check extensions
        if (this.extensions) {
            const extension = this.extensions.get(fileType);
            if (extension) {
                const extRelation = extension.relations.find(r => 
                    r.relationName === relationName && r.targetType === targetType
                );
                if (extRelation) {
                    return extRelation.cardinality;
                }
            }
        }

        return null; // Unknown relation
    }

    /**
     * Check if a property is from core Sylang
     */
    isCoreProperty(propertyName: string): boolean {
        return this.CORE_PROPERTY_CARDINALITY.has(propertyName);
    }

    /**
     * Check if a relation is from core Sylang
     */
    isCoreRelation(relationName: string): boolean {
        return this.CORE_RELATION_CARDINALITY.has(relationName);
    }

    /**
     * Get all extended syntax for syntax highlighting
     */
    getAllExtendedSyntax(fileType: string): { properties: string[], relations: string[] } {
        if (!this.extensions) {
            return { properties: [], relations: [] };
        }

        const extension = this.extensions.get(fileType);
        if (!extension) {
            return { properties: [], relations: [] };
        }

        return {
            properties: extension.properties.map(p => p.name),
            relations: extension.relations.map(r => r.relationName)
        };
    }

    /**
     * Reload extensions (for real-time updates)
     */
    reloadExtensions(): void {
        this.logger.info(`🔧 ${getVersionedLogger('EXTENSION MANAGER')} - Reloading extensions`);
        this.loadExtensions();
    }

    /**
     * Get extension information for debugging
     */
    getExtensionInfo(): string {
        if (!this.extensions) {
            return "No extensions loaded";
        }

        const info: string[] = [`Extensions loaded for ${this.extensions.size} file types:`];
        
        for (const [fileType, extension] of this.extensions) {
            info.push(`  ${fileType}: ${extension.properties.length} properties, ${extension.relations.length} relations, ${extension.enums.length} enums`);
        }

        return info.join('\n');
    }
} 