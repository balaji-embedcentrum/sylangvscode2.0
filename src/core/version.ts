/**
 * Centralized version management for Sylang VSCode Extension
 * Update this file when bumping version numbers
 */

export const SYLANG_VERSION = '2.9.122';

export function getVersionedMessage(message: string): string {
    return `v${SYLANG_VERSION} - ${message}`;
}

export function getVersionedSource(): string {
    return `sylang v${SYLANG_VERSION}`;
}

export function getVersionedLogger(component: string): string {
    return `${component} v${SYLANG_VERSION}`;
} 