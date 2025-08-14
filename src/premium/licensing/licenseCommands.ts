/**
 * Sylang License Commands
 * VSCode commands for license management
 */

import * as vscode from 'vscode';
import { SylangLogger } from '../../core/logger';
import { getVersionedLogger } from '../../core/version';
import { SylangLicenseManager } from './licenseManager';
import { LicenseTier, PremiumFeature } from './licenseTypes';

export class SylangLicenseCommands {
    private logger: SylangLogger;
    private licenseManager: SylangLicenseManager;

    constructor(logger: SylangLogger) {
        this.logger = logger;
        this.licenseManager = SylangLicenseManager.getInstance(logger);
    }

    /**
     * Register all license commands
     */
    registerCommands(context: vscode.ExtensionContext): void {
        const commands = [
            { id: 'sylang.license.enter', handler: () => this.enterLicenseCommand() },
            { id: 'sylang.license.status', handler: () => this.showLicenseStatusCommand() },
            { id: 'sylang.license.refresh', handler: () => this.refreshLicenseCommand() },
            { id: 'sylang.license.clear', handler: () => this.clearLicenseCommand() },
            { id: 'sylang.license.upgrade', handler: () => this.upgradeLicenseCommand() }
        ];

        for (const { id, handler } of commands) {
            const disposable = vscode.commands.registerCommand(id, handler);
            context.subscriptions.push(disposable);
            this.logger.debug(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - Registered command: ${id}`);
        }

        this.logger.info(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - Registered ${commands.length} license commands`);
    }

    /**
     * Command: Enter license key
     */
    async enterLicenseCommand(): Promise<void> {
        try {
            const licenseKey = await vscode.window.showInputBox({
                prompt: 'Enter your Sylang Premium license key',
                placeHolder: 'SYL_PREM_2024_...',
                validateInput: (value) => {
                    if (!value) return 'License key cannot be empty';
                    if (value.length < 20) return 'License key too short';
                    if (!value.startsWith('SYL_')) return 'Invalid license key format';
                    return null;
                }
            });

            if (!licenseKey) {
                return; // User cancelled
            }

            this.logger.info(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - User entering license key`);

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Validating license...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 30, message: 'Contacting license server...' });
                
                // Set the license key
                await this.licenseManager.setLicenseKey(licenseKey);
                
                progress.report({ increment: 70, message: 'Validating license...' });
                
                // Validate the license
                const licenseInfo = await this.licenseManager.validateCurrentLicense();
                
                if (licenseInfo.valid && licenseInfo.tier !== LicenseTier.FREE) {
                    vscode.window.showInformationMessage(
                        `✅ License activated successfully!\n\nTier: ${licenseInfo.tier.toUpperCase()}\nFeatures: ${licenseInfo.features.length}`,
                        'View Features'
                    ).then(selection => {
                        if (selection === 'View Features') {
                            this.showLicenseStatusCommand();
                        }
                    });
                    
                    this.logger.info(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - License activated: ${licenseInfo.tier}`);
                } else {
                    const errorMsg = licenseInfo.error || 'Unknown validation error';
                    vscode.window.showErrorMessage(
                        `❌ License validation failed: ${errorMsg}`,
                        'Try Again', 'Get License'
                    ).then(selection => {
                        if (selection === 'Try Again') {
                            this.enterLicenseCommand();
                        } else if (selection === 'Get License') {
                            this.upgradeLicenseCommand();
                        }
                    });
                    
                    this.logger.error(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - License validation failed: ${errorMsg}`);
                }
            });
            
        } catch (error) {
            this.logger.error(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - Error in enter license command: ${error}`);
            vscode.window.showErrorMessage(`Failed to set license: ${error}`);
        }
    }

    /**
     * Command: Show license status
     */
    async showLicenseStatusCommand(): Promise<void> {
        try {
            this.logger.info(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - Showing license status`);

            const licenseInfo = await this.licenseManager.getCurrentLicense();
            const cacheStatus = this.licenseManager.getCacheStatus();
            
            const statusItems: string[] = [
                `**License Tier:** ${licenseInfo.tier.toUpperCase()}`,
                `**Status:** ${licenseInfo.valid ? '✅ Valid' : '❌ Invalid'}`,
                `**Features:** ${licenseInfo.features.length > 0 ? licenseInfo.features.join(', ') : 'None'}`
            ];

            if (licenseInfo.expires) {
                statusItems.push(`**Expires:** ${licenseInfo.expires.toLocaleDateString()}`);
            }

            if (licenseInfo.error) {
                statusItems.push(`**Error:** ${licenseInfo.error}`);
            }

            if (cacheStatus.hasCache) {
                statusItems.push(`**Cache expires:** ${new Date(cacheStatus.expiresAt!).toLocaleString()}`);
            }

            const statusMessage = statusItems.join('\n\n');

            const actions: string[] = ['Refresh License'];
            if (licenseInfo.tier === LicenseTier.FREE) {
                actions.push('Get Premium License');
            }
            if (licenseInfo.valid && licenseInfo.tier !== LicenseTier.FREE) {
                actions.push('Clear License');
            }

            const selection = await vscode.window.showInformationMessage(
                statusMessage,
                { modal: true },
                ...actions
            );

            switch (selection) {
                case 'Refresh License':
                    await this.refreshLicenseCommand();
                    break;
                case 'Get Premium License':
                    await this.upgradeLicenseCommand();
                    break;
                case 'Clear License':
                    await this.clearLicenseCommand();
                    break;
            }

        } catch (error) {
            this.logger.error(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - Error showing license status: ${error}`);
            vscode.window.showErrorMessage(`Failed to get license status: ${error}`);
        }
    }

    /**
     * Command: Refresh license
     */
    async refreshLicenseCommand(): Promise<void> {
        try {
            this.logger.info(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - Refreshing license`);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Refreshing license...',
                cancellable: false
            }, async () => {
                const licenseInfo = await this.licenseManager.refreshLicense();
                
                if (licenseInfo.valid) {
                    vscode.window.showInformationMessage(
                        `✅ License refreshed successfully! Tier: ${licenseInfo.tier.toUpperCase()}`
                    );
                } else {
                    vscode.window.showWarningMessage(
                        `⚠️ License refresh completed but license is invalid: ${licenseInfo.error || 'Unknown error'}`
                    );
                }
            });

        } catch (error) {
            this.logger.error(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - Error refreshing license: ${error}`);
            vscode.window.showErrorMessage(`Failed to refresh license: ${error}`);
        }
    }

    /**
     * Command: Clear license
     */
    async clearLicenseCommand(): Promise<void> {
        try {
            const confirmation = await vscode.window.showWarningMessage(
                'Are you sure you want to clear your license? Premium features will be disabled.',
                { modal: true },
                'Clear License',
                'Cancel'
            );

            if (confirmation !== 'Clear License') {
                return;
            }

            this.logger.info(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - Clearing license`);

            await this.licenseManager.clearLicenseKey();
            
            vscode.window.showInformationMessage(
                '✅ License cleared successfully. Extension is now running in free mode.',
                'Get Premium License'
            ).then(selection => {
                if (selection === 'Get Premium License') {
                    this.upgradeLicenseCommand();
                }
            });

        } catch (error) {
            this.logger.error(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - Error clearing license: ${error}`);
            vscode.window.showErrorMessage(`Failed to clear license: ${error}`);
        }
    }

    /**
     * Command: Upgrade to premium
     */
    async upgradeLicenseCommand(): Promise<void> {
        this.logger.info(`🔑 ${getVersionedLogger('LICENSE COMMANDS')} - Opening upgrade page`);

        const upgradeUrl = 'https://sylang.com/pricing';
        
        const selection = await vscode.window.showInformationMessage(
            '🚀 Upgrade to Sylang Premium for advanced features:\n\n• Dynamic file types (.fma, .haz, etc.)\n• Advanced validation rules\n• Custom syntax highlighting\n• Priority support',
            'Visit Pricing Page',
            'Enter License Key'
        );

        switch (selection) {
            case 'Visit Pricing Page':
                vscode.env.openExternal(vscode.Uri.parse(upgradeUrl));
                break;
            case 'Enter License Key':
                await this.enterLicenseCommand();
                break;
        }
    }

    /**
     * Show premium feature required message
     */
    async showPremiumRequiredMessage(feature: PremiumFeature): Promise<void> {
        const featureNames: Record<PremiumFeature, string> = {
            [PremiumFeature.DYNAMIC_FILE_TYPES]: 'Dynamic File Types',
            [PremiumFeature.ADVANCED_VALIDATION]: 'Advanced Validation',
            [PremiumFeature.CUSTOM_SYNTAX]: 'Custom Syntax Highlighting',
            [PremiumFeature.ENTERPRISE_INTEGRATIONS]: 'Enterprise Integrations',
            [PremiumFeature.TEAM_COLLABORATION]: 'Team Collaboration'
        };

        const featureName = featureNames[feature] || feature;

        const selection = await vscode.window.showWarningMessage(
            `🔒 ${featureName} requires a Premium license.\n\nUpgrade to unlock this feature and more.`,
            'Get Premium License',
            'Enter License Key'
        );

        switch (selection) {
            case 'Get Premium License':
                await this.upgradeLicenseCommand();
                break;
            case 'Enter License Key':
                await this.enterLicenseCommand();
                break;
        }
    }
}
