// Webview logger utility that sends messages to VSCode extension
declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
    };
    vscode: any;
  }
}

export class WebviewLogger {
  private static sendLog(level: 'debug' | 'info' | 'warn' | 'error', message: string) {
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'log',
        payload: {
          message,
          level
        },
        timestamp: Date.now()
      });
    }
  }

  static debug(message: string) {
    this.sendLog('debug', message);
  }

  static info(message: string) {
    this.sendLog('info', message);
  }

  static warn(message: string) {
    this.sendLog('warn', message);
  }

  static error(message: string) {
    this.sendLog('error', message);
  }
} 