import * as vscode from 'vscode';
import { SylangSymbolManager, SylangSymbol, DocumentSymbols } from '../../core/symbolManager';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { SylangConfigManager } from '../../core/configManager';
import { 
  DiagramData,
  DiagramNode,
  DiagramEdge,
  DiagramType,
  FeatureModelData,
  LayoutOrientation,
  GraphTraversalData,
  TraceTreeData,
  GraphNode,
  GraphEdge,
  InternalBlockDiagramData,
  SylangBlock,
  SylangPort,
  SylangConnection
} from '../types/diagramTypes';

/**
 * Transforms Sylang file content into diagram data structures
 */
export class DiagramDataTransformer {
  private logger: SylangLogger;
  private symbolManager: SylangSymbolManager;
  private configManager: SylangConfigManager;

  constructor(symbolManager: SylangSymbolManager, logger: SylangLogger) {
    this.symbolManager = symbolManager;
    this.logger = logger;
    this.configManager = symbolManager.getConfigManager();
    
    this.logger.info(`🎨 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Config-aware diagram transformer initialized`);
  }

  /**
   * Main transformation method
   */
  async transformFileToDiagram(fileUri: vscode.Uri, diagramType: DiagramType): Promise<{ success: boolean, data?: DiagramData, error?: string }> {
    try {
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Starting transformation for: ${fileUri.fsPath} to ${diagramType}`);

      // Get document symbols
      const documentSymbols = this.symbolManager.getDocumentSymbols(fileUri);
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Symbol manager returned: ${documentSymbols ? 'DocumentSymbols object' : 'null/undefined'}`);
      
      if (!documentSymbols) {
        this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - No document symbols found for: ${fileUri.fsPath}`);
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Available documents in symbol manager:`);
        
        // Debug: Check what documents are actually in the symbol manager
        const symbolManagerAny = this.symbolManager as any;
        if (symbolManagerAny.documents) {
          const documentKeys = Array.from(symbolManagerAny.documents.keys()) as string[];
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Document keys in symbol manager: ${JSON.stringify(documentKeys)}`);
          
          // Check if our file path is in the keys
          const hasExactMatch = documentKeys.includes(fileUri.fsPath);
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Exact path match: ${hasExactMatch}`);
          
          // Check for partial matches
          const partialMatches = documentKeys.filter(key => key.includes('ALMFeatures.fml'));
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Partial matches for ALMFeatures.fml: ${JSON.stringify(partialMatches)}`);
        }
        
        // Log all available documents for debugging
        const allSymbols = this.symbolManager.getAllSymbolsRaw();
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Total symbols in manager: ${allSymbols.length}`);
        
        try {
          const fs = require('fs');
          const exists = fs.existsSync(fileUri.fsPath);
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - File exists: ${exists}`);
          if (exists) {
            const stats = fs.statSync(fileUri.fsPath);
            this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - File size: ${stats.size} bytes`);
          }
        } catch (error) {
          this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Error checking file: ${error}`);
        }
        throw new Error('No document symbols found');
      }

      let diagramData: DiagramData;

      // Transform based on diagram type
      switch (diagramType) {
        case DiagramType.FeatureModel:
          diagramData = this.transformToFeatureModel(documentSymbols);
          break;
        case DiagramType.VariantModel:
          diagramData = await this.transformToVariantModel(fileUri, documentSymbols);
          break;
        case DiagramType.InternalBlockDiagram:
          // BlockDiagramData has a different structure than DiagramData
          const blockData = await this.transformToBlockDiagram(fileUri, documentSymbols);
          // Convert to DiagramData format for compatibility
          diagramData = {
            type: DiagramType.InternalBlockDiagram,
            nodes: [], // We'll populate this from blocks if needed
            edges: [], // We'll populate this from connections if needed
            metadata: blockData.metadata,
            internalBlockDiagramData: blockData
          };
          break;
        case DiagramType.GraphTraversal:
          diagramData = await this.transformToGraphTraversal(fileUri);
          break;
        case DiagramType.TraceTree:
          diagramData = await this.transformToTraceTree(fileUri);
          break;
        default:
          throw new Error(`Unsupported diagram type: ${diagramType}`);
      }

      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Transformation successful: ${diagramData.nodes.length} nodes, ${diagramData.edges.length} edges`);
      
      return { success: true, data: diagramData };
    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Transformation failed: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Transforms to feature model diagram data
   */
  private transformToFeatureModel(documentSymbols: DocumentSymbols): DiagramData {
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    const nodeMap = new Map<string, DiagramNode>();

    // Get all feature symbols
    const features = documentSymbols.definitionSymbols.filter((symbol: SylangSymbol) => symbol.kind === 'feature');
    
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Processing ${features.length} features`);

    // Log config state summary for debugging
    this.logConfigStateSummary(features);

    // Create nodes for all features with config-aware rendering
    features.forEach((symbol: SylangSymbol) => {
      const constraintType = this.determineConstraintType(symbol);
      const configAwareNode = this.createConfigAwareNode(symbol, constraintType);
      
      nodes.push(configAwareNode);
      nodeMap.set(symbol.name, configAwareNode);
      
      this.logger.debug(`🎨 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Created config-aware node: ${symbol.name} (${constraintType}) renderMode: ${configAwareNode.properties['renderMode']?.[0] || 'normal'} parent: ${symbol.parentSymbol || 'none'}`);
    });

    // Create hierarchy edges from parent-child relationships (config-aware)
    features.forEach((symbol: SylangSymbol) => {
      if (symbol.parentSymbol) {
        const parentNode = nodeMap.get(symbol.parentSymbol);
        const childNode = nodeMap.get(symbol.name);
        
        if (parentNode && childNode) {
          const configAwareEdge = this.createConfigAwareEdge(
            `hierarchy_${symbol.parentSymbol}_${symbol.name}`,
            symbol.parentSymbol,
            symbol.name,
            'hierarchy',
            { 'relationship': ['parent-child'] }
          );
          
          if (configAwareEdge) {
            edges.push(configAwareEdge);
            this.logger.debug(`🎨 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Created config-aware hierarchy edge: ${symbol.parentSymbol} -> ${symbol.name}`);
          } else {
            this.logger.debug(`🎨 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Skipped hierarchy edge (config disabled): ${symbol.parentSymbol} -> ${symbol.name}`);
          }
        }
      }
    });

    // Create constraint edges (requires/excludes)
    let constraintEdgeCount = 0;
    features.forEach((symbol: SylangSymbol) => {
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Checking constraints for ${symbol.name}`);
      
      // Process 'requires' relationships
      const requiresProps = symbol.properties.get('requires') || [];
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - ${symbol.name} requires: ${JSON.stringify(requiresProps)}`);
      
      requiresProps.forEach((requiresValue: string) => {
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Processing requires: "${requiresValue}"`);
        
        // Handle multiple formats: "ref feature FeatureName" or just "FeatureName"
        let targetFeature = '';
        
        if (requiresValue.includes('ref feature')) {
          const match = requiresValue.match(/ref\s+feature\s+(\w+)/);
          if (match) {
            targetFeature = match[1];
            this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Extracted target from "ref feature": ${targetFeature}`);
          }
        } else {
          // Direct feature name
          targetFeature = requiresValue.trim();
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Using direct target: ${targetFeature}`);
        }
        
        const targetNode = nodeMap.get(targetFeature);
        if (targetNode) {
          const edge: DiagramEdge = {
            id: `requires_${symbol.name}_${targetFeature}`,
            source: symbol.name,
            target: targetFeature,
            type: 'requires',
            properties: { 'constraint': ['requires'] }
          };
          
          edges.push(edge);
          constraintEdgeCount++;
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Created requires edge: ${symbol.name} -> ${targetFeature}`);
        } else {
          this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Target feature not found: ${targetFeature}`);
        }
      });

      // Process 'excludes' relationships
      const excludesProps = symbol.properties.get('excludes') || [];
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - ${symbol.name} excludes: ${JSON.stringify(excludesProps)}`);
      
      excludesProps.forEach((excludesValue: string) => {
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Processing excludes: "${excludesValue}"`);
        
        let targetFeature = '';
        
        if (excludesValue.includes('ref feature')) {
          const match = excludesValue.match(/ref\s+feature\s+(\w+)/);
          if (match) {
            targetFeature = match[1];
            this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Extracted target from "ref feature": ${targetFeature}`);
          }
        } else {
          targetFeature = excludesValue.trim();
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Using direct target: ${targetFeature}`);
        }
        
        const targetNode = nodeMap.get(targetFeature);
        if (targetNode) {
          const edge: DiagramEdge = {
            id: `excludes_${symbol.name}_${targetFeature}`,
            source: symbol.name,
            target: targetFeature,
            type: 'excludes',
            properties: { 'constraint': ['excludes'] }
          };
          
          edges.push(edge);
          constraintEdgeCount++;
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Created excludes edge: ${symbol.name} -> ${targetFeature}`);
        } else {
          this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Target feature not found: ${targetFeature}`);
        }
      });
    });

    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Total constraint edges created: ${constraintEdgeCount}`);

    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Transformation complete: ${nodes.length} nodes, ${edges.length} edges`);
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Hierarchy edges: ${edges.filter(e => e.type === 'hierarchy').length}`);
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Constraint edges: ${edges.filter(e => e.type === 'requires' || e.type === 'excludes').length}`);

    // Create proper feature model data structure
    const featureModelData: FeatureModelData = {
      type: DiagramType.FeatureModel,
      nodes: nodes as any[], // Cast to satisfy FeatureNode requirement temporarily 
      edges,
      metadata: {
        title: documentSymbols.headerSymbol?.name || 'Feature Model',
        sourceFile: documentSymbols.headerSymbol?.fileUri.fsPath || '',
        lastModified: Date.now(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      },
      orientation: LayoutOrientation.TopToBottom,
      rootFeature: this.findRootFeature(features)
    };

    return {
      type: DiagramType.FeatureModel,
      nodes,
      edges,
      metadata: {
        title: documentSymbols.headerSymbol?.name || 'Feature Model',
        sourceFile: documentSymbols.headerSymbol?.fileUri.fsPath || '',
        lastModified: Date.now(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      },
      featureModelData
    };
  }

  /**
   * Determines the constraint type for a feature symbol
   */
  private determineConstraintType(symbol: SylangSymbol): string {
    if (!symbol.properties) {
      // CRITICAL FIX: Check if properties might be undefined, but still log for debugging
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Symbol ${symbol.name} has no properties, defaulting to mandatory`);
      return 'mandatory';
    }
    
    // EXTENSIVE DEBUG: Log ALL properties for this symbol
    const allProperties = Array.from(symbol.properties.entries());
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Symbol ${symbol.name} ALL properties: ${JSON.stringify(allProperties)}`);
    
    // Check for explicit constraint type properties
    // These are set by SymbolManager when it finds 'mandatory', 'optional', 'or', 'alternative' keywords
    if (symbol.properties.get('mandatory')?.includes('true')) {
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Symbol ${symbol.name} is MANDATORY (explicit)`);
      return 'mandatory';
    }
    if (symbol.properties.get('optional')?.includes('true')) {
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Symbol ${symbol.name} is OPTIONAL (explicit)`);
      return 'optional';
    }
    if (symbol.properties.get('or')?.includes('true')) {
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Symbol ${symbol.name} is OR (explicit)`);
      return 'or';
    }
    if (symbol.properties.get('alternative')?.includes('true')) {
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Symbol ${symbol.name} is ALTERNATIVE (explicit)`);
      return 'alternative';
    }
    
    // If no explicit constraint type found, default to mandatory
    // This matches the behavior seen in the FML file where features have 'mandatory' keyword
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Symbol ${symbol.name} has no explicit constraint type, defaulting to MANDATORY`);
    return 'mandatory';
  }

  /**
   * Finds the root feature (feature without a parent)
   */
  private findRootFeature(features: SylangSymbol[]): string {
    const rootFeature = features.find(feature => !feature.parentSymbol);
    return rootFeature ? rootFeature.name : (features.length > 0 ? features[0].name : 'Unknown');
  }

  // Placeholder methods for other diagram types
  private async transformToVariantModel(_fileUri: vscode.Uri, _documentSymbols: DocumentSymbols): Promise<DiagramData> {
    throw new Error('Variant model transformation not implemented');
  }

  private async transformToBlockDiagram(fileUri: vscode.Uri, documentSymbols: DocumentSymbols): Promise<InternalBlockDiagramData> {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Starting internal block diagram transformation for ${fileUri.fsPath}`);
    
    // Get the main block (hdef block) from the current file
    const mainBlock = documentSymbols.headerSymbol;
    if (!mainBlock || mainBlock.kind !== 'block') {
      throw new Error('Selected file does not contain a block definition');
    }
    
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Main block: ${mainBlock.name}`);
    
    const blocks: SylangBlock[] = [];
    const connections: SylangConnection[] = [];
    
    // Create the main block
    const mainSylangBlock = await this.createSylangBlockFromSymbol(mainBlock, true);
    blocks.push(mainSylangBlock);
    
    // DEBUG: Log all properties of the main block
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: Main block properties:`);
    for (const [key, values] of mainBlock.properties) {
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: Property '${key}': [${values.join(', ')}]`);
    }
    
    // Get composedof relationships to find internal blocks
    const composedofRefs = mainBlock.properties.get('composedof') || [];
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Found ${composedofRefs.length} composedof references: ${composedofRefs.join(', ')}`);
    
    // Load internal blocks from composedof relationships
    // FIXED: composedofRefs is an array with separate elements like ["ref", "block", "EPBControlSubsystem,", "EPBActuatorSubsystem,", ...]
    const blockNames: string[] = [];
    
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: composedofRefs array has ${composedofRefs.length} elements`);
    
    // The entire composedofRefs array represents one composedof statement
    // Elements: ["ref", "block", "EPBControlSubsystem,", "EPBActuatorSubsystem,", "EPBSafetySubsystem,", "EPBInterfaceSubsystem"]
    if (composedofRefs.length >= 3 && composedofRefs[0] === 'ref' && composedofRefs[1] === 'block') {
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: Valid composedof format detected`);
      
      // Skip the first two elements ("ref" and "block") and process the rest as block names
      for (let i = 2; i < composedofRefs.length; i++) {
        const element = composedofRefs[i];
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: Processing element: '${element}'`);
        
        // Remove trailing commas and extract block name
        const blockName = element.replace(/,$/, '').trim();
        if (blockName && blockName.length > 0) {
          blockNames.push(blockName);
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: Found block name: '${blockName}'`);
        }
      }
    } else {
      this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: Invalid composedof format. First elements: [${composedofRefs.slice(0, 3).join(', ')}]`);
    }
    
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Extracted block names: [${blockNames.join(', ')}]`);
    
    // Now find and create blocks for each extracted name
    for (const blockName of blockNames) {
      const blockSymbol = this.findBlockSymbolByName(blockName);
      if (blockSymbol) {
        const internalBlock = await this.createSylangBlockFromSymbol(blockSymbol, false);
        blocks.push(internalBlock);
        this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Added internal block: ${blockName}`);
      } else {
        this.logger.warn(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Block not found: ${blockName}`);
      }
    }
    
    // Create connections based on needs relationships
    await this.createPortConnections(blocks, connections);
    
    // Layout blocks for IBD
    this.layoutBlocksForIBD(blocks);
    
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Block diagram complete: ${blocks.length} blocks, ${connections.length} connections`);
    
    return {
      type: DiagramType.InternalBlockDiagram,
      blocks,
      connections,
      metadata: {
        title: `Internal Block Diagram - ${mainBlock.name}`,
        description: `Internal Block Diagram for ${mainBlock.name}`,
        sourceFile: fileUri.fsPath,
        lastModified: Date.now(),
        nodeCount: blocks.length,
        edgeCount: connections.length
      }
    };
  }

  /**
   * Create a SylangBlock from a SylangSymbol
   */
  private async createSylangBlockFromSymbol(symbol: SylangSymbol, _isMainBlock: boolean): Promise<SylangBlock> {
    const ports: SylangPort[] = [];
    
    // Extract def ports from children
    const portSymbols = symbol.children.filter(child => child.kind === 'port');
    
    // Extract needs ref port (input ports) from properties
    const needsRefs = symbol.properties.get('needs') || [];
    
    let inputPortIndex = 0;
    let outputPortIndex = 0;
    
    // Process def ports (outputs)
    for (const portSymbol of portSymbols) {
      const portDirection = this.getPortDirection(portSymbol);
      const port: SylangPort = {
        id: `${symbol.name}_${portSymbol.name}`,
        name: portSymbol.name,
        description: portSymbol.properties.get('description')?.[0],
        direction: portDirection as 'in' | 'out',
        porttype: portSymbol.properties.get('porttype')?.[0] as any,
        owner: portSymbol.properties.get('owner')?.[0],
        safetylevel: portSymbol.properties.get('safetylevel')?.[0],
        tags: portSymbol.properties.get('tags'),
        x: 0, // Will be positioned later
        y: 0,
        config: portSymbol.properties.get('config')?.[0]
      };
      
      ports.push(port);
      if (portDirection === 'out') outputPortIndex++;
    }
    
    // Process needs ref port (inputs)
    // FIXED: needsRefs is an array like ["ref", "port", "VehicleSpeedSignal", "ref", "port", "VehicleSlopeAngle", ...]
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: needsRefs array has ${needsRefs.length} elements for ${symbol.name}`);
    
    // Parse the array in groups of 3: "ref", "port", "PortName"
    for (let i = 0; i < needsRefs.length; i += 3) {
      if (i + 2 < needsRefs.length && 
          needsRefs[i] === 'ref' && 
          needsRefs[i + 1] === 'port') {
        
        const portName = needsRefs[i + 2].replace(/,$/, '').trim(); // Remove trailing comma
        if (portName && portName.length > 0) {
          const port: SylangPort = {
            id: `${symbol.name}_input_${portName}`,
            name: portName,
            direction: 'in',
            x: 0, // Will be positioned later
            y: 0
          };
          ports.push(port);
          inputPortIndex++;
          this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: Added input port '${portName}' to block '${symbol.name}'`);
        }
      }
    }
    
    const block: SylangBlock = {
      id: symbol.name,
      name: symbol.name,
      description: symbol.properties.get('description')?.[0],
      level: symbol.properties.get('level')?.[0] as any,
      safetylevel: symbol.properties.get('safetylevel')?.[0],
      owner: symbol.properties.get('owner')?.[0],
      tags: symbol.properties.get('tags'),
      designrationale: symbol.properties.get('designrationale')?.[0],
      x: 0, // Will be positioned later
      y: 0,
      width: Math.max(200, ports.length * 30 + 100), // Dynamic width based on ports
      height: Math.max(120, Math.max(inputPortIndex, outputPortIndex) * 25 + 60),
      ports,
      composedof: symbol.properties.get('composedof'),
      enables: symbol.properties.get('enables'),
      inherits: symbol.properties.get('inherits'),
      config: symbol.properties.get('config')?.[0],
      fileUri: symbol.fileUri.fsPath
    };
    
    // Position ports on the block edges
    this.positionPortsOnBlock(block);
    
    return block;
  }
  
  /**
   * Get port direction from symbol (def port symbols don't have explicit direction)
   */
  private getPortDirection(_portSymbol: SylangSymbol): string {
    // For def port, assume 'out' unless specified otherwise
    // In Sylang, def ports are typically outputs, needs ref ports are inputs
    return 'out';
  }
  
  /**
   * Position ports ON block edges as connection points (not outside as separate elements)
   */
  private positionPortsOnBlock(block: SylangBlock): void {
    const inputPorts = block.ports.filter(p => p.direction === 'in');
    const outputPorts = block.ports.filter(p => p.direction === 'out');
    
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Positioning ${inputPorts.length} input ports and ${outputPorts.length} output ports for block '${block.name}'`);
    
    const portHeight = 12; // Small port rectangles
    const portSpacing = 20; // Space between ports
    const edgeMargin = 10; // Margin from block corners
    
    // Position input ports on LEFT edge of block
    inputPorts.forEach((port, index) => {
      port.x = block.x; // ON the left edge, not outside
      port.y = block.y + edgeMargin + (index * portSpacing);
      port.width = 4; // Thin port rectangle on edge
      port.height = portHeight;
    });
    
    // Position output ports on RIGHT edge of block  
    outputPorts.forEach((port, index) => {
      port.x = block.x + block.width - 4; // ON the right edge, not outside
      port.y = block.y + edgeMargin + (index * portSpacing);
      port.width = 4; // Thin port rectangle on edge
      port.height = portHeight;
    });
    
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Block '${block.name}' ports positioned on edges`);
  }
  
  /**
   * Find a block symbol by name in the entire project
   */
  private findBlockSymbolByName(blockName: string): SylangSymbol | null {
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: Searching for block '${blockName}'`);
    
    const allSymbols = this.symbolManager.getAllSymbols();
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: Total symbols in project: ${allSymbols.length}`);
    
    const blockSymbols = allSymbols.filter(symbol => symbol.kind === 'block' && symbol.type === 'header');
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: Block symbols found: ${blockSymbols.map(s => s.name).join(', ')}`);
    
    const foundSymbol = allSymbols.find(symbol => 
      symbol.name === blockName && 
      symbol.kind === 'block' && 
      symbol.type === 'header'
    ) || null;
    
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - DEBUG: Block '${blockName}' ${foundSymbol ? 'FOUND' : 'NOT FOUND'}`);
    
    return foundSymbol;
  }
  
  /**
   * Create meaningful port connections based on 'needs ref port' relationships
   */
  private async createPortConnections(blocks: SylangBlock[], connections: SylangConnection[]): Promise<void> {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Creating meaningful connections for ${blocks.length} blocks`);
    
    // For each block, check its 'needs ref port' relationships to find connections
    for (const block of blocks) {
      const blockSymbol = this.findBlockSymbolByName(block.name);
      if (!blockSymbol) continue;
      
      // Get 'needs ref port' relationships
      const needsRefs = blockSymbol.properties.get('needs') || [];
      
      for (const needsRef of needsRefs) {
        // Parse "ref port PortName" format
        const refParts = needsRef.split(/\s+/);
        if (refParts.length >= 3 && refParts[0] === 'ref' && refParts[1] === 'port') {
          const neededPortName = refParts[2];
          
          this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Block '${block.name}' needs port '${neededPortName}'`);
          
          // Find the input port on this block that corresponds to this need
          const inputPort = block.ports.find(p => p.direction === 'in' && p.name === neededPortName);
          
          // Find which other block provides this port as output
          const providingBlock = blocks.find(otherBlock => {
            return otherBlock.ports.some(p => p.direction === 'out' && p.name === neededPortName);
          });
          
          if (inputPort && providingBlock) {
            const outputPort = providingBlock.ports.find(p => p.direction === 'out' && p.name === neededPortName);
            
            if (outputPort) {
              connections.push({
                id: `${outputPort.id}_to_${inputPort.id}`,
                from: outputPort.id,
                to: inputPort.id,
                type: 'data-flow'
              });
              
              this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Connected '${providingBlock.name}.${outputPort.name}' to '${block.name}.${inputPort.name}'`);
            }
          }
        }
      }
    }
    
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Created ${connections.length} meaningful connections`);
  }
  
  /**
   * Layout blocks for IBD - main block as system boundary container, internal blocks inside
   */
  private layoutBlocksForIBD(blocks: SylangBlock[]): void {
    if (blocks.length === 0) return;
    
    const mainBlock = blocks[0];
    const internalBlocks = blocks.slice(1);
    
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Layout IBD: Main block '${mainBlock.name}' with ${internalBlocks.length} internal blocks`);
    
    // Calculate grid layout for internal blocks
    const internalCount = internalBlocks.length;
    const cols = Math.ceil(Math.sqrt(internalCount));
    const rows = Math.ceil(internalCount / cols);
    
    // Main block as large system boundary (container)
    const containerMargin = 60;
    const internalBlockWidth = 140;
    const internalBlockHeight = 80;
    const internalSpacing = 30;
    
    mainBlock.x = 50;
    mainBlock.y = 50;
    mainBlock.width = Math.max(800, cols * (internalBlockWidth + internalSpacing) + containerMargin * 2);
    mainBlock.height = Math.max(500, rows * (internalBlockHeight + internalSpacing) + containerMargin * 2 + 60); // +60 for title space
    
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Main block positioned: ${mainBlock.width}x${mainBlock.height} at (${mainBlock.x}, ${mainBlock.y})`);
    
    // Position internal blocks INSIDE main block in grid layout
    internalBlocks.forEach((block, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      block.x = mainBlock.x + containerMargin + col * (internalBlockWidth + internalSpacing);
      block.y = mainBlock.y + containerMargin + 40 + row * (internalBlockHeight + internalSpacing); // +40 for main block title
      block.width = internalBlockWidth;
      block.height = internalBlockHeight;
      
      this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Internal block '${block.name}' positioned at (${block.x}, ${block.y})`);
    });
    
    // Position ports on block edges (will be updated in next TODO)
    blocks.forEach(block => this.positionPortsOnBlock(block));
  }

  /**
   * Transform entire project to graph traversal data
   */
  private async transformToGraphTraversal(sourceFileUri: vscode.Uri): Promise<GraphTraversalData> {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Starting graph traversal transformation`);
    
    const allSymbols = this.symbolManager.getAllSymbols();
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const clusters = new Map<string, string[]>();
    const fileGroups = new Map<string, string[]>();
    
    // Create nodes from all symbols
    for (const symbol of allSymbols) {
      const nodeId = `${symbol.fileUri.fsPath}:${symbol.name}`;
      const fileExtension = symbol.fileUri.fsPath.split('.').pop() || '';
      
      const node: GraphNode = {
        id: nodeId,
        name: symbol.name,
        type: symbol.type,
        symbolType: symbol.type as 'hdef' | 'def',
        fileUri: symbol.fileUri.fsPath,
        position: { x: 0, y: 0 }, // Will be set by layout algorithm
        size: { width: 120, height: 60 },
        properties: Object.fromEntries(symbol.properties),
        parent: symbol.parentSymbol,
        children: symbol.children.map(child => `${symbol.fileUri.fsPath}:${child.name}`),
        connections: [],
        configValue: symbol.configValue,
        indentLevel: symbol.indentLevel
      };
      
      nodes.push(node);
      
      // Group by file extension
      if (!clusters.has(fileExtension)) {
        clusters.set(fileExtension, []);
      }
      clusters.get(fileExtension)!.push(nodeId);
      
      // Group by file
      if (!fileGroups.has(symbol.fileUri.fsPath)) {
        fileGroups.set(symbol.fileUri.fsPath, []);
      }
      fileGroups.get(symbol.fileUri.fsPath)!.push(nodeId);
    }
    
    // Create automatic parent-child relationships for hdef → def
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Creating automatic parent-child relationships`);
    for (const symbol of allSymbols) {
      if (symbol.type === 'header') { // hdef
        const parentNodeId = `${symbol.fileUri.fsPath}:${symbol.name}`;
        
        // Find all def children
        for (const child of symbol.children) {
          const childNodeId = `${symbol.fileUri.fsPath}:${child.name}`;
          
          // Create parentof edge (hdef → def)
          const parentofEdge: GraphEdge = {
            id: `${parentNodeId}-${childNodeId}-parentof`,
            source: parentNodeId,
            target: childNodeId,
            type: 'parentof',
            relationType: 'parentof',
            properties: { 'parentof': [child.name] }
          };
          edges.push(parentofEdge);
          
          // Create childof edge (def → hdef)
          const childofEdge: GraphEdge = {
            id: `${childNodeId}-${parentNodeId}-childof`,
            source: childNodeId,
            target: parentNodeId,
            type: 'childof',
            relationType: 'childof',
            properties: { 'childof': [symbol.name] }
          };
          edges.push(childofEdge);
          
          // Update connections
          const parentNode = nodes.find(n => n.id === parentNodeId);
          const childNode = nodes.find(n => n.id === childNodeId);
          if (parentNode && childNode) {
            if (!parentNode.connections.includes(childNodeId)) {
              parentNode.connections.push(childNodeId);
            }
            if (!childNode.connections.includes(parentNodeId)) {
              childNode.connections.push(parentNodeId);
            }
          }
        }
      }
    }
    
    // Create edges from explicit reference relationships
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Processing explicit reference relationships`);
    for (const symbol of allSymbols) {
      const sourceNodeId = `${symbol.fileUri.fsPath}:${symbol.name}`;
      
      // Process properties to find reference relationships
      for (const [propertyName, values] of symbol.properties) {
        if (this.isReferenceProperty(propertyName)) {
          for (const value of values) {
            const targetSymbol = this.findReferencedSymbol(value, symbol.fileUri);
            if (targetSymbol) {
              const targetNodeId = `${targetSymbol.fileUri.fsPath}:${targetSymbol.name}`;
              
              const edge: GraphEdge = {
                id: `${sourceNodeId}-${targetNodeId}-${propertyName}`,
                source: sourceNodeId,
                target: targetNodeId,
                type: propertyName,
                relationType: propertyName,
                properties: {
                  [propertyName]: [value]
                }
              };
              
              edges.push(edge);
              
              // Update connections
              const sourceNode = nodes.find(n => n.id === sourceNodeId);
              const targetNode = nodes.find(n => n.id === targetNodeId);
              if (sourceNode && targetNode) {
                if (!sourceNode.connections.includes(targetNodeId)) {
                  sourceNode.connections.push(targetNodeId);
                }
                if (!targetNode.connections.includes(sourceNodeId)) {
                  targetNode.connections.push(sourceNodeId);
                }
              }
            }
          }
        }
      }
    }
    
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Graph traversal created: ${nodes.length} nodes, ${edges.length} edges`);
    
    // Convert Map objects to regular objects for JSON serialization
    const clustersObject: { [key: string]: string[] } = {};
    clusters.forEach((nodeIds, fileExt) => {
      clustersObject[fileExt] = nodeIds;
    });

    const fileGroupsObject: { [key: string]: string[] } = {};
    fileGroups.forEach((nodeIds, filePath) => {
      fileGroupsObject[filePath] = nodeIds;
    });

    return {
      type: DiagramType.GraphTraversal,
      nodes,
      edges,
      clusters: clustersObject,
      fileGroups: fileGroupsObject,
      metadata: {
        title: 'Sylang: Traceability View',
        description: 'Complete project graph showing all nodes and relationships',
        sourceFile: sourceFileUri.fsPath,
        lastModified: Date.now(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      }
    };
  }
  
  /**
   * Check if a property is a reference relationship
   */
  private isReferenceProperty(propertyName: string): boolean {
    const referenceProperties = [
      'ref', 'extends', 'implements', 'traces', 'validates', 'satisfies',
      'composedof', 'enables', 'needs', 'allocatedto', 'assignedto',
      'refinedfrom', 'derivedfrom', 'inherits', 'listedfor', 'generatedfrom',
      'requires', 'excludes', 'when'
    ];
    
    return referenceProperties.some(ref => propertyName.includes(ref));
  }
  
  /**
   * Find a symbol by name across all documents
   */
  private findReferencedSymbol(identifier: string, sourceFileUri: vscode.Uri): SylangSymbol | undefined {
    return this.symbolManager.resolveSymbol(identifier, sourceFileUri);
  }

  /**
   * Transform to trace tree data structure
   */
  private async transformToTraceTree(sourceFileUri: vscode.Uri): Promise<TraceTreeData> {
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Starting trace tree transformation`);
    
    // Get all symbols from the project
    const allSymbols = this.symbolManager.getAllSymbolsRaw();
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Found ${allSymbols.length} symbols for trace tree`);
    
    // Create nodes and edges (same as graph traversal)
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    // Create nodes from symbols
    allSymbols.forEach(symbol => {
      nodes.push({
        id: symbol.name,
        name: symbol.name,
        type: symbol.kind,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 60 },
        properties: Object.fromEntries(symbol.properties),
        symbolType: symbol.type === 'header' ? 'hdef' : 'def',
        fileUri: symbol.fileUri.fsPath,
        connections: []
      });
    });
    
    // Create edges from symbol properties
    allSymbols.forEach(symbol => {
      symbol.properties.forEach((values, propertyName) => {
        if (this.isReferenceProperty(propertyName)) {
          values.forEach(value => {
            const referencedSymbol = this.findReferencedSymbol(value, symbol.fileUri);
            if (referencedSymbol) {
              const edgeId = `${symbol.name}-${referencedSymbol.name}`;
              edges.push({
                id: edgeId,
                source: symbol.name,
                target: referencedSymbol.name,
                type: propertyName,
                properties: { [propertyName]: [value] },
                relationType: propertyName
              });
            }
          });
        }
      });
    });
    
    // Build hierarchy for tree layout
    const hierarchyData = this.buildHierarchy(nodes, edges);
    
    this.logger.info(`🔧 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Trace tree created: ${nodes.length} nodes, ${edges.length} edges`);
    
    return {
      type: DiagramType.TraceTree,
      hierarchy: hierarchyData,
      nodes,
      edges,
      metadata: {
        title: 'Sylang: Trace Tree View',
        description: 'Hierarchical tree view of project structure and relationships',
        sourceFile: sourceFileUri.fsPath,
        lastModified: Date.now(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      }
    };
  }

  /**
   * Build hierarchy data for tree layout
   */
  private buildHierarchy(nodes: GraphNode[], edges: GraphEdge[]): any {
    // Create a map of node connections
    const nodeMap = new Map<string, GraphNode>();
    const childrenMap = new Map<string, string[]>();
    
    // Initialize maps
    nodes.forEach(node => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });
    
    // Build parent-child relationships from edges
    edges.forEach(edge => {
      const children = childrenMap.get(edge.source) || [];
      children.push(edge.target);
      childrenMap.set(edge.source, children);
    });
    
    // Find root nodes (nodes with no incoming edges)
    const hasIncoming = new Set<string>();
    edges.forEach(edge => {
      hasIncoming.add(edge.target);
    });
    
    const rootNodes = nodes.filter(node => !hasIncoming.has(node.id));
    
    // If no clear roots, use nodes with most outgoing connections
    if (rootNodes.length === 0) {
      const connectionCount = new Map<string, number>();
      nodes.forEach(node => connectionCount.set(node.id, 0));
      
      edges.forEach(edge => {
        const count = connectionCount.get(edge.source) || 0;
        connectionCount.set(edge.source, count + 1);
      });
      
      const maxConnections = Math.max(...Array.from(connectionCount.values()));
      const potentialRoots = nodes.filter(node => 
        (connectionCount.get(node.id) || 0) === maxConnections
      );
      
      if (potentialRoots.length > 0) {
        return this.createHierarchyNode(potentialRoots[0], nodeMap, childrenMap);
      }
    }
    
    // Create hierarchy starting from root nodes
    if (rootNodes.length > 0) {
      return this.createHierarchyNode(rootNodes[0], nodeMap, childrenMap);
    }
    
    // Fallback: create a simple hierarchy from first node
    return this.createHierarchyNode(nodes[0], nodeMap, childrenMap);
  }

  /**
   * Create a hierarchy node recursively
   */
  private createHierarchyNode(node: GraphNode, nodeMap: Map<string, GraphNode>, childrenMap: Map<string, string[]>): any {
    const children = childrenMap.get(node.id) || [];
    const childNodes = children.map(childId => {
      const childNode = nodeMap.get(childId);
      if (childNode) {
        return this.createHierarchyNode(childNode, nodeMap, childrenMap);
      }
      return null;
    }).filter(Boolean);
    
    return {
      name: node.name,
      type: node.symbolType,
      file: node.fileUri,
      children: childNodes.length > 0 ? childNodes : undefined
    };
  }

  // =================== CONFIG-AWARE DIAGRAM METHODS ===================

  /**
   * Create a config-aware diagram node with render state information
   */
  private createConfigAwareNode(symbol: SylangSymbol, constraintType?: string): DiagramNode {
    this.logger.debug(`🎨 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Creating config-aware node for ${symbol.name}`);

    // Get config state for this symbol
    const nodeId = `${symbol.fileUri.fsPath}:${symbol.name}`;
    const configState = this.configManager.getNodeState(nodeId);
    
    // Determine render mode
    let renderMode = 'normal';
    let configInfo = 'enabled';
    
    if (configState) {
      renderMode = configState.renderMode;
      configInfo = `${configState.visibilityReason} (config: ${configState.configReference || 'none'})`;
      this.logger.debug(`🎨 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Node ${symbol.name}: ${configInfo}, renderMode: ${renderMode}`);
    } else {
      this.logger.debug(`🎨 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Node ${symbol.name}: no config state, using normal rendering`);
    }

    // Create base properties
    const properties: { [key: string]: string[] } = {
      'description': [symbol.properties.get('description')?.join(' ') || ''],
      'owner': symbol.properties.get('owner') || [],
      'tags': symbol.properties.get('tags') || [],
      'safetylevel': symbol.properties.get('safetylevel') || [],
      'mandatory': symbol.properties.get('mandatory') || [],
      'optional': symbol.properties.get('optional') || [],
      'or': symbol.properties.get('or') || [],
      'alternative': symbol.properties.get('alternative') || [],
      'requires': symbol.properties.get('requires') || [],
      'excludes': symbol.properties.get('excludes') || [],
      // Config-aware properties
      'renderMode': [renderMode],
      'configInfo': [configInfo],
      'isVisible': [configState?.isVisible.toString() || 'true']
    };

    // Add constraint type if provided
    if (constraintType) {
      properties['constraintType'] = [constraintType];
    }

    const node: DiagramNode = {
      id: symbol.name,
      name: symbol.name,
      type: symbol.kind, // Use actual symbol kind instead of generic nodeType
      position: { x: 0, y: 0 }, // Will be set by layout
      size: { width: 200, height: 60 },
      properties
    };

    this.logger.info(`🎨 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Created ${renderMode} node: ${symbol.name} (${configInfo})`);
    return node;
  }

  /**
   * Create a config-aware diagram edge, filtering out edges between disabled nodes
   */
  private createConfigAwareEdge(
    id: string,
    sourceId: string,
    targetId: string,
    edgeType: string,
    properties: { [key: string]: string[] }
  ): DiagramEdge | null {
    this.logger.debug(`🎨 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Creating config-aware edge: ${sourceId} -> ${targetId} (${edgeType})`);

    // Check config states for source and target
    const sourceNodeId = `${sourceId}`;  // Simplified for now - could be enhanced with full path
    const targetNodeId = `${targetId}`;
    
    const sourceState = this.configManager.getNodeState(sourceNodeId);
    const targetState = this.configManager.getNodeState(targetNodeId);
    
    const sourceVisible = sourceState?.isVisible ?? true;
    const targetVisible = targetState?.isVisible ?? true;

    // Filter edge based on node visibility
    if (!sourceVisible || !targetVisible) {
      this.logger.debug(`🎨 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Filtering edge (disabled nodes): ${sourceId}(${sourceVisible}) -> ${targetId}(${targetVisible})`);
      return null;
    }

    // Create edge with config info
    const configAwareProperties = {
      ...properties,
      'sourceConfigInfo': [sourceState?.visibilityReason || 'enabled'],
      'targetConfigInfo': [targetState?.visibilityReason || 'enabled']
    };

    const edge: DiagramEdge = {
      id,
      source: sourceId,
      target: targetId,
      type: edgeType,
      properties: configAwareProperties
    };

    this.logger.debug(`🎨 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Created config-aware edge: ${sourceId} -> ${targetId} (both nodes enabled)`);
    return edge;
  }

  /**
   * Log config state summary for debugging
   */
  private logConfigStateSummary(symbols: SylangSymbol[]): void {
    let enabledCount = 0;
    let grayedCount = 0;
    let hiddenCount = 0;

    symbols.forEach(symbol => {
      const nodeId = `${symbol.fileUri.fsPath}:${symbol.name}`;
      const configState = this.configManager.getNodeState(nodeId);
      
      if (!configState || configState.isVisible) {
        enabledCount++;
      } else {
        switch (configState.renderMode) {
          case 'grayed':
            grayedCount++;
            break;
          case 'hidden':
            hiddenCount++;
            break;
          default:
            enabledCount++;
        }
      }
    });

    this.logger.info(`🎨 ${getVersionedLogger('DIAGRAM DATA TRANSFORMER')} - Config State Summary:`);
    this.logger.info(`  Enabled nodes: ${enabledCount}`);
    this.logger.info(`  Grayed nodes: ${grayedCount}`);
    this.logger.info(`  Hidden nodes: ${hiddenCount}`);
    this.logger.info(`  Total nodes: ${symbols.length}`);
  }
} 