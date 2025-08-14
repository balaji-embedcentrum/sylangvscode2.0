/**
 * Sylang License Manager
 * Core license management with VSCode settings integration
 */

import * as vscode from 'vscode';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { SylangLicenseValidator } from './licenseValidator';
import { LicenseInfo, LicenseCache, LicenseTier, PremiumFeature, LICENSE_CONFIG } from './licenseTypes';

export class SylangLicenseManager {
    private static instance: SylangLicenseManager | null = null;
    private logger: SylangLogger;
    private validator: SylangLicenseValidator;
    private cache: LicenseCache | null = null;
    private validationPromise: Promise<LicenseInfo> | null = null;

    private constructor(logger: SylangLogger) {
        this.logger = logger;
        this.validator = new SylangLicenseValidator(logger);
        this.logger.info(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - License manager initialized`);
    }

    /**
     * Get singleton instance
     */
    static getInstance(logger?: SylangLogger): SylangLicenseManager {
        if (!SylangLicenseManager.instance && logger) {
            SylangLicenseManager.instance = new SylangLicenseManager(logger);
        }
        if (!SylangLicenseManager.instance) {
            throw new Error('License manager not initialized - logger required');
        }
        return SylangLicenseManager.instance;
    }

    /**
     * Initialize license system and perform initial validation
     */
    async initialize(): Promise<void> {
        this.logger.info(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - Initializing license system`);
        
        try {
            // Perform initial license validation
            await this.validateCurrentLicense();
            this.logger.info(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - License system initialization complete`);
        } catch (error) {
            this.logger.error(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - License initialization failed: ${error}`);
        }
    }

    /**
     * Get current license information
     */
    async getCurrentLicense(): Promise<LicenseInfo> {
        // Return cached license if valid
        if (this.isCacheValid()) {
            this.logger.debug(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - Returning cached license`);
            return this.cache!.info;
        }

        // If validation is already in progress, wait for it
        if (this.validationPromise) {
            this.logger.debug(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - Waiting for ongoing validation`);
            return await this.validationPromise;
        }

        // Start new validation
        return await this.validateCurrentLicense();
    }

    /**
     * Validate current license from VSCode settings
     */
    async validateCurrentLicense(): Promise<LicenseInfo> {
        this.validationPromise = this.performValidation();
        
        try {
            const result = await this.validationPromise;
            return result;
        } finally {
            this.validationPromise = null;
        }
    }

    /**
     * Perform actual license validation
     */
    private async performValidation(): Promise<LicenseInfo> {
        const licenseKey = this.getLicenseKeyFromSettings();
        
        if (!licenseKey) {
            this.logger.debug(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - No license key found, using free tier`);
            const freeLicense: LicenseInfo = {
                tier: LicenseTier.FREE,
                valid: true,
                features: []
            };
            this.updateCache('', freeLicense);
            return freeLicense;
        }

        this.logger.info(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - Validating license key: ${licenseKey.substring(0, 12)}...`);

        // Basic format validation
        if (!this.validator.isValidKeyFormat(licenseKey)) {
            const invalidLicense: LicenseInfo = {
                tier: LicenseTier.FREE,
                valid: false,
                features: [],
                error: 'Invalid license key format'
            };
            this.updateCache(licenseKey, invalidLicense);
            return invalidLicense;
        }

        // Cloud validation
        const licenseInfo = await this.validator.validateWithCloud(licenseKey);
        this.updateCache(licenseKey, licenseInfo);
        
        return licenseInfo;
    }

    /**
     * Check if specific premium feature is enabled
     */
    async isFeatureEnabled(feature: PremiumFeature): Promise<boolean> {
        try {
            const license = await this.getCurrentLicense();
            const isEnabled = license.valid && license.features.includes(feature);
            
            this.logger.debug(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - Feature '${feature}' enabled: ${isEnabled}`);
            return isEnabled;
        } catch (error) {
            this.logger.error(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - Error checking feature '${feature}': ${error}`);
            return false;
        }
    }

    /**
     * Set license key in VSCode settings
     */
    async setLicenseKey(licenseKey: string, scope: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
        this.logger.info(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - Setting license key`);
        
        const config = vscode.workspace.getConfiguration('sylang');
        await config.update('license.key', licenseKey, scope);
        
        // Clear cache to force revalidation
        this.clearCache();
        
        this.logger.info(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - License key updated, cache cleared`);
    }

    /**
     * Clear license key from VSCode settings
     */
    async clearLicenseKey(): Promise<void> {
        this.logger.info(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - Clearing license key`);
        
        const config = vscode.workspace.getConfiguration('sylang');
        await config.update('license.key', undefined, vscode.ConfigurationTarget.Workspace);
        
        this.clearCache();
        
        this.logger.info(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - License key cleared`);
    }

    /**
     * Force license revalidation
     */
    async refreshLicense(): Promise<LicenseInfo> {
        this.logger.info(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - Forcing license refresh`);
        this.clearCache();
        return await this.validateCurrentLicense();
    }

    /**
     * Get license key from VSCode settings
     */
    private getLicenseKeyFromSettings(): string | undefined {
        const config = vscode.workspace.getConfiguration('sylang');
        return config.get<string>('license.key');
    }

    /**
     * Check if cache is still valid
     */
    private isCacheValid(): boolean {
        if (!this.cache) return false;
        
        const now = new Date();
        const isValid = now < this.cache.expiresAt;
        
        if (!isValid) {
            this.logger.debug(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - Cache expired, needs refresh`);
        }
        
        return isValid;
    }

    /**
     * Update license cache
     */
    private updateCache(key: string, info: LicenseInfo): void {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + LICENSE_CONFIG.CACHE_DURATION_HOURS * 60 * 60 * 1000);
        
        this.cache = {
            key,
            info,
            validatedAt: now,
            expiresAt
        };
        
        this.logger.debug(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - Cache updated, expires at: ${expiresAt.toISOString()}`);
    }

    /**
     * Clear license cache
     */
    private clearCache(): void {
        this.cache = null;
        this.logger.debug(`🔑 ${getVersionedLogger('LICENSE MANAGER')} - Cache cleared`);
    }

    /**
     * Get cache status for debugging
     */
    getCacheStatus(): { hasCache: boolean; expiresAt?: string; tier?: LicenseTier } {
        if (!this.cache) {
            return { hasCache: false };
        }
        
        return {
            hasCache: true,
            expiresAt: this.cache.expiresAt.toISOString(),
            tier: this.cache.info.tier
        };
    }
}
