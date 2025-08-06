import * as vscode from 'vscode';
import { SylangLogger } from '../../core/logger';
import { SylangDiagramManager } from './diagramManager';
import { UpdateTrigger } from '../types/diagramTypes';
import { getVersionedLogger } from '../../core/version';

interface QueuedUpdate {
  fileUri: vscode.Uri;
  trigger: UpdateTrigger;
  timeout: NodeJS.Timeout;
}

export class DiagramUpdateQueue {
  private logger: SylangLogger;
  private diagramManager: SylangDiagramManager;
  private updateQueue: Map<string, QueuedUpdate> = new Map();
  private isDisposed: boolean = false;

  constructor(logger: SylangLogger, diagramManager: SylangDiagramManager) {
    this.logger = logger;
    this.diagramManager = diagramManager;
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM UPDATE QUEUE')} - Initialized`);
  }

  /**
   * Queues an update for a file with debouncing
   */
  queueUpdate(fileUri: vscode.Uri, trigger: UpdateTrigger): void {
    if (this.isDisposed) {
      return;
    }

    const fileKey = fileUri.toString();
    
    // Cancel existing timeout for this file
    const existing = this.updateQueue.get(fileKey);
    if (existing) {
      clearTimeout(existing.timeout);
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM UPDATE QUEUE')} - Cancelled existing update for: ${fileUri.fsPath}`);
    }

    // Determine debounce delay based on trigger type
    const delay = this.getDebounceDelay(trigger);

    // Schedule new update
    const timeout = setTimeout(() => {
      this.processUpdate(fileUri, trigger);
      this.updateQueue.delete(fileKey);
    }, delay);

    // Store the queued update
    this.updateQueue.set(fileKey, {
      fileUri,
      trigger,
      timeout
    });

    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM UPDATE QUEUE')} - Queued update for: ${fileUri.fsPath} (trigger: ${trigger}, delay: ${delay}ms)`);
  }

  /**
   * Processes an update immediately
   */
  private async processUpdate(fileUri: vscode.Uri, trigger: UpdateTrigger): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    try {
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM UPDATE QUEUE')} - Processing update for: ${fileUri.fsPath} (trigger: ${trigger})`);
      await this.diagramManager.processUpdate(fileUri, trigger);
    } catch (error) {
      this.logger.error(`🔧 ${getVersionedLogger('DIAGRAM UPDATE QUEUE')} - Error processing update: ${error}`);
    }
  }

  /**
   * Gets debounce delay based on trigger type
   */
  private getDebounceDelay(trigger: UpdateTrigger): number {
    switch (trigger) {
      case UpdateTrigger.FileClick:
        return 0; // Immediate for file clicks
      case UpdateTrigger.DiagramFocus:
        return 100; // Short delay for focus events
      case UpdateTrigger.FileChange:
        return 300; // Standard delay for file changes
      case UpdateTrigger.ManualRefresh:
        return 0; // Immediate for manual refresh
      default:
        return 300; // Default delay
    }
  }

  /**
   * Cancels all pending updates
   */
  cancelAllUpdates(): void {
    for (const [, update] of this.updateQueue) {
      clearTimeout(update.timeout);
      this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM UPDATE QUEUE')} - Cancelled update for: ${update.fileUri.fsPath}`);
    }
    this.updateQueue.clear();
  }

  /**
   * Gets the number of pending updates
   */
  getPendingUpdateCount(): number {
    return this.updateQueue.size;
  }

  /**
   * Gets pending updates for debugging
   */
  getPendingUpdates(): Array<{ fileUri: string; trigger: UpdateTrigger }> {
    return Array.from(this.updateQueue.values()).map(update => ({
      fileUri: update.fileUri.fsPath,
      trigger: update.trigger
    }));
  }

  /**
   * Disposes the update queue
   */
  dispose(): void {
    this.isDisposed = true;
    this.cancelAllUpdates();
    this.logger.debug(`🔧 ${getVersionedLogger('DIAGRAM UPDATE QUEUE')} - Disposed`);
  }
} 