/**
 * Type definitions for Variant Matrix functionality
 */

export interface FeatureHierarchy {
  id: string;
  name: string;
  level: number;
  mandatory: boolean;
  optional: boolean;
  children: FeatureHierarchy[];
  fullPath: string; // e.g., "CoreEncryption.TextInput"
}

export interface VariantFile {
  name: string;
  path: string;
  variantsetName: string;
}

export interface FeatureSelection {
  featureId: string;
  selected: boolean;
  mandatory: boolean;
  optional: boolean;
}

export interface VariantMatrixData {
  features: FeatureHierarchy[];
  variants: VariantFile[];
  selections: Map<string, Map<string, FeatureSelection>>; // variantName -> featureId -> selection
}

export interface VariantMatrixMessage {
  type: 'checkboxToggle';
  variantName: string;
  featureId: string;
  selected: boolean;
}

export interface ParsedFeature {
  id: string;
  name: string;
  mandatory: boolean;
  optional: boolean;
  level: number;
  parentId?: string;
}

export interface ParsedVariantSelection {
  featureRef: string;
  mandatory: boolean;
  optional: boolean;
  selected: boolean;
  level: number;
}
