/**
 * License types and interfaces for Sylang VSCode Extension
 * Supports base (free) and premium (paid) licensing tiers
 */

export enum LicenseType {
  BASE = 'base',
  PREMIUM = 'premium'
}

export enum LicenseStatus {
  VALID = 'valid',
  EXPIRED = 'expired',
  INVALID = 'invalid',
  NOT_FOUND = 'not_found'
}

export interface LicenseInfo {
  type: LicenseType;
  status: LicenseStatus;
  expirationDate?: Date;
  licensedTo?: string;
  organization?: string;
  features: string[];
  maxProjects?: number;
  licenseKey?: string;
}

export interface LicenseValidationResult {
  isValid: boolean;
  licenseInfo: LicenseInfo;
  errorMessage?: string;
}

/**
 * Feature definitions for different license tiers
 */
export const LICENSE_FEATURES = {
  BASE: [
    'basic_syntax_highlighting',
    'basic_validation',
    'basic_autocomplete',
    'basic_go_to_definition',
    'basic_hover',
    'basic_document_symbols',
    'single_project'
  ],
  PREMIUM: [
    // All base features
    ...['basic_syntax_highlighting', 'basic_validation', 'basic_autocomplete', 'basic_go_to_definition', 'basic_hover', 'basic_document_symbols', 'single_project'],
    // Premium features
    'advanced_traceability_matrix',
    'graph_traversal_diagrams',
    'csv_export',
    'image_download',
    'cross_project_analysis',
    'advanced_filtering',
    'bulk_operations',
    'project_templates',
    'collaboration_features',
    'api_integration',
    'unlimited_projects'
  ]
} as const;

/**
 * Default license info for base (free) users
 */
export const DEFAULT_BASE_LICENSE: LicenseInfo = {
  type: LicenseType.BASE,
  status: LicenseStatus.VALID,
  licensedTo: 'Free User',
  features: [...LICENSE_FEATURES.BASE],
  maxProjects: 1
};

/**
 * Premium feature categories for UI display
 */
export const PREMIUM_FEATURE_CATEGORIES = {
  'Traceability & Analysis': [
    'advanced_traceability_matrix',
    'graph_traversal_diagrams',
    'cross_project_analysis',
    'advanced_filtering'
  ],
  'Export & Integration': [
    'csv_export',
    'image_download',
    'api_integration',
    'bulk_operations'
  ],
  'Project Management': [
    'unlimited_projects',
    'project_templates',
    'collaboration_features'
  ]
} as const;
