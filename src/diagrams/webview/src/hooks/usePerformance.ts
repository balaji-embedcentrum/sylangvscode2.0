import { useState, useCallback } from 'preact/hooks';

interface PerformanceMetrics {
  renderTime: number;
  layoutTime: number;
  dataTransformTime: number;
  totalTime: number;
  memoryUsage: number;
  nodeCount: number;
  edgeCount: number;
}

export function usePerformance() {
  const [startTime, setStartTime] = useState<number>(0);

  const startTimer = useCallback(() => {
    setStartTime(performance.now());
  }, []);

  const endTimer = useCallback((): number => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    setStartTime(0);
    return duration;
  }, [startTime]);

  const reportMetrics = useCallback((metrics: Partial<PerformanceMetrics>) => {
    if (window.reportPerformance) {
      window.reportPerformance(metrics);
    }
  }, []);

  const reportError = useCallback((error: any) => {
    if (window.reportError) {
      window.reportError(error);
    }
    console.error('Diagram error:', error);
  }, []);

  return {
    startTimer,
    endTimer,
    reportMetrics,
    reportError
  };
} 