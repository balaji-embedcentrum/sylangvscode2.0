import * as path from 'path';
import { SylangConfigParser, ProjectConfig } from './configParser';
import { SylangLogger } from './logger';
import { getVersionedLogger } from './version';

// Config-aware node state interfaces
export interface NodeConfigState {
    isVisible: boolean;
    configReference: string | null;
    visibilityReason: 'config_disabled' | 'enabled';
    renderMode: 'normal' | 'grayed' | 'hidden';
}

export interface ConfigValue {
    name: string;
    value: any;
    isEnabled: boolean;
}

export interface ConfigAwareItem {
    id: string;
    type: 'req' | 'fun' | 'tst' | 'blk' | 'spr' | 'agt';
    configState: NodeConfigState;
    level: 'def' | 'hdef';
}

export class SylangConfigManager {
    private config: ProjectConfig | null = null;
    private parser: SylangConfigParser;
    private logger: SylangLogger;
    private workspaceRoot: string | undefined;
    
    // Config value tracking for node visibility
    private configValues: Map<string, ConfigValue> = new Map();
    private nodeStates: Map<string, NodeConfigState> = new Map();
    
    // Reference to symbol manager for parent-child hierarchy lookup
    private symbolManager?: any; // Using any to avoid circular dependency

    constructor(logger: SylangLogger) {
        this.logger = logger;
        this.parser = new SylangConfigParser(logger);
    }
    
    /**
     * Set symbol manager reference for parent-child hierarchy lookup
     */
    setSymbolManager(symbolManager: any): void {
        this.symbolManager = symbolManager;
    }

    /**
     * Initialize the config manager with workspace root
     */
    initialize(workspaceRoot: string | undefined): void {
        this.workspaceRoot = workspaceRoot;
        this.loadConfig();
    }

    /**
     * Load configuration from .sylangconfig file
     */
    loadConfig(): void {
        if (!this.workspaceRoot) {
            this.logger.info(`🔧 ${getVersionedLogger('CONFIG MANAGER')} - No workspace root, config disabled`);
            return;
        }

        const configPath = path.join(this.workspaceRoot, '.sylangconfig');
        this.config = this.parser.parseConfigFile(configPath);
        
        if (this.config) {
            const validationErrors = this.parser.validateConfig(this.config);
            if (validationErrors.length > 0) {
                this.logger.warn(`🔧 ${getVersionedLogger('CONFIG MANAGER')} - Found ${validationErrors.length} validation issues in .sylangconfig`);
                validationErrors.forEach(error => {
                    if (error.severity === 'error') {
                        this.logger.error(`🔧 ${getVersionedLogger('CONFIG MANAGER')} - ${error.message}`);
                    } else {
                        this.logger.warn(`🔧 ${getVersionedLogger('CONFIG MANAGER')} - ${error.message}`);
                    }
                });
            }
            
            this.logger.info(`🔧 ${getVersionedLogger('CONFIG MANAGER')} - Configuration loaded successfully`);
            this.logger.info(`🔧 ${getVersionedLogger('CONFIG MANAGER')} - Project: ${this.config.project?.name || 'Unnamed'} v${this.config.project?.version || 'unversioned'}`);
        } else {
            this.logger.info(`🔧 ${getVersionedLogger('CONFIG MANAGER')} - No configuration loaded, using defaults`);
        }
    }

    /**
     * Check if configuration is available
     */
    hasConfig(): boolean {
        return this.config !== null;
    }

    /**
     * Get project configuration
     */
    getProjectConfig(): ProjectConfig['project'] | undefined {
        return this.config?.project;
    }

    /**
     * Get validation configuration
     */
    getValidationConfig(): ProjectConfig['validation'] | undefined {
        return this.config?.validation;
    }

    /**
     * Get generation configuration
     */
    getGenerationConfig(): ProjectConfig['generation'] | undefined {
        return this.config?.generation;
    }

    /**
     * Get tools configuration
     */
    getToolsConfig(): ProjectConfig['tools'] | undefined {
        return this.config?.tools;
    }

    /**
     * Get formatting configuration
     */
    getFormattingConfig(): ProjectConfig['formatting'] | undefined {
        return this.config?.formatting;
    }

    /**
     * Get IDE configuration
     */
    getIdeConfig(): ProjectConfig['ide'] | undefined {
        return this.config?.ide;
    }

    /**
     * Get logging configuration
     */
    getLoggingConfig(): ProjectConfig['logging'] | undefined {
        return this.config?.logging;
    }

    /**
     * Check if strict mode is enabled
     */
    isStrictModeEnabled(): boolean {
        return this.config?.validation?.strictmode ?? false;
    }

    /**
     * Check if auto VCF generation is enabled
     */
    isAutoVcfEnabled(): boolean {
        return this.config?.generation?.autovcf ?? false;
    }

    /**
     * Check if auto VML generation is enabled
     */
    isAutoVmlEnabled(): boolean {
        return this.config?.generation?.autovml ?? false;
    }

    /**
     * Get indentation preference
     */
    getIndentation(): number {
        return this.config?.formatting?.indentation ?? 2;
    }

    /**
     * Get logging level preference
     */
    getLoggingLevel(): 'debug' | 'info' | 'warn' | 'error' {
        return this.config?.logging?.level ?? 'info';
    }

    /**
     * Check if a tool is enabled
     */
    isToolEnabled(toolName: 'simulink' | 'matlab' | 'modelica'): boolean {
        const tools = this.config?.tools;
        return tools?.[toolName] ?? false;
    }

    /**
     * Reload configuration (for real-time updates)
     */
    reloadConfig(): void {
        this.logger.info(`🔧 ${getVersionedLogger('CONFIG MANAGER')} - Reloading configuration`);
        this.loadConfig();
    }

    /**
     * Get configuration information for debugging
     */
    getConfigInfo(): string {
        if (!this.config) {
            return "No configuration loaded";
        }

        const sections = Object.keys(this.config);
        const info: string[] = [`Configuration loaded with ${sections.length} sections:`];
        
        if (this.config.project) {
            info.push(`  Project: ${this.config.project.name || 'Unnamed'} v${this.config.project.version || 'unversioned'}`);
            info.push(`  Owner: ${this.config.project.owner || 'Unknown'}`);
        }
        
        if (this.config.validation) {
            info.push(`  Validation: strict=${this.config.validation.strictmode}, warnings=${this.config.validation.warnings}`);
        }
        
        if (this.config.tools) {
            const enabledTools = Object.entries(this.config.tools)
                .filter(([_, enabled]) => enabled)
                .map(([tool, _]) => tool);
            info.push(`  Tools: ${enabledTools.join(', ') || 'none enabled'}`);
        }

        return info.join('\n');
    }

    /**
     * Get complete configuration object
     */
    getFullConfig(): ProjectConfig | null {
        return this.config;
    }

    // =================== CONFIG VALUE MANAGEMENT ===================

    /**
     * Set a config value and update dependent node visibility
     */
    setConfigValue(configName: string, value: any): void {
        const isEnabled = this.evaluateConfigEnabled(value);
        const configValue: ConfigValue = {
            name: configName,
            value,
            isEnabled
        };
        
        this.configValues.set(configName, configValue);
        this.updateDependentNodes(configName, isEnabled);
        
        this.logger.info(`🔧 ${getVersionedLogger('CONFIG MANAGER')} - Config '${configName}' set to ${value} (enabled: ${isEnabled})`);
    }

    /**
     * Get a config value
     */
    getConfigValue(configName: string): ConfigValue | undefined {
        return this.configValues.get(configName);
    }

    /**
     * Check if a config is enabled (value != 0)
     */
    isConfigEnabled(configName: string): boolean {
        const configValue = this.configValues.get(configName);
        return configValue?.isEnabled ?? true; // Default to enabled if not found
    }

    /**
     * Evaluate if a config value represents an enabled state
     */
    private evaluateConfigEnabled(value: any): boolean {
        // Config is disabled if value is 0, false, null, or undefined
        return value !== 0 && value !== false && value !== null && value !== undefined;
    }

    // =================== NODE STATE MANAGEMENT ===================

    /**
     * Create node config state for an item
     */
    createNodeState(nodeId: string, configReference: string | null = null): NodeConfigState {
        const isVisible = configReference ? this.isConfigEnabled(configReference) : true;
        const nodeState: NodeConfigState = {
            isVisible,
            configReference,
            visibilityReason: isVisible ? 'enabled' : 'config_disabled',
            renderMode: isVisible ? 'normal' : 'grayed'
        };
        
        this.nodeStates.set(nodeId, nodeState);
        return nodeState;
    }

    /**
     * Get node config state with inheritance checking
     */
    getNodeState(nodeId: string): NodeConfigState | undefined {
        const directState = this.nodeStates.get(nodeId);
        if (directState) {
            return directState;
        }
        
        // Check parent inheritance - if child doesn't have config state, check parent hdef
        const parentNodeId = this.getParentNodeId(nodeId);
        if (parentNodeId) {
            const parentState = this.nodeStates.get(parentNodeId);
            if (parentState) {
                // Create inherited state for child
                const inheritedState: NodeConfigState = {
                    isVisible: parentState.isVisible,
                    configReference: parentState.configReference,
                    visibilityReason: parentState.visibilityReason,
                    renderMode: parentState.renderMode
                };
                this.logger.info(`🔧 ${getVersionedLogger('CONFIG MANAGER')} - ✅ Node ${nodeId} inheriting config state from parent ${parentNodeId}: ${parentState.visibilityReason}`);
                return inheritedState;
            }
        }
        
        return undefined;
    }

    /**
     * Update node visibility based on config reference
     */
    updateNodeVisibility(nodeId: string, configReference: string): void {
        const existingState = this.nodeStates.get(nodeId);
        if (!existingState) {
            this.createNodeState(nodeId, configReference);
            return;
        }

        const isVisible = this.isConfigEnabled(configReference);
        existingState.isVisible = isVisible;
        existingState.configReference = configReference;
        existingState.visibilityReason = isVisible ? 'enabled' : 'config_disabled';
        existingState.renderMode = isVisible ? 'normal' : 'grayed';
        
        this.nodeStates.set(nodeId, existingState);
    }

    /**
     * Update all nodes dependent on a config value
     */
    private updateDependentNodes(configName: string, isEnabled: boolean): void {
        for (const [nodeId, nodeState] of this.nodeStates.entries()) {
            if (nodeState.configReference === configName) {
                nodeState.isVisible = isEnabled;
                nodeState.visibilityReason = isEnabled ? 'enabled' : 'config_disabled';
                nodeState.renderMode = isEnabled ? 'normal' : 'grayed';
                this.nodeStates.set(nodeId, nodeState);
            }
        }
    }

    /**
     * Check if a node should be visible (not grayed out)
     * Includes inheritance from parent nodes
     */
    isNodeVisible(nodeId: string): boolean {
        const nodeState = this.nodeStates.get(nodeId);
        if (nodeState) {
            return nodeState.isVisible;
        }
        
        // Check parent inheritance - if child doesn't have config state, check parent hdef
        const parentNodeId = this.getParentNodeId(nodeId);
        if (parentNodeId) {
            const parentState = this.nodeStates.get(parentNodeId);
            if (parentState) {
                return parentState.isVisible;
            }
        }
        
        return true; // Default to visible
    }

    /**
     * Check if a node should be rendered as grayed out
     */
    isNodeGrayed(nodeId: string): boolean {
        const nodeState = this.nodeStates.get(nodeId);
        return nodeState?.renderMode === 'grayed';
    }

    /**
     * Get all config values for debugging
     */
    getConfigValuesInfo(): string {
        if (this.configValues.size === 0) {
            return "No config values set";
        }

        const info: string[] = [`Config values (${this.configValues.size}):`];
        for (const [name, config] of this.configValues.entries()) {
            info.push(`  ${name}: ${config.value} (enabled: ${config.isEnabled})`);
        }

        return info.join('\n');
    }

    /**
     * Get all node states for debugging
     */
    getNodeStatesInfo(): string {
        if (this.nodeStates.size === 0) {
            return "No node states tracked";
        }

        const info: string[] = [`Node states (${this.nodeStates.size}):`];
        for (const [nodeId, state] of this.nodeStates.entries()) {
            info.push(`  ${nodeId}: ${state.visibilityReason} (${state.renderMode})`);
        }

        return info.join('\n');
    }

    /**
     * Get parent node ID using actual symbol hierarchy from symbol manager
     * For def items, parent is the hdef in the same file
     */
    private getParentNodeId(nodeId: string): string | null {
        // Extract file path and symbol name from nodeId (format: "filepath:symbolname")
        const colonIndex = nodeId.lastIndexOf(':');
        if (colonIndex === -1) return null;
        
        const filePath = nodeId.substring(0, colonIndex);
        const symbolName = nodeId.substring(colonIndex + 1);
        
        // Get the actual symbol from symbol manager to check its parentSymbol property
        if (this.symbolManager) {
            const allSymbols = this.symbolManager.getAllSymbolsRaw();
            const symbol = allSymbols.find((s: any) => s.fileUri.fsPath === filePath && s.name === symbolName);
            
            if (symbol && symbol.parentSymbol) {
                const parentNodeId = `${filePath}:${symbol.parentSymbol}`;
                this.logger.info(`🔧 ${getVersionedLogger('CONFIG MANAGER')} - ✅ Found actual parent ${symbol.parentSymbol} for child ${symbolName}`);
                return parentNodeId;
            }
        }
        
        // Fallback to pattern matching if symbol manager is not available
        for (const [candidateNodeId] of this.nodeStates.entries()) {
            if (candidateNodeId.startsWith(filePath + ':') && candidateNodeId !== nodeId) {
                const candidateSymbolName = candidateNodeId.substring(candidateNodeId.lastIndexOf(':') + 1);
                
                // hdef symbols are usually longer descriptive names (like requirementset, testset names)
                // def symbols usually start with uppercase prefixes (REQ_, TEST_, FUN_, etc.)
                const isHdefPattern = !candidateSymbolName.match(/^[A-Z]+_[A-Z0-9_]+/);
                const isDefPattern = symbolName.match(/^[A-Z]+_[A-Z0-9_]+/);
                
                if (isHdefPattern && isDefPattern) {
                    this.logger.info(`🔧 ${getVersionedLogger('CONFIG MANAGER')} - ✅ Found fallback parent ${candidateSymbolName} for child ${symbolName}`);
                    return candidateNodeId;
                }
            }
        }
        
        return null;
    }
} 