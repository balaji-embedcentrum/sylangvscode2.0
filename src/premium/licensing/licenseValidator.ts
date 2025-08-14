/**
 * Sylang Cloud License Validator
 * Handles validation with cloud service
 */

import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { LicenseInfo, LicenseValidationResponse, LicenseTier, LICENSE_CONFIG } from './licenseTypes';

export class SylangLicenseValidator {
    private logger: SylangLogger;

    constructor(logger: SylangLogger) {
        this.logger = logger;
    }

    /**
     * Validate license key with cloud service
     */
    async validateWithCloud(licenseKey: string): Promise<LicenseInfo> {
        this.logger.info(`🔑 ${getVersionedLogger('LICENSE VALIDATOR')} - Validating license with cloud service`);

        try {
            const response = await this.makeValidationRequest(licenseKey);
            return this.parseValidationResponse(response);
        } catch (error) {
            this.logger.error(`🔑 ${getVersionedLogger('LICENSE VALIDATOR')} - Cloud validation failed: ${error}`);
            
            // Graceful degradation - return free tier on error
            return {
                tier: LicenseTier.FREE,
                valid: true,
                features: [],
                error: `Cloud validation failed: ${error}`
            };
        }
    }

    /**
     * Make HTTP request to validation endpoint
     */
    private async makeValidationRequest(licenseKey: string): Promise<LicenseValidationResponse> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), LICENSE_CONFIG.TIMEOUT_MS);

        try {
            // Mock API call for now - replace with real endpoint
            const response = await fetch(LICENSE_CONFIG.VALIDATION_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Sylang-VSCode-Extension'
                },
                body: JSON.stringify({
                    key: licenseKey,
                    client: 'vscode-extension'
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            // For development - simulate different license responses
            return this.simulateCloudResponse(licenseKey);
        }
    }

    /**
     * Development simulation of cloud responses
     * Remove this when real API is available
     */
    private simulateCloudResponse(licenseKey: string): LicenseValidationResponse {
        this.logger.debug(`🔑 ${getVersionedLogger('LICENSE VALIDATOR')} - Simulating cloud response for development`);

        // Simulate different license types based on key pattern
        if (licenseKey.includes('PREM')) {
            return {
                valid: true,
                tier: LicenseTier.PREMIUM,
                features: ['dynamicFileTypes', 'advancedValidation', 'customSyntax'],
                expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
            };
        } else if (licenseKey.includes('ENTP')) {
            return {
                valid: true,
                tier: LicenseTier.ENTERPRISE,
                features: ['dynamicFileTypes', 'advancedValidation', 'customSyntax', 'enterpriseIntegrations', 'teamCollaboration'],
                expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            };
        } else if (licenseKey.length >= 10) {
            // Valid format but expired/invalid
            return {
                valid: false,
                tier: LicenseTier.FREE,
                features: [],
                error: 'License key is invalid or expired'
            };
        } else {
            return {
                valid: false,
                tier: LicenseTier.FREE,
                features: [],
                error: 'Invalid license key format'
            };
        }
    }

    /**
     * Parse validation response from cloud
     */
    private parseValidationResponse(response: LicenseValidationResponse): LicenseInfo {
        const licenseInfo: LicenseInfo = {
            tier: response.tier || LicenseTier.FREE,
            valid: response.valid,
            features: response.features || [],
            error: response.error
        };

        if (response.expires) {
            licenseInfo.expires = new Date(response.expires);
        }

        this.logger.info(`🔑 ${getVersionedLogger('LICENSE VALIDATOR')} - License validation result: ${licenseInfo.tier}, valid: ${licenseInfo.valid}`);

        return licenseInfo;
    }

    /**
     * Check if license key format is valid
     */
    isValidKeyFormat(licenseKey: string): boolean {
        // Basic format validation: SYL_{TIER}_YYYY_XXXXX...
        const licenseRegex = /^SYL_(PREM|ENTP)_\d{4}_[A-Z0-9]{20,}$/;
        return licenseRegex.test(licenseKey);
    }
}
