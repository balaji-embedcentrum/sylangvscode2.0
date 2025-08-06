import * as fs from 'fs';
import { SylangLogger } from './logger';
import { getVersionedLogger } from './version';

export interface PropertyExtension {
    name: string;
    cardinality: 'single' | 'multiple';
}

export interface RelationExtension {
    relationName: string;
    targetType: string;
    cardinality: 'single' | 'multiple';
}

export interface EnumExtension {
    name: string;
    values: string[];
}

export interface FileExtension {
    targetFile: string;
    properties: PropertyExtension[];
    relations: RelationExtension[];
    enums: EnumExtension[];
}

export interface ValidationError {
    message: string;
    severity: 'error' | 'warning';
    line?: number;
}

export class SylangExtensionParser {
    private logger: SylangLogger;

    constructor(logger: SylangLogger) {
        this.logger = logger;
    }

    parseExtensionFile(configPath: string): Map<string, FileExtension> | null {
        try {
            if (!fs.existsSync(configPath)) {
                this.logger.info(`🔧 ${getVersionedLogger('EXTENSION PARSER')} - No .sylangextend found at ${configPath}`);
                return null;
            }

            const content = fs.readFileSync(configPath, 'utf8');
            this.logger.info(`🔧 ${getVersionedLogger('EXTENSION PARSER')} - Parsing .sylangextend file`);
            
            return this.parseExtensions(content);
        } catch (error) {
            this.logger.error(`🔧 ${getVersionedLogger('EXTENSION PARSER')} - Error reading .sylangextend: ${error}`);
            return null;
        }
    }

    parseExtensions(configContent: string): Map<string, FileExtension> {
        const extensions = new Map<string, FileExtension>();
        const lines = configContent.split('\n');
        
        let currentFileType: string | null = null;
        let currentExtension: FileExtension | null = null;
        let lineNumber = 0;

        for (const line of lines) {
            lineNumber++;
            const trimmed = line.trim();
            
            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('//')) {
                continue;
            }

            if (trimmed.startsWith('extend file ')) {
                // Save previous extension
                if (currentFileType && currentExtension) {
                    extensions.set(currentFileType, currentExtension);
                    this.logger.info(`🔧 ${getVersionedLogger('EXTENSION PARSER')} - Processed extensions for ${currentFileType}: ${currentExtension.properties.length} properties, ${currentExtension.relations.length} relations, ${currentExtension.enums.length} enums`);
                }
                
                // Start new extension
                const parts = trimmed.split(' ');
                if (parts.length >= 3) {
                    currentFileType = parts[2]; // ".blk"
                    currentExtension = {
                        targetFile: currentFileType,
                        properties: [],
                        relations: [],
                        enums: []
                    };
                    this.logger.info(`🔧 ${getVersionedLogger('EXTENSION PARSER')} - Starting extension definition for ${currentFileType}`);
                }
            } else if (currentExtension && trimmed.startsWith('def property ')) {
                const parts = trimmed.split(' ');
                if (parts.length >= 4) {
                    const propertyName = parts[2];
                    const cardinality = parts[3] as 'single' | 'multiple';
                    
                    if (cardinality === 'single' || cardinality === 'multiple') {
                        currentExtension.properties.push({
                            name: propertyName,
                            cardinality
                        });
                        this.logger.debug(`🔧 ${getVersionedLogger('EXTENSION PARSER')} - Added property: ${propertyName} (${cardinality})`);
                    } else {
                        this.logger.error(`🔧 ${getVersionedLogger('EXTENSION PARSER')} - Invalid cardinality '${cardinality}' for property '${propertyName}' at line ${lineNumber}`);
                    }
                }
            } else if (currentExtension && trimmed.startsWith('def relation ')) {
                const parts = trimmed.split(' ');
                if (parts.length >= 5) {
                    const relationName = parts[2];
                    const targetType = parts[3];
                    const cardinality = parts[4] as 'single' | 'multiple';
                    
                    if (cardinality === 'single' || cardinality === 'multiple') {
                        currentExtension.relations.push({
                            relationName,
                            targetType,
                            cardinality
                        });
                        this.logger.debug(`🔧 ${getVersionedLogger('EXTENSION PARSER')} - Added relation: ${relationName} ${targetType} (${cardinality})`);
                    } else {
                        this.logger.error(`🔧 ${getVersionedLogger('EXTENSION PARSER')} - Invalid cardinality '${cardinality}' for relation '${relationName} ${targetType}' at line ${lineNumber}`);
                    }
                }
            } else if (currentExtension && trimmed.startsWith('def enum ')) {
                const parts = trimmed.split(' ');
                if (parts.length >= 4) {
                    const enumName = parts[2];
                    const values = parts.slice(3); // Rest are enum values
                    currentExtension.enums.push({
                        name: enumName,
                        values
                    });
                    this.logger.debug(`🔧 ${getVersionedLogger('EXTENSION PARSER')} - Added enum: ${enumName} with values [${values.join(', ')}]`);
                }
            }
        }

        // Save final extension
        if (currentFileType && currentExtension) {
            extensions.set(currentFileType, currentExtension);
            this.logger.info(`🔧 ${getVersionedLogger('EXTENSION PARSER')} - Processed extensions for ${currentFileType}: ${currentExtension.properties.length} properties, ${currentExtension.relations.length} relations, ${currentExtension.enums.length} enums`);
        }

        this.logger.info(`🔧 ${getVersionedLogger('EXTENSION PARSER')} - Completed parsing. Found extensions for ${extensions.size} file types`);
        return extensions;
    }

    validateExtensions(extensions: Map<string, FileExtension>): ValidationError[] {
        const errors: ValidationError[] = [];
        const globalProperties = new Set<string>();
        const globalRelations = new Set<string>(); // "relationName:targetType"

        this.logger.info(`🔧 ${getVersionedLogger('EXTENSION VALIDATOR')} - Starting validation of extensions`);

        for (const [fileType, extension] of extensions) {
            // Check property duplicates
            const fileProperties = new Set<string>();
            for (const prop of extension.properties) {
                const propKey = prop.name;
                
                if (fileProperties.has(propKey)) {
                    errors.push({
                        message: `Duplicate property '${propKey}' in ${fileType} extensions`,
                        severity: 'error'
                    });
                    this.logger.error(`🔧 ${getVersionedLogger('EXTENSION VALIDATOR')} - Duplicate property '${propKey}' in ${fileType}`);
                }
                
                if (globalProperties.has(propKey)) {
                    errors.push({
                        message: `Property '${propKey}' already defined in another file type`,
                        severity: 'warning'
                    });
                    this.logger.warn(`🔧 ${getVersionedLogger('EXTENSION VALIDATOR')} - Property '${propKey}' redefined across file types`);
                }
                
                fileProperties.add(propKey);
                globalProperties.add(propKey);
            }
            
            // Check relation duplicates
            const fileRelations = new Set<string>();
            for (const rel of extension.relations) {
                const relationKey = `${rel.relationName}:${rel.targetType}`;
                
                if (fileRelations.has(relationKey)) {
                    errors.push({
                        message: `Duplicate relation '${rel.relationName} ${rel.targetType}' in ${fileType} extensions`,
                        severity: 'error'
                    });
                    this.logger.error(`🔧 ${getVersionedLogger('EXTENSION VALIDATOR')} - Duplicate relation '${relationKey}' in ${fileType}`);
                }
                
                fileRelations.add(relationKey);
                globalRelations.add(relationKey);
            }
        }

        this.logger.info(`🔧 ${getVersionedLogger('EXTENSION VALIDATOR')} - Validation completed with ${errors.length} issues`);
        return errors;
    }
} 