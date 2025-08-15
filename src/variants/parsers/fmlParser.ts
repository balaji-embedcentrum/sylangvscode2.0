import * as vscode from 'vscode';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { FeatureHierarchy, ParsedFeature } from '../types/variantTypes';

/**
 * Parser for .fml files to extract feature hierarchy
 */
export class FmlParser {
  private logger: SylangLogger;

  constructor(logger: SylangLogger) {
    this.logger = logger;
  }

  /**
   * Parse .fml file and build feature hierarchy
   */
  async parseFeatureModel(fmlUri: vscode.Uri): Promise<FeatureHierarchy[]> {
    try {
      const content = await vscode.workspace.fs.readFile(fmlUri);
      const text = Buffer.from(content).toString('utf8');
      
      this.logger.info(`📋 ${getVersionedLogger('FML PARSER')} - Parsing ${fmlUri.fsPath}`);
      
      const features = this.extractFeatures(text);
      const hierarchy = this.buildHierarchy(features);
      
      this.logger.info(`📋 ${getVersionedLogger('FML PARSER')} - Found ${features.length} features, built ${hierarchy.length} root features`);
      
      return hierarchy;
    } catch (error) {
      this.logger.error(`❌ ${getVersionedLogger('FML PARSER')} - Error parsing ${fmlUri.fsPath}: ${error}`);
      throw error;
    }
  }

  /**
   * Extract features from .fml content
   */
  private extractFeatures(content: string): ParsedFeature[] {
    const features: ParsedFeature[] = [];
    const lines = content.split('\n');
    
    const parentStack: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('use ') || trimmedLine.startsWith('hdef ')) {
        continue;
      }
      
      // Match feature definition: def feature FeatureName mandatory/optional
      const featureMatch = trimmedLine.match(/def feature (\w+)\s+(mandatory|optional)/);
      if (featureMatch) {
        const [, featureName, type] = featureMatch;
        
        // Calculate indentation level
        const indentLevel = this.getIndentLevel(line);
        const level = Math.floor(indentLevel / 2); // Assuming 2-space indentation
        
        // Adjust parent stack based on current level
        while (parentStack.length > level) {
          parentStack.pop();
        }
        
        const feature: ParsedFeature = {
          id: featureName,
          name: featureName,
          mandatory: type === 'mandatory',
          optional: type === 'optional',
          level: level,
          parentId: parentStack.length > 0 ? parentStack[parentStack.length - 1] : undefined
        };
        
        features.push(feature);
        parentStack.push(featureName);
        
        this.logger.debug(`📋 ${getVersionedLogger('FML PARSER')} - Found feature: ${featureName} (${type}, level ${level})`);
      }
    }
    
    return features;
  }

  /**
   * Build hierarchical structure from flat features
   */
  private buildHierarchy(features: ParsedFeature[]): FeatureHierarchy[] {
    const featureMap = new Map<string, FeatureHierarchy>();
    const rootFeatures: FeatureHierarchy[] = [];
    
    // First pass: create all feature objects
    for (const feature of features) {
      const hierarchyFeature: FeatureHierarchy = {
        id: feature.id,
        name: feature.name,
        level: feature.level,
        mandatory: feature.mandatory,
        optional: feature.optional,
        children: [],
        fullPath: feature.id
      };
      
      featureMap.set(feature.id, hierarchyFeature);
    }
    
    // Second pass: build parent-child relationships and update fullPath
    for (const feature of features) {
      const hierarchyFeature = featureMap.get(feature.id)!;
      
      if (feature.parentId) {
        const parent = featureMap.get(feature.parentId);
        if (parent) {
          parent.children.push(hierarchyFeature);
          hierarchyFeature.fullPath = `${parent.fullPath}.${feature.id}`;
        }
      } else {
        rootFeatures.push(hierarchyFeature);
      }
    }
    
    return rootFeatures;
  }

  /**
   * Calculate indentation level of a line
   */
  private getIndentLevel(line: string): number {
    let indent = 0;
    for (const char of line) {
      if (char === ' ') {
        indent++;
      } else if (char === '\t') {
        indent += 2; // Treat tab as 2 spaces
      } else {
        break;
      }
    }
    return indent;
  }
}
