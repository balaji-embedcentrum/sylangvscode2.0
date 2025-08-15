import * as vscode from 'vscode';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { SylangSymbolManager, SylangSymbol } from '../../core/symbolManager';
import { VmlParser } from '../parsers/vmlParser';
import { VariantMatrixData, FeatureHierarchy, FeatureSelection } from '../types/variantTypes';

/**
 * Builds variant matrix data structure combining .fml and .vml data
 */
export class VariantMatrixBuilder {
  private logger: SylangLogger;
  private symbolManager: SylangSymbolManager;
  private vmlParser: VmlParser;

  constructor(symbolManager: SylangSymbolManager, logger: SylangLogger) {
    this.logger = logger;
    this.symbolManager = symbolManager;
    this.vmlParser = new VmlParser(logger);
  }

  /**
   * Build complete variant matrix data from .fml source
   */
  async buildMatrixData(fmlUri: vscode.Uri): Promise<VariantMatrixData> {
    try {
      this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Building matrix data from ${fmlUri.fsPath}`);

      // Parse feature hierarchy from .fml using SymbolManager
      const features = await this.parseFeatureHierarchyFromSymbols(fmlUri);
      
      // Find all .vml files
      const variants = await this.vmlParser.findVariantFiles();
      
      // Parse selections from each .vml file
      const selections = new Map<string, Map<string, FeatureSelection>>();
      
      for (const variant of variants) {
        const vmlUri = vscode.Uri.file(variant.path);
        const variantSelections = await this.vmlParser.parseVariantSelections(vmlUri);
        
        // Convert to FeatureSelection format
        const featureSelections = new Map<string, FeatureSelection>();
        
        // Initialize all features as unselected first
        this.initializeFeatureSelections(features, featureSelections);
        
        // Apply selections from .vml file
        for (const [featureId, selection] of variantSelections) {
          featureSelections.set(featureId, {
            featureId: featureId,
            selected: selection.selected,
            mandatory: selection.mandatory,
            optional: selection.optional
          });
        }
        
        selections.set(variant.name, featureSelections);
        
        this.logger.debug(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Processed ${variantSelections.size} selections for ${variant.name}`);
      }
      
      const matrixData: VariantMatrixData = {
        features,
        variants,
        selections
      };
      
      this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Built matrix: ${features.length} features, ${variants.length} variants`);
      
      return matrixData;
    } catch (error) {
      this.logger.error(`❌ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Error building matrix data: ${error}`);
      throw error;
    }
  }

  /**
   * Initialize all features as unselected for a variant
   */
  private initializeFeatureSelections(features: FeatureHierarchy[], selections: Map<string, FeatureSelection>): void {
    for (const feature of features) {
      selections.set(feature.id, {
        featureId: feature.id,
        selected: false, // Default to unselected
        mandatory: feature.mandatory,
        optional: feature.optional
      });
      
      // Recursively initialize children
      if (feature.children.length > 0) {
        this.initializeFeatureSelections(feature.children, selections);
      }
    }
  }

  /**
   * Parse feature hierarchy from .fml file using SymbolManager
   */
  private async parseFeatureHierarchyFromSymbols(fmlUri: vscode.Uri): Promise<FeatureHierarchy[]> {
    this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Starting to parse ${fmlUri.fsPath}`);
    
    // Ensure the document is parsed by SymbolManager
    this.symbolManager.addDocument(fmlUri);
    
    const documentSymbols = this.symbolManager.getDocumentSymbols(fmlUri);
    if (!documentSymbols) {
      throw new Error(`No symbols found for ${fmlUri.fsPath}`);
    }

    this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Found ${documentSymbols.definitionSymbols.length} total definition symbols`);

    // Get all feature symbols
    const featureSymbols = documentSymbols.definitionSymbols.filter(symbol => symbol.kind === 'feature');
    
    this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Found ${featureSymbols.length} feature symbols`);
    
    // Debug: log all feature symbols with their indentation
    for (const symbol of featureSymbols) {
      this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Feature: ${symbol.name}, indentLevel: ${symbol.indentLevel}, line: ${symbol.line}, mandatory: ${symbol.properties.has('mandatory')}, optional: ${symbol.properties.has('optional')}`);
    }
    
    // Build hierarchy from symbols
    return this.buildHierarchyFromSymbols(featureSymbols);
  }

  /**
   * Build feature hierarchy from SymbolManager symbols
   */
  private buildHierarchyFromSymbols(symbols: SylangSymbol[]): FeatureHierarchy[] {
    const featureMap = new Map<string, FeatureHierarchy>();
    const rootFeatures: FeatureHierarchy[] = [];
    
    // First pass: create all feature objects using the real name and proper data
    for (const symbol of symbols) {
      const displayName = this.getFeatureName(symbol);
      const isMandatory = this.isFeatureMandatory(symbol);
      const isOptional = this.isFeatureOptional(symbol);
      
      const hierarchyFeature: FeatureHierarchy = {
        id: symbol.name, // Use identifier for lookups
        name: displayName, // Use proper display name
        level: symbol.indentLevel,
        mandatory: isMandatory,
        optional: isOptional,
        children: [],
        fullPath: symbol.name
      };
      
      featureMap.set(symbol.name, hierarchyFeature);
      this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Created feature: ${symbol.name} -> "${displayName}" (level ${symbol.indentLevel}, mandatory: ${isMandatory}, optional: ${isOptional})`);
      
      // Debug: log all properties
      this.logger.debug(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Properties for ${symbol.name}: ${Array.from(symbol.properties.keys()).join(', ')}`);
    }
    
    // Second pass: build parent-child relationships using indentation levels
    const sortedSymbols = [...symbols].sort((a, b) => a.line - b.line);
    const parentStack: SylangSymbol[] = [];
    
    this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Building hierarchy from ${sortedSymbols.length} sorted symbols`);
    
    for (const symbol of sortedSymbols) {
      const feature = featureMap.get(symbol.name);
      if (!feature) {
        this.logger.warn(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Missing feature for symbol ${symbol.name}`);
        continue;
      }
      
      this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Processing ${symbol.name} (level ${symbol.indentLevel}), stack size: ${parentStack.length}`);
      
      // Pop parents until we find the correct level
      while (parentStack.length > 0 && parentStack[parentStack.length - 1].indentLevel >= symbol.indentLevel) {
        const poppedParent = parentStack.pop();
        this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Popped parent ${poppedParent?.name} (level ${poppedParent?.indentLevel})`);
      }
      
      if (parentStack.length > 0) {
        // Has parent
        const parentSymbol = parentStack[parentStack.length - 1];
        const parentFeature = featureMap.get(parentSymbol.name);
        if (parentFeature) {
          parentFeature.children.push(feature);
          feature.fullPath = `${parentFeature.fullPath}.${symbol.name}`;
          this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Added ${symbol.name} as child of ${parentSymbol.name}`);
        }
      } else {
        // Root feature
        rootFeatures.push(feature);
        this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Added ${symbol.name} as root feature`);
      }
      
      parentStack.push(symbol);
    }
    
    this.logger.info(`🏗️ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Final hierarchy: ${rootFeatures.length} root features`);
    
    return rootFeatures;
  }

  /**
   * Get display name for feature from symbol properties or fallback to identifier
   */
  private getFeatureName(symbol: SylangSymbol): string {
    const nameProperty = symbol.properties.get('name');
    if (nameProperty && nameProperty.length > 0) {
      // Remove quotes from the name
      return nameProperty[0].replace(/^"(.*)"$/, '$1');
    }
    return symbol.name; // Fallback to identifier
  }

  /**
   * Check if feature is mandatory based on definition line parsing
   */
  private isFeatureMandatory(symbol: SylangSymbol): boolean {
    // Look for mandatory flag in the definition line
    // The SymbolManager should parse this from "def feature FeatureName mandatory"
    const mandatoryProperty = symbol.properties.get('mandatory');
    return mandatoryProperty !== undefined;
  }

  /**
   * Check if feature is optional based on definition line parsing  
   */
  private isFeatureOptional(symbol: SylangSymbol): boolean {
    // Look for optional flag in the definition line
    // The SymbolManager should parse this from "def feature FeatureName optional"
    const optionalProperty = symbol.properties.get('optional');
    return optionalProperty !== undefined;
  }

  /**
   * Get flat list of all features (including children) for easier iteration
   */
  getFlatFeatureList(features: FeatureHierarchy[]): FeatureHierarchy[] {
    const flatList: FeatureHierarchy[] = [];
    
    const addFeature = (feature: FeatureHierarchy) => {
      flatList.push(feature);
      for (const child of feature.children) {
        addFeature(child);
      }
    };
    
    for (const feature of features) {
      addFeature(feature);
    }
    
    return flatList;
  }

  /**
   * Update feature selection in specific .vml file
   */
  async updateFeatureSelection(variantPath: string, featureId: string, selected: boolean): Promise<void> {
    try {
      const vmlUri = vscode.Uri.file(variantPath);
      await this.vmlParser.updateFeatureSelection(vmlUri, featureId, selected);
      
      this.logger.info(`✅ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Updated ${featureId} = ${selected} in ${variantPath}`);
    } catch (error) {
      this.logger.error(`❌ ${getVersionedLogger('VARIANT MATRIX BUILDER')} - Error updating feature selection: ${error}`);
      throw error;
    }
  }
}
