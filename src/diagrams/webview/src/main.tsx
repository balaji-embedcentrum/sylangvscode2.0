// Polyfill for CustomEvent in VSCode webview - MUST BE FIRST
if (typeof window !== 'undefined' && !window.CustomEvent) {
  (window as any).CustomEvent = function(event: string, params: any) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    const evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt;
  };
  (window as any).CustomEvent.prototype = (window as any).Event.prototype;
}

// Additional polyfills for VSCode webview environment
if (typeof window !== 'undefined') {
  // Ensure requestAnimationFrame is available
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      return setTimeout(callback, 16);
    };
  }
  
  // Ensure cancelAnimationFrame is available
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (handle: number) => {
      clearTimeout(handle);
    };
  }
}

import { render } from 'preact';
import { DiagramContainer } from './components/DiagramContainer';
import { WebviewLogger } from './utils/logger';

// Global types for VSCode webview API
declare global {
  interface Window {
    diagramData: any;
    diagramType: string;
    vscode: any;
    reportPerformance: (metrics: any) => void;
    reportError: (error: any) => void;
    _originalConsole: {
      log: (...args: any[]) => void;
      error: (...args: any[]) => void;
      warn: (...args: any[]) => void;
    };
  }
}

WebviewLogger.info('🔧 WEBVIEW MAIN - Script starting to load');

// Initialize VSCode webview API
const vscode = window.acquireVsCodeApi?.();
WebviewLogger.info(`🔧 WEBVIEW MAIN - VSCode API acquired: ${!!vscode}`);

// Set global vscode instance
window.vscode = vscode;

// Now set up console override to send messages to extension
if (vscode && window._originalConsole) {
  const originalConsole = window._originalConsole;
  
  console.log = function(...args) {
    originalConsole.log(...args);
    vscode.postMessage({
      type: 'console',
      payload: { message: args.join(' '), level: 'log' },
      timestamp: Date.now()
    });
  };
  
  console.error = function(...args) {
    originalConsole.error(...args);
    vscode.postMessage({
      type: 'console',
      payload: { message: args.join(' '), level: 'error' },
      timestamp: Date.now()
    });
  };
  
  console.warn = function(...args) {
    originalConsole.warn(...args);
    vscode.postMessage({
      type: 'console',
      payload: { message: args.join(' '), level: 'warn' },
      timestamp: Date.now()
    });
  };
  
  WebviewLogger.info('🔧 WEBVIEW MAIN - Console override activated with vscode messaging');
}

// Send ready message to extension
if (vscode) {
  WebviewLogger.info('🔧 WEBVIEW MAIN - Sending ready message to extension');
  vscode.postMessage({
    type: 'ready',
    payload: {},
    timestamp: Date.now()
  });
  WebviewLogger.info('🔧 WEBVIEW MAIN - Ready message sent');
} else {
  WebviewLogger.warn('🔧 WEBVIEW MAIN - No VSCode API available, cannot send ready message');
}

// Handle performance metrics
window.reportPerformance = function(metrics: any) {
  WebviewLogger.info(`🔧 WEBVIEW MAIN - Reporting performance metrics: ${JSON.stringify(metrics)}`);
  if (vscode) {
    vscode.postMessage({
      type: 'performance',
      payload: metrics,
      timestamp: Date.now()
    });
  }
};

// Handle errors
window.reportError = function(error: any) {
  WebviewLogger.error(`🔧 WEBVIEW MAIN - Reporting error: ${JSON.stringify(error)}`);
  if (vscode) {
    vscode.postMessage({
      type: 'error',
      payload: error,
      timestamp: Date.now()
    });
  }
};

// Main application component
function App() {
  WebviewLogger.info('🔧 WEBVIEW MAIN - App component rendering');
  WebviewLogger.info(`🔧 WEBVIEW MAIN - App component data: diagramData=${!!window.diagramData}, diagramType=${window.diagramType}`);
  
  return (
    <DiagramContainer 
      diagramData={window.diagramData}
      diagramType={window.diagramType}
    />
  );
}

// Wait for diagram data to be ready before rendering
function initializeApp() {
  WebviewLogger.info('🔧 WEBVIEW MAIN - Initializing app');
  
  const container = document.getElementById('diagram-container');
  if (!container) {
    WebviewLogger.error('🔧 WEBVIEW MAIN - Diagram container not found');
    return;
  }

  // Debug: Log current state
  WebviewLogger.info(`🔧 WEBVIEW MAIN - Container found: ${!!container}`);
  WebviewLogger.info(`🔧 WEBVIEW MAIN - window.diagramData: ${JSON.stringify(window.diagramData ? {
    nodes: window.diagramData.nodes?.length || 'no nodes',
    edges: window.diagramData.edges?.length || 'no edges',
    metadata: window.diagramData.metadata ? 'has metadata' : 'no metadata'
  } : 'null/undefined')}`);
  WebviewLogger.info(`🔧 WEBVIEW MAIN - window.diagramType: ${window.diagramType}`);

  // Check if data is already available
  if (window.diagramData && window.diagramType) {
    WebviewLogger.info('🔧 WEBVIEW MAIN - Data available, rendering immediately');
    try {
      render(<App />, container);
      WebviewLogger.info('🔧 WEBVIEW MAIN - App rendered successfully');
    } catch (error) {
      WebviewLogger.error(`🔧 WEBVIEW MAIN - Error rendering app: ${error}`);
      WebviewLogger.error(`🔧 WEBVIEW MAIN - Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    }
  } else {
    WebviewLogger.info('🔧 WEBVIEW MAIN - Data not available, waiting for event');
    // Wait for the custom event
    window.addEventListener('diagramDataReady', (event: any) => {
      WebviewLogger.info(`🔧 WEBVIEW MAIN - Received diagramDataReady event: ${JSON.stringify(event.detail ? {
        hasData: !!event.detail.data,
        type: event.detail.type,
        nodeCount: event.detail.data?.nodes?.length || 'unknown'
      } : 'no detail')}`);
      
      window.diagramData = event.detail.data;
      window.diagramType = event.detail.type;
      WebviewLogger.info('🔧 WEBVIEW MAIN - Set data from event, rendering app');
      
      try {
        render(<App />, container);
        WebviewLogger.info('🔧 WEBVIEW MAIN - App rendered successfully from event');
      } catch (error) {
        WebviewLogger.error(`🔧 WEBVIEW MAIN - Error rendering app from event: ${error}`);
        WebviewLogger.error(`🔧 WEBVIEW MAIN - Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      }
    });
    WebviewLogger.info('🔧 WEBVIEW MAIN - Event listener added for diagramDataReady');
  }
}

// Initialize the app
WebviewLogger.info('🔧 WEBVIEW MAIN - Calling initializeApp');
initializeApp();
WebviewLogger.info('🔧 WEBVIEW MAIN - Script loading completed'); 