"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SylangAILogger = exports.LogLevel = void 0;
const vscode = __importStar(require("vscode"));
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
class SylangAILogger {
    constructor(component = 'SYLANG_AI', logLevel = LogLevel.INFO) {
        this.component = component;
        this.logLevel = logLevel;
        this.version = this.getExtensionVersion();
        this.outputChannel = vscode.window.createOutputChannel('Sylang AI');
    }
    getExtensionVersion() {
        try {
            const extension = vscode.extensions.getExtension('balaji-embedcentrum.sylangai');
            return extension?.packageJSON?.version || '1.2.1';
        }
        catch (error) {
            return '1.2.1';
        }
    }
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
        return `[${timestamp}] [${level}] 🤖 ${this.component} v${this.version} - ${message}${contextStr}`;
    }
    log(level, levelName, message, context) {
        if (level >= this.logLevel) {
            const formattedMessage = this.formatMessage(levelName, message, context);
            this.outputChannel.appendLine(formattedMessage);
            // Auto-show output panel for errors
            if (level === LogLevel.ERROR) {
                this.outputChannel.show(true);
            }
        }
    }
    debug(message, context) {
        this.log(LogLevel.DEBUG, 'DEBUG', message, context);
    }
    info(message, context) {
        this.log(LogLevel.INFO, 'INFO', message, context);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, 'WARN', message, context);
    }
    error(message, error) {
        const context = error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
        } : undefined;
        this.log(LogLevel.ERROR, 'ERROR', message, context);
    }
    setLogLevel(level) {
        this.logLevel = level;
        this.info(`Log level changed to ${LogLevel[level]}`);
    }
    show() {
        this.outputChannel.show();
    }
    clear() {
        this.outputChannel.clear();
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.SylangAILogger = SylangAILogger;
//# sourceMappingURL=logger.js.map