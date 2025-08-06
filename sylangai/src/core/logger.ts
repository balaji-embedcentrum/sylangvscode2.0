import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export class SylangAILogger {
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel;
    private component: string;
    private version: string;

    constructor(component: string = 'SYLANG_AI', logLevel: LogLevel = LogLevel.INFO) {
        this.component = component;
        this.logLevel = logLevel;
        this.version = this.getExtensionVersion();
        this.outputChannel = vscode.window.createOutputChannel('Sylang AI');
    }

    private getExtensionVersion(): string {
        try {
            const extension = vscode.extensions.getExtension('balaji-embedcentrum.sylangai');
            return extension?.packageJSON?.version || '1.2.1';
        } catch (error) {
            return '1.2.1';
        }
    }

    private formatMessage(level: string, message: string, context?: any): string {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
        return `[${timestamp}] [${level}] 🤖 ${this.component} v${this.version} - ${message}${contextStr}`;
    }

    private log(level: LogLevel, levelName: string, message: string, context?: any): void {
        if (level >= this.logLevel) {
            const formattedMessage = this.formatMessage(levelName, message, context);
            this.outputChannel.appendLine(formattedMessage);
            
            // Auto-show output panel for errors
            if (level === LogLevel.ERROR) {
                this.outputChannel.show(true);
            }
        }
    }

    debug(message: string, context?: any): void {
        this.log(LogLevel.DEBUG, 'DEBUG', message, context);
    }

    info(message: string, context?: any): void {
        this.log(LogLevel.INFO, 'INFO', message, context);
    }

    warn(message: string, context?: any): void {
        this.log(LogLevel.WARN, 'WARN', message, context);
    }

    error(message: string, error?: any): void {
        const context = error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
        } : undefined;
        this.log(LogLevel.ERROR, 'ERROR', message, context);
    }

    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
        this.info(`Log level changed to ${LogLevel[level]}`);
    }

    show(): void {
        this.outputChannel.show();
    }

    clear(): void {
        this.outputChannel.clear();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
} 