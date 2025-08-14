/**
 * Sylang Premium Feature Gates
 * Decorators and utilities for controlling premium features
 */

import * as vscode from 'vscode';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { SylangLicenseManager } from '../licensing/licenseManager';
import { SylangLicenseCommands } from '../licensing/licenseCommands';
import { PremiumFeature } from '../licensing/licenseTypes';

/**
 * Decorator for methods that require premium features
 */
export function requiresPremiumFeature(feature: PremiumFeature) {
    return function(_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        
        descriptor.value = async function(...args: any[]) {
            const licenseManager = SylangLicenseManager.getInstance();
            const isEnabled = await licenseManager.isFeatureEnabled(feature);
            
            if (!isEnabled) {
                const logger = (this as any).logger as SylangLogger;
                if (logger) {
                    logger.warn(`🔒 ${getVersionedLogger('FEATURE GATE')} - Premium feature '${feature}' blocked: no valid license`);
                }
                
                // Show premium required message
                const licenseCommands = new SylangLicenseCommands(logger);
                await licenseCommands.showPremiumRequiredMessage(feature);
                
                return null;
            }
            
            return method.apply(this, args);
        };
    };
}

/**
 * Feature gate utility class
 */
export class SylangFeatureGates {
    private logger: SylangLogger;
    private licenseManager: SylangLicenseManager;
    private licenseCommands: SylangLicenseCommands;

    constructor(logger: SylangLogger) {
        this.logger = logger;
        this.licenseManager = SylangLicenseManager.getInstance(logger);
        this.licenseCommands = new SylangLicenseCommands(logger);
    }

    /**
     * Check if a premium feature is enabled
     */
    async isFeatureEnabled(feature: PremiumFeature): Promise<boolean> {
        return await this.licenseManager.isFeatureEnabled(feature);
    }

    /**
     * Guard function for premium features
     */
    async guardPremiumFeature(feature: PremiumFeature, actionName: string): Promise<boolean> {
        const isEnabled = await this.isFeatureEnabled(feature);
        
        if (!isEnabled) {
            this.logger.warn(`🔒 ${getVersionedLogger('FEATURE GATE')} - Blocked action '${actionName}': requires ${feature}`);
            await this.licenseCommands.showPremiumRequiredMessage(feature);
            return false;
        }
        
        this.logger.debug(`🔒 ${getVersionedLogger('FEATURE GATE')} - Allowed action '${actionName}': ${feature} enabled`);
        return true;
    }

    /**
     * Show feature comparison
     */
    async showFeatureComparison(): Promise<void> {
        const currentLicense = await this.licenseManager.getCurrentLicense();
        
        const features = [
            { name: 'Core File Types (.req, .tst, .fml, etc.)', free: '✅', premium: '✅', enterprise: '✅' },
            { name: 'Validation & Diagnostics', free: '✅', premium: '✅', enterprise: '✅' },
            { name: 'DocView & Diagrams', free: '✅', premium: '✅', enterprise: '✅' },
            { name: 'Dynamic File Types (.fma, .haz, etc.)', free: '❌', premium: '✅', enterprise: '✅' },
            { name: 'Advanced Validation Rules', free: '❌', premium: '✅', enterprise: '✅' },
            { name: 'Custom Syntax Highlighting', free: '❌', premium: '✅', enterprise: '✅' },
            { name: 'Enterprise Integrations', free: '❌', premium: '❌', enterprise: '✅' },
            { name: 'Team Collaboration Features', free: '❌', premium: '❌', enterprise: '✅' },
            { name: 'Priority Support', free: '❌', premium: '✅', enterprise: '✅' }
        ];

        const markdown = [
            '# Sylang Feature Comparison',
            '',
            `**Current License:** ${currentLicense.tier.toUpperCase()} ${currentLicense.valid ? '✅' : '❌'}`,
            '',
            '| Feature | Free | Premium | Enterprise |',
            '|---------|------|---------|------------|'
        ];

        features.forEach(feature => {
            markdown.push(`| ${feature.name} | ${feature.free} | ${feature.premium} | ${feature.enterprise} |`);
        });

        markdown.push('');
        markdown.push('**Upgrade to unlock more features!**');

        // Show in a new editor
        const doc = await vscode.workspace.openTextDocument({
            content: markdown.join('\n'),
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc, { preview: true });
    }

    /**
     * Initialize feature gates system
     */
    async initialize(): Promise<void> {
        this.logger.info(`🔒 ${getVersionedLogger('FEATURE GATE')} - Initializing feature gates system`);
        
        // Perform initial license validation
        const license = await this.licenseManager.getCurrentLicense();
        
        const enabledFeatures = license.features.length;
        const totalFeatures = Object.keys(PremiumFeature).length;
        
        this.logger.info(`🔒 ${getVersionedLogger('FEATURE GATE')} - Feature gates initialized. License: ${license.tier}, Features: ${enabledFeatures}/${totalFeatures}`);
    }

    /**
     * Check multiple features at once
     */
    async checkFeatures(features: PremiumFeature[]): Promise<Record<PremiumFeature, boolean>> {
        const results: Record<PremiumFeature, boolean> = {} as any;
        
        for (const feature of features) {
            results[feature] = await this.isFeatureEnabled(feature);
        }
        
        return results;
    }

    /**
     * Get available features summary
     */
    async getFeatureSummary(): Promise<{ tier: string; enabled: PremiumFeature[]; disabled: PremiumFeature[] }> {
        const license = await this.licenseManager.getCurrentLicense();
        const allFeatures = Object.values(PremiumFeature);
        
        const enabled: PremiumFeature[] = [];
        const disabled: PremiumFeature[] = [];
        
        for (const feature of allFeatures) {
            if (license.features.includes(feature)) {
                enabled.push(feature);
            } else {
                disabled.push(feature);
            }
        }
        
        return {
            tier: license.tier,
            enabled,
            disabled
        };
    }
}
