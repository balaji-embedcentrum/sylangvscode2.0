/**
 * Sylang Premium Licensing System Types
 * Loosely coupled architecture for premium features
 */

export enum LicenseTier {
    FREE = 'free',
    PREMIUM = 'premium',
    ENTERPRISE = 'enterprise'
}

export interface LicenseInfo {
    tier: LicenseTier;
    valid: boolean;
    features: string[];
    expires?: Date;
    error?: string;
}

export interface LicenseValidationResponse {
    valid: boolean;
    tier: LicenseTier;
    features: string[];
    expires?: string;
    error?: string;
}

export interface LicenseCache {
    key: string;
    info: LicenseInfo;
    validatedAt: Date;
    expiresAt: Date;
}

// Premium features enum
export enum PremiumFeature {
    DYNAMIC_FILE_TYPES = 'dynamicFileTypes',
    ADVANCED_VALIDATION = 'advancedValidation',
    CUSTOM_SYNTAX = 'customSyntax',
    ENTERPRISE_INTEGRATIONS = 'enterpriseIntegrations',
    TEAM_COLLABORATION = 'teamCollaboration'
}

// Configuration constants
export const LICENSE_CONFIG = {
    CACHE_DURATION_HOURS: 4,
    VALIDATION_ENDPOINT: 'https://api.sylang.com/v1/validate-license',
    RETRY_ATTEMPTS: 3,
    TIMEOUT_MS: 5000
} as const;
