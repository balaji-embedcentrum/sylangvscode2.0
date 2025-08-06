import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export class SylangLogger {
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel = LogLevel.INFO;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Sylang');
        this.updateLogLevel();
        
        // Show the output channel on activation to display version
        this.outputChannel.show(true);
    }

    private updateLogLevel(): void {
        const config = vscode.workspace.getConfiguration('sylang');
        const levelString = config.get<string>('logging.level', 'info');
        
        switch (levelString.toLowerCase()) {
            case 'debug':
                this.logLevel = LogLevel.DEBUG;
                break;
            case 'info':
                this.logLevel = LogLevel.INFO;
                break;
            case 'warn':
                this.logLevel = LogLevel.WARN;
                break;
            case 'error':
                this.logLevel = LogLevel.ERROR;
                break;
            default:
                this.logLevel = LogLevel.INFO;
        }
    }

    private log(level: LogLevel, message: string): void {
        if (level >= this.logLevel) {
            const timestamp = new Date().toISOString();
            const levelName = LogLevel[level];
            const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;
            
            this.outputChannel.appendLine(formattedMessage);
            
            // Also log to VS Code developer console for debugging
            if (level === LogLevel.ERROR) {
                console.error(`Sylang: ${message}`);
            } else if (level === LogLevel.WARN) {
                console.warn(`Sylang: ${message}`);
            } else {
                console.log(`Sylang: ${message}`);
            }
        }
    }

    debug(message: string): void {
        this.log(LogLevel.DEBUG, message);
    }

    info(message: string): void {
        this.log(LogLevel.INFO, message);
    }

    warn(message: string): void {
        this.log(LogLevel.WARN, message);
    }

    error(message: string): void {
        this.log(LogLevel.ERROR, message);
    }

    show(): void {
        this.outputChannel.show();
    }

    hide(): void {
        this.outputChannel.hide();
    }

    clear(): void {
        this.outputChannel.clear();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
} 