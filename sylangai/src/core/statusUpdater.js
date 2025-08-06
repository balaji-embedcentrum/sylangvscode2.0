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
exports.SprintStatusUpdater = void 0;
const vscode = __importStar(require("vscode"));
class SprintStatusUpdater {
    constructor(logger) {
        this.logger = logger;
    }
    async updateTaskStatus(context, taskName, newStatus) {
        try {
            this.logger.info(`Updating task status: ${taskName} -> ${newStatus}`);
            const document = await vscode.workspace.openTextDocument(context.fileUri);
            const content = document.getText();
            const lines = content.split('\n');
            let taskFound = false;
            let statusUpdated = false;
            let inTargetTask = false;
            let taskIndent = -1; // Initialize with -1 to indicate not found
            // Find the task and update its status
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                // Find the target task
                if (trimmedLine.includes(`def `) && trimmedLine.includes(taskName)) {
                    const taskMatch = trimmedLine.match(/def\s+(epic|story|task)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                    if (taskMatch && taskMatch[2] === taskName) {
                        inTargetTask = true;
                        taskFound = true;
                        taskIndent = this.getIndentLevel(line);
                        this.logger.debug(`Found target task ${taskName} at line ${i + 1} with indent ${taskIndent}`);
                        continue;
                    }
                }
                // Check if we've left the target task
                if (inTargetTask) {
                    const currentIndent = this.getIndentLevel(line);
                    if (trimmedLine.startsWith('def ') && currentIndent <= taskIndent) {
                        // We've moved to next task at same or higher level
                        inTargetTask = false;
                        this.logger.debug(`Left target task at line ${i + 1}`);
                        if (statusUpdated) {
                            break;
                        }
                    }
                }
                // Update status if we're in the target task
                if (inTargetTask && trimmedLine.startsWith('issuestatus ')) {
                    // Calculate correct indentation - task properties should be indented 2 more spaces than task def
                    const correctIndent = ' '.repeat(taskIndent + 2);
                    lines[i] = `${correctIndent}issuestatus ${newStatus}`;
                    statusUpdated = true;
                    this.logger.info(`Fixed indentation for status line ${i + 1}: "${lines[i]}" (${taskIndent + 2} spaces)`);
                    break;
                }
            }
            if (!taskFound) {
                this.logger.error(`Task not found: ${taskName}`);
                return false;
            }
            if (!statusUpdated) {
                // Add issuestatus if it doesn't exist
                statusUpdated = await this.addStatusToTask(lines, taskName, newStatus);
            }
            if (statusUpdated) {
                // Write the updated content back to file
                const edit = new vscode.WorkspaceEdit();
                const range = new vscode.Range(0, 0, document.lineCount, 0);
                edit.replace(context.fileUri, range, lines.join('\n'));
                const success = await vscode.workspace.applyEdit(edit);
                if (success) {
                    await document.save();
                    this.logger.info(`Successfully updated task status: ${taskName} -> ${newStatus}`);
                    return true;
                }
                else {
                    this.logger.error('Failed to apply workspace edit');
                    return false;
                }
            }
            this.logger.warn(`No status update needed for task: ${taskName}`);
            return false;
        }
        catch (error) {
            this.logger.error(`Failed to update task status: ${taskName}`, error);
            return false;
        }
    }
    async addStatusToTask(lines, taskName, status) {
        let inTargetTask = false;
        let taskIndent = 0;
        let insertIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            // Find the target task
            if (trimmedLine.includes(`def `) && trimmedLine.includes(taskName)) {
                const taskMatch = trimmedLine.match(/def\s+(epic|story|task)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                if (taskMatch && taskMatch[2] === taskName) {
                    inTargetTask = true;
                    taskIndent = this.getIndentLevel(line);
                    this.logger.debug(`Adding status to task ${taskName} with indent ${taskIndent}`);
                    continue;
                }
            }
            // If we're in the target task, look for insertion point
            if (inTargetTask) {
                const currentIndent = this.getIndentLevel(line);
                // If we hit the next task at same or higher level, insert before it
                if (trimmedLine.startsWith('def ') && currentIndent <= taskIndent) {
                    insertIndex = i;
                    break;
                }
                // If we have task properties, remember the last one
                if (currentIndent > taskIndent && trimmedLine.match(/^\s*(name|description|assignedto|priority|points|outputfile)\s+/)) {
                    insertIndex = i + 1;
                }
            }
        }
        // If no insertion point found, add at end
        if (insertIndex === -1 && inTargetTask) {
            insertIndex = lines.length;
        }
        if (insertIndex !== -1) {
            const statusLine = ' '.repeat(taskIndent + 2) + `issuestatus ${status}`;
            lines.splice(insertIndex, 0, statusLine);
            this.logger.debug(`Added status line at index ${insertIndex}: ${statusLine}`);
            return true;
        }
        this.logger.error(`Could not find insertion point for status in task: ${taskName}`);
        return false;
    }
    getIndentLevel(line) {
        let indent = 0;
        for (const char of line) {
            if (char === ' ') {
                indent++;
            }
            else if (char === '\t') {
                indent += 2;
            }
            else {
                break;
            }
        }
        return indent;
    }
    async markTaskInProgress(context, task) {
        return await this.updateTaskStatus(context, task.name, 'inprogress');
    }
    async markTaskDone(context, task) {
        return await this.updateTaskStatus(context, task.name, 'done');
    }
    async markTaskBlocked(context, task, reason) {
        const success = await this.updateTaskStatus(context, task.name, 'blocked');
        if (success && reason) {
            this.logger.info(`Task ${task.name} blocked: ${reason}`);
        }
        return success;
    }
    async verifyOutputFileExists(task) {
        if (!task.outputfile) {
            this.logger.debug(`Task ${task.name} has no expected output file`);
            return true; // No file expected, consider it valid
        }
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (!workspaceRoot) {
                this.logger.warn('No workspace root found');
                return false;
            }
            const outputFileUri = vscode.Uri.joinPath(workspaceRoot, task.outputfile);
            await vscode.workspace.fs.stat(outputFileUri);
            this.logger.info(`✅ SUCCESS! File exists: ${task.outputfile}`);
            return true;
        }
        catch (error) {
            this.logger.info(`🔍 File not yet created by AI: ${task.outputfile} (this is expected while AI is working)`);
            return false;
        }
    }
}
exports.SprintStatusUpdater = SprintStatusUpdater;
//# sourceMappingURL=statusUpdater.js.map