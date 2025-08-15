import * as vscode from 'vscode';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { VariantFile, ParsedVariantSelection } from '../types/variantTypes';

/**
 * Parser for .vml files to extract variant selections
 */
export class VmlParser {
  private logger: SylangLogger;

  constructor(logger: SylangLogger) {
    this.logger = logger;
  }

  /**
   * Find all .vml files in workspace
   */
  async findVariantFiles(): Promise<VariantFile[]> {
    try {
      const vmlFiles = await vscode.workspace.findFiles('**/*.vml');
      const variants: VariantFile[] = [];
      
      for (const file of vmlFiles) {
        const variantsetName = await this.extractVariantsetName(file);
        if (variantsetName) {
          variants.push({
            name: variantsetName,
            path: file.fsPath,
            variantsetName: variantsetName
          });
        }
      }
      
      this.logger.info(`📋 ${getVersionedLogger('VML PARSER')} - Found ${variants.length} variant files`);
      return variants;
    } catch (error) {
      this.logger.error(`❌ ${getVersionedLogger('VML PARSER')} - Error finding variant files: ${error}`);
      return [];
    }
  }

  /**
   * Parse variant selections from .vml file
   */
  async parseVariantSelections(vmlUri: vscode.Uri): Promise<Map<string, ParsedVariantSelection>> {
    try {
      const content = await vscode.workspace.fs.readFile(vmlUri);
      const text = Buffer.from(content).toString('utf8');
      
      this.logger.info(`📋 ${getVersionedLogger('VML PARSER')} - Parsing selections from ${vmlUri.fsPath}`);
      
      const selections = this.extractSelections(text);
      
      this.logger.info(`📋 ${getVersionedLogger('VML PARSER')} - Found ${selections.size} feature selections`);
      
      return selections;
    } catch (error) {
      this.logger.error(`❌ ${getVersionedLogger('VML PARSER')} - Error parsing ${vmlUri.fsPath}: ${error}`);
      return new Map();
    }
  }

  /**
   * Extract variantset name from .vml file
   */
  private async extractVariantsetName(vmlUri: vscode.Uri): Promise<string | null> {
    try {
      const content = await vscode.workspace.fs.readFile(vmlUri);
      const text = Buffer.from(content).toString('utf8');
      
      // Look for: hdef variantset VariantsetName
      const match = text.match(/hdef variantset (\w+)/);
      return match ? match[1] : null;
    } catch (error) {
      this.logger.error(`❌ ${getVersionedLogger('VML PARSER')} - Error extracting variantset name from ${vmlUri.fsPath}: ${error}`);
      return null;
    }
  }

  /**
   * Extract feature selections from .vml content
   */
  private extractSelections(content: string): Map<string, ParsedVariantSelection> {
    const selections = new Map<string, ParsedVariantSelection>();
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('use ') || trimmedLine.startsWith('hdef ')) {
        continue;
      }
      
      // Match feature extension: extends ref feature FeatureName mandatory/optional [selected]
      const featureMatch = trimmedLine.match(/extends ref feature (\w+)\s+(mandatory|optional)\s*(selected)?/);
      if (featureMatch) {
        const [, featureName, type, selectedFlag] = featureMatch;
        
        const selection: ParsedVariantSelection = {
          featureRef: featureName,
          mandatory: type === 'mandatory',
          optional: type === 'optional',
          selected: selectedFlag === 'selected',
          level: this.getIndentLevel(line)
        };
        
        selections.set(featureName, selection);
        
        this.logger.debug(`📋 ${getVersionedLogger('VML PARSER')} - Found selection: ${featureName} (${type}, selected: ${selection.selected})`);
      }
    }
    
    return selections;
  }

  /**
   * Update .vml file with new feature selection
   */
  async updateFeatureSelection(vmlUri: vscode.Uri, featureId: string, selected: boolean): Promise<void> {
    try {
      const content = await vscode.workspace.fs.readFile(vmlUri);
      let text = Buffer.from(content).toString('utf8');
      
      // Find the line with the feature
      const lines = text.split('\n');
      let updated = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Match the specific feature line
        const featureMatch = trimmedLine.match(new RegExp(`extends ref feature ${featureId}\\s+(mandatory|optional)\\s*(selected)?`));
        if (featureMatch) {
          const [, type] = featureMatch;
          const indentation = line.substring(0, line.length - trimmedLine.length);
          
          // Rebuild the line with or without 'selected'
          const newLine = selected 
            ? `${indentation}extends ref feature ${featureId} ${type} selected`
            : `${indentation}extends ref feature ${featureId} ${type}`;
          
          lines[i] = newLine;
          updated = true;
          
          this.logger.info(`📋 ${getVersionedLogger('VML PARSER')} - Updated ${featureId} selection to ${selected} in ${vmlUri.fsPath}`);
          break;
        }
      }
      
      if (updated) {
        const updatedText = lines.join('\n');
        await vscode.workspace.fs.writeFile(vmlUri, Buffer.from(updatedText, 'utf8'));
      } else {
        this.logger.warn(`⚠️ ${getVersionedLogger('VML PARSER')} - Feature ${featureId} not found in ${vmlUri.fsPath}`);
      }
    } catch (error) {
      this.logger.error(`❌ ${getVersionedLogger('VML PARSER')} - Error updating ${vmlUri.fsPath}: ${error}`);
      throw error;
    }
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
