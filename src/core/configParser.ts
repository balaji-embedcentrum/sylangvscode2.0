import * as fs from 'fs';
import { SylangLogger } from './logger';
import { getVersionedLogger } from './version';

export interface ProjectConfig {
    project?: {
        name?: string;
        version?: string;
        owner?: string;
        domain?: string[];
    };
    validation?: {
        strictmode?: boolean;
        warnings?: 'errors' | 'warnings' | 'ignore';
        checkimports?: boolean;
        checkunused?: boolean;
    };
    generation?: {
        autovcf?: boolean;
        autovml?: boolean;
        templates?: string;
    };
    tools?: {
        simulink?: boolean;
        matlab?: boolean;
        modelica?: boolean;
    };
    formatting?: {
        indentation?: number;
        maxlinewidth?: number;
        enforcestyle?: boolean;
    };
    ide?: {
        showtooltips?: boolean;
        autocomplete?: boolean;
        syntaxtheme?: string;
    };
    logging?: {
        level?: 'debug' | 'info' | 'warn' | 'error';
        file?: string;
        console?: boolean;
    };
}

export interface ConfigValidationError {
    message: string;
    severity: 'error' | 'warning';
    line?: number;
}

export class SylangConfigParser {
    private logger: SylangLogger;

    constructor(logger: SylangLogger) {
        this.logger = logger;
    }

    parseConfigFile(configPath: string): ProjectConfig | null {
        try {
            if (!fs.existsSync(configPath)) {
                this.logger.info(`🔧 ${getVersionedLogger('CONFIG PARSER')} - No .sylangconfig found at ${configPath}`);
                return null;
            }

            const content = fs.readFileSync(configPath, 'utf8');
            this.logger.info(`🔧 ${getVersionedLogger('CONFIG PARSER')} - Parsing .sylangconfig file`);
            
            return this.parseConfig(content);
        } catch (error) {
            this.logger.error(`🔧 ${getVersionedLogger('CONFIG PARSER')} - Error reading .sylangconfig: ${error}`);
            return null;
        }
    }

    parseConfig(configContent: string): ProjectConfig {
        const config: ProjectConfig = {};
        const lines = configContent.split('\n');
        
        let currentSection: string | null = null;
        let lineNumber = 0;

        this.logger.info(`🔧 ${getVersionedLogger('CONFIG PARSER')} - Parsing ${lines.length} lines from .sylangconfig`);

        for (const line of lines) {
            lineNumber++;
            const trimmed = line.trim();
            
            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('//')) {
                continue;
            }

            // Check for hdef (only one per file)
            if (trimmed.startsWith('hdef ') && trimmed.includes('config')) {
                this.logger.debug(`🔧 ${getVersionedLogger('CONFIG PARSER')} - Found hdef config header`);
                continue; // Skip the hdef line, we'll parse sections below
            }
            
            // Check for section headers (no indentation)
            if (!trimmed.startsWith(' ') && !trimmed.startsWith('\t') && !trimmed.startsWith('def ')) {
                currentSection = trimmed; // Section name like "project", "validation", etc.
                this.logger.debug(`🔧 ${getVersionedLogger('CONFIG PARSER')} - Found config section: ${currentSection}`);
                
                // Initialize section in config
                switch (currentSection) {
                    case 'project':
                        config.project = {};
                        break;
                    case 'validation':
                        config.validation = {};
                        break;
                    case 'generation':
                        config.generation = {};
                        break;
                    case 'tools':
                        config.tools = {};
                        break;
                    case 'formatting':
                        config.formatting = {};
                        break;
                    case 'ide':
                        config.ide = {};
                        break;
                    case 'logging':
                        config.logging = {};
                        break;
                }
            } else if (currentSection && trimmed.startsWith('def ')) {
                // Parse def property lines (indented under sections)
                this.parseConfigProperty(trimmed, currentSection, config, lineNumber);
            }
        }

        this.logger.info(`🔧 ${getVersionedLogger('CONFIG PARSER')} - Completed parsing. Found ${Object.keys(config).length} config sections`);
        return config;
    }

    private parseConfigProperty(line: string, section: string, config: ProjectConfig, _lineNumber: number): void {
        const tokens = line.trim().split(/\s+/);
        if (tokens.length < 3 || tokens[0] !== 'def') return;

        const propertyName = tokens[1]; // Skip 'def' keyword
        let propertyValue: any = tokens.slice(2).join(' ');

        // Remove quotes if present
        if (propertyValue.startsWith('"') && propertyValue.endsWith('"')) {
            propertyValue = propertyValue.slice(1, -1);
        }

        // Handle multiple values (comma-separated)
        if (propertyValue.includes(',')) {
            propertyValue = propertyValue.split(',').map((v: string) => v.trim().replace(/"/g, ''));
        }

        // Convert string values to appropriate types
        if (propertyValue === 'enabled' || propertyValue === 'true') {
            propertyValue = true;
        } else if (propertyValue === 'disabled' || propertyValue === 'false') {
            propertyValue = false;
        } else if (!isNaN(propertyValue) && !isNaN(parseFloat(propertyValue))) {
            propertyValue = parseFloat(propertyValue);
        }

        // Assign to appropriate section
        switch (section) {
            case 'project':
                if (config.project) {
                    (config.project as any)[propertyName] = propertyValue;
                }
                break;
            case 'validation':
                if (config.validation) {
                    (config.validation as any)[propertyName] = propertyValue;
                }
                break;
            case 'generation':
                if (config.generation) {
                    (config.generation as any)[propertyName] = propertyValue;
                }
                break;
            case 'tools':
                if (config.tools) {
                    (config.tools as any)[propertyName] = propertyValue;
                }
                break;
            case 'formatting':
                if (config.formatting) {
                    (config.formatting as any)[propertyName] = propertyValue;
                }
                break;
            case 'ide':
                if (config.ide) {
                    (config.ide as any)[propertyName] = propertyValue;
                }
                break;
            case 'logging':
                if (config.logging) {
                    (config.logging as any)[propertyName] = propertyValue;
                }
                break;
        }

        this.logger.debug(`🔧 ${getVersionedLogger('CONFIG PARSER')} - Set ${section}.${propertyName} = ${propertyValue}`);
    }

    validateConfig(config: ProjectConfig): ConfigValidationError[] {
        const errors: ConfigValidationError[] = [];

        this.logger.info(`🔧 ${getVersionedLogger('CONFIG VALIDATOR')} - Starting validation of project config`);

        // Validate logging level
        if (config.logging?.level) {
            const validLevels = ['debug', 'info', 'warn', 'error'];
            if (!validLevels.includes(config.logging.level)) {
                errors.push({
                    message: `Invalid logging level '${config.logging.level}'. Valid values: ${validLevels.join(', ')}`,
                    severity: 'error'
                });
            }
        }

        // Validate warnings setting
        if (config.validation?.warnings) {
            const validWarnings = ['errors', 'warnings', 'ignore'];
            if (!validWarnings.includes(config.validation.warnings)) {
                errors.push({
                    message: `Invalid warnings setting '${config.validation.warnings}'. Valid values: ${validWarnings.join(', ')}`,
                    severity: 'error'
                });
            }
        }

        // Validate indentation
        if (config.formatting?.indentation && (config.formatting.indentation < 1 || config.formatting.indentation > 8)) {
            errors.push({
                message: `Invalid indentation '${config.formatting.indentation}'. Must be between 1 and 8`,
                severity: 'warning'
            });
        }

        this.logger.info(`🔧 ${getVersionedLogger('CONFIG VALIDATOR')} - Validation completed with ${errors.length} issues`);
        return errors;
    }
} 