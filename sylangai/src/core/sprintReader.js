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
exports.SprintContextReader = void 0;
const vscode = __importStar(require("vscode"));
class SprintContextReader {
    constructor(logger) {
        this.logger = logger;
    }
    async findSprintFiles() {
        this.logger.debug('Searching for .spr files in workspace');
        const sprintFiles = await vscode.workspace.findFiles('**/*.spr', '**/node_modules/**');
        this.logger.info(`Found ${sprintFiles.length} sprint files`, {
            files: sprintFiles.map(f => f.fsPath)
        });
        return sprintFiles;
    }
    async readSprintContext(uri) {
        try {
            this.logger.debug(`Reading sprint context from: ${uri.fsPath}`);
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();
            const lines = content.split('\n');
            const context = {
                sprintName: '',
                tasks: [],
                fileUri: uri
            };
            let currentTask = null;
            let indentLevel = 0;
            let parentStack = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('//')) {
                    continue;
                }
                const currentIndent = this.getIndentLevel(line);
                // Handle header definition
                if (trimmedLine.startsWith('hdef sprint ')) {
                    const match = trimmedLine.match(/hdef\s+sprint\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                    if (match) {
                        context.sprintName = match[1];
                        this.logger.debug(`Found sprint: ${context.sprintName}`);
                    }
                    continue;
                }
                // Handle sprint properties
                if (this.isSprintProperty(trimmedLine)) {
                    this.parseSprintProperty(context, trimmedLine);
                    continue;
                }
                // Handle task definitions
                if (trimmedLine.startsWith('def ')) {
                    // Save previous task if exists
                    if (currentTask && currentTask.name) {
                        this.finalizeTask(context, currentTask, parentStack);
                    }
                    // Start new task
                    currentTask = this.parseTaskDefinition(trimmedLine, i, currentIndent, parentStack);
                    indentLevel = currentIndent;
                    continue;
                }
                // Handle task properties
                if (currentTask && this.isTaskProperty(trimmedLine)) {
                    this.parseTaskProperty(currentTask, trimmedLine);
                    continue;
                }
            }
            // Save final task
            if (currentTask && currentTask.name) {
                this.finalizeTask(context, currentTask, parentStack);
            }
            this.logger.info(`Parsed sprint context`, {
                sprint: context.sprintName,
                taskCount: context.tasks.length,
                tasksByStatus: this.groupTasksByStatus(context.tasks)
            });
            return context;
        }
        catch (error) {
            this.logger.error(`Failed to read sprint context from ${uri.fsPath}`, error);
            return null;
        }
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
    isSprintProperty(line) {
        return /^\s*(name|description|owner|startdate|enddate)\s+/.test(line);
    }
    parseSprintProperty(context, line) {
        const match = line.match(/^\s*(\w+)\s+"([^"]+)"/);
        if (match) {
            const [, property, value] = match;
            switch (property) {
                case 'name':
                    context.sprintDescription = value;
                    break;
                case 'description':
                    context.sprintDescription = value;
                    break;
                case 'owner':
                    context.sprintOwner = value;
                    break;
                case 'startdate':
                    context.startdate = value;
                    break;
                case 'enddate':
                    context.enddate = value;
                    break;
            }
        }
    }
    parseTaskDefinition(line, lineNumber, indentLevel, parentStack) {
        const match = line.match(/def\s+(epic|story|task)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (match) {
            const [, type, name] = match;
            // Update parent stack based on indentation
            while (parentStack.length > 0 && indentLevel <= 0) {
                parentStack.pop();
            }
            const task = {
                name,
                type: type,
                issuestatus: 'backlog',
                line: lineNumber,
                parent: parentStack.length > 0 ? parentStack[parentStack.length - 1] : undefined
            };
            return task;
        }
        return {};
    }
    isTaskProperty(line) {
        return /^\s*(name|description|assignedto|issuestatus|priority|points|outputfile)\s+/.test(line);
    }
    parseTaskProperty(task, line) {
        // Handle both quoted and unquoted values
        const quotedMatch = line.match(/^\s*(\w+)\s+"([^"]+)"/);
        const unquotedMatch = line.match(/^\s*(\w+)\s+([^\s]+)/);
        const match = quotedMatch || unquotedMatch;
        if (match) {
            const [, property, value] = match;
            switch (property) {
                case 'description':
                    task.description = value;
                    break;
                case 'assignedto':
                    task.assignedto = value;
                    break;
                case 'issuestatus':
                    task.issuestatus = value;
                    break;
                case 'priority':
                    task.priority = value;
                    break;
                case 'points':
                    task.points = value;
                    break;
                case 'outputfile':
                    task.outputfile = value.replace(/"/g, ''); // Remove quotes if present
                    break;
            }
        }
    }
    finalizeTask(context, task, parentStack) {
        if (task.name && task.type && task.issuestatus !== undefined) {
            context.tasks.push(task);
            // Add to parent stack for potential children
            if (task.type === 'epic' || task.type === 'story') {
                parentStack.push(task.name);
            }
        }
    }
    groupTasksByStatus(tasks) {
        return tasks.reduce((acc, task) => {
            acc[task.issuestatus] = (acc[task.issuestatus] || 0) + 1;
            return acc;
        }, {});
    }
    async getNextAvailableTask(context) {
        // Find first TASK (not epic/story) with status 'open' or 'backlog'
        const availableTask = context.tasks.find(task => task.type === 'task' && // ONLY actual tasks, not epic/story containers
            (task.issuestatus === 'open' || task.issuestatus === 'backlog'));
        if (availableTask) {
            this.logger.info(`Found next available TASK: ${availableTask.name}`, {
                type: availableTask.type,
                status: availableTask.issuestatus,
                assignedto: availableTask.assignedto,
                outputfile: availableTask.outputfile
            });
        }
        else {
            this.logger.info('No available TASKS found in sprint (epics/stories are containers, only tasks execute)');
        }
        return availableTask || null;
    }
}
exports.SprintContextReader = SprintContextReader;
//# sourceMappingURL=sprintReader.js.map