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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("./core/logger");
const sprintReader_1 = require("./core/sprintReader");
const statusUpdater_1 = require("./core/statusUpdater");
const aiPromptGenerator_1 = require("./core/aiPromptGenerator");
let logger;
let sprintWorkflow;
function activate(context) {
    logger = new logger_1.SylangAILogger('SYLANG_AI', logger_1.LogLevel.INFO);
    logger.info('🚀 Sylang AI Integration Extension ACTIVATED');
    logger.show(); // Force show the output panel
    sprintWorkflow = new SprintAIWorkflow(context, logger);
    // Create status bar item for sprint progress
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '🤖 Sylang AI Ready';
    statusBarItem.tooltip = 'Click to run sprint automation';
    statusBarItem.command = 'sylang.ai.runAutoAgent';
    statusBarItem.show();
    const disposable = vscode.commands.registerCommand('sylang.ai.runAutoAgent', async () => {
        logger.info('🎯 RUN AUTO AI AGENT COMMAND TRIGGERED');
        logger.info('🔍 About to call executeSprintLoop()');
        try {
            await sprintWorkflow.executeSprintLoop();
            logger.info('✅ executeSprintLoop() completed');
        }
        catch (error) {
            logger.error('❌ executeSprintLoop() failed', error);
        }
    });
    const resetDisposable = vscode.commands.registerCommand('sylang.ai.resetSprint', async () => {
        logger.info('🔄 RESET SPRINT COMMAND TRIGGERED');
        try {
            await sprintWorkflow.resetSprintStatus();
            logger.info('✅ Sprint reset completed');
            vscode.window.showInformationMessage('✅ Sprint tasks reset to open status');
        }
        catch (error) {
            logger.error('❌ Sprint reset failed', error);
            vscode.window.showErrorMessage('❌ Sprint reset failed: ' + error);
        }
    });
    logger.info('✅ Commands registered: sylang.ai.runAutoAgent, sylang.ai.resetSprint');
    context.subscriptions.push(disposable, resetDisposable);
    context.subscriptions.push(logger);
}
exports.activate = activate;
function deactivate() {
    if (logger) {
        logger.info('Sylang AI Integration Extension deactivated');
        logger.dispose();
    }
}
exports.deactivate = deactivate;
class SprintAIWorkflow {
    constructor(context, logger) {
        this.isLoopRunning = false;
        this.currentSprintContext = null;
        this.context = context;
        this.logger = logger;
        this.sprintReader = new sprintReader_1.SprintContextReader(logger);
        this.statusUpdater = new statusUpdater_1.SprintStatusUpdater(logger);
        this.promptGenerator = new aiPromptGenerator_1.AIPromptGenerator(logger);
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.show();
        this.updateStatusBar('🤖 Ready');
    }
    async executeSprintLoop() {
        if (this.isLoopRunning) {
            this.logger.info('⚠️ Sprint loop already running, skipping...');
            return;
        }
        try {
            this.isLoopRunning = true;
            this.updateStatusBar('🚀 Starting Sprint AI Loop...');
            this.logger.info('🚀 Starting Sprint AI Auto-Loop');
            // Step 1: Find and read sprint files
            this.logger.info('🔍 Step 1: Searching for .spr files...');
            const sprintFiles = await this.sprintReader.findSprintFiles();
            this.logger.info(`📁 Found ${sprintFiles.length} sprint files:`, { files: sprintFiles.map(f => f.fsPath) });
            if (sprintFiles.length === 0) {
                vscode.window.showWarningMessage('No .spr files found in workspace');
                this.logger.info('❌ No sprint files found in workspace - STOPPING');
                this.updateStatusBar('❌ No .spr files found');
                return;
            }
            // Step 2: Read sprint context
            this.logger.info(`🔍 Step 2: Reading sprint context from: ${sprintFiles[0].fsPath}`);
            this.currentSprintContext = await this.sprintReader.readSprintContext(sprintFiles[0]);
            if (!this.currentSprintContext) {
                vscode.window.showErrorMessage('Failed to read sprint context');
                this.logger.info('❌ Failed to read sprint context - STOPPING');
                this.updateStatusBar('❌ Failed to read sprint');
                return;
            }
            this.logger.info(`📋 Sprint loaded: ${this.currentSprintContext.sprintName}`, {
                file: sprintFiles[0].fsPath,
                taskCount: this.currentSprintContext.tasks.length,
                tasks: this.currentSprintContext.tasks.map((t) => `${t.name} (${t.assignedto}) -> ${t.outputfile}`)
            });
            // Step 3: Start the automatic loop
            this.logger.info('🔍 Step 3: Starting task processing loop...');
            let tasksCompleted = 0;
            const totalTasks = this.currentSprintContext.tasks.filter((t) => t.type === 'task').length;
            while (true) {
                this.logger.info(`🔄 Loop iteration ${tasksCompleted + 1}: Re-reading sprint context...`);
                // Re-read sprint context to get latest status
                this.currentSprintContext = await this.sprintReader.readSprintContext(sprintFiles[0]);
                this.logger.info('🔍 Looking for next available task...');
                const nextTask = await this.sprintReader.getNextAvailableTask(this.currentSprintContext);
                if (!nextTask) {
                    this.logger.info(`🎉 Sprint complete! ${tasksCompleted} tasks processed.`);
                    this.updateStatusBar(`🎉 Sprint Complete (${tasksCompleted}/${totalTasks})`);
                    vscode.window.showInformationMessage(`🎉 All tasks completed! Processed ${tasksCompleted} tasks automatically.`);
                    break;
                }
                this.logger.info(`📋 Processing task ${tasksCompleted + 1}: ${nextTask.name}`, {
                    type: nextTask.type,
                    assignedto: nextTask.assignedto,
                    status: nextTask.issuestatus,
                    outputfile: nextTask.outputfile
                });
                this.updateStatusBar(`🤖 Processing: ${nextTask.name} (${tasksCompleted + 1}/${totalTasks})`);
                this.logger.info('🔍 Calling executeTaskWorkflow...');
                const success = await this.executeTaskWorkflow(nextTask);
                if (success) {
                    tasksCompleted++;
                    this.logger.info(`✅ Task ${tasksCompleted} completed: ${nextTask.name}`);
                    this.updateStatusBar(`✅ Completed: ${nextTask.name} (${tasksCompleted}/${totalTasks})`);
                    // Small delay between tasks for user to see progress
                    this.logger.info('⏳ Waiting 3 seconds before next task...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
                else {
                    this.logger.info(`❌ Task failed: ${nextTask.name}, stopping loop`);
                    this.updateStatusBar(`❌ Failed: ${nextTask.name}`);
                    vscode.window.showErrorMessage(`❌ Task failed: ${nextTask.name}. Sprint loop stopped.`);
                    break;
                }
            }
        }
        catch (error) {
            this.logger.info('💥 Sprint AI Loop failed with error:', error);
            this.updateStatusBar('💥 Sprint failed');
            vscode.window.showErrorMessage(`Sprint AI Loop failed: ${error}`);
        }
        finally {
            this.isLoopRunning = false;
            this.updateStatusBar('🤖 Ready');
            this.logger.info('🏁 Sprint loop finished');
        }
    }
    async saveAIResponseToFile(aiResponse, taskName) {
        try {
            // Find the task to get the output file path
            if (!this.currentSprintContext) {
                this.logger.info('❌ No sprint context available for saving file');
                return;
            }
            const task = this.currentSprintContext.tasks.find((t) => t.name === taskName);
            if (!task || !task.outputfile) {
                this.logger.info(`❌ No output file specified for task: ${taskName}`);
                return;
            }
            // Get workspace root
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (!workspaceRoot) {
                this.logger.info('❌ No workspace root found');
                return;
            }
            // Create the output file path
            const outputFilePath = vscode.Uri.joinPath(workspaceRoot, task.outputfile);
            const outputDir = vscode.Uri.joinPath(outputFilePath, '..');
            // Create directory if it doesn't exist
            try {
                await vscode.workspace.fs.createDirectory(outputDir);
                this.logger.info(`📁 Created directory: ${outputDir.fsPath}`);
            }
            catch (error) {
                // Directory might already exist, that's fine
            }
            // Write the AI response to file
            await vscode.workspace.fs.writeFile(outputFilePath, Buffer.from(aiResponse, 'utf8'));
            this.logger.info(`💾 Saved AI response to: ${outputFilePath.fsPath}`);
            // Open the created file for user to see
            const document = await vscode.workspace.openTextDocument(outputFilePath);
            await vscode.window.showTextDocument(document);
            this.logger.info(`👀 Opened created file: ${task.outputfile}`);
        }
        catch (error) {
            this.logger.info(`💥 Failed to save AI response to file: ${taskName}`, error);
        }
    }
    async resetSprintStatus() {
        try {
            this.logger.info('🔄 Starting sprint status reset...');
            // Find sprint files
            const sprintFiles = await this.sprintReader.findSprintFiles();
            if (sprintFiles.length === 0) {
                this.logger.info('❌ No sprint files found');
                return;
            }
            // Read current sprint context
            const sprintContext = await this.sprintReader.readSprintContext(sprintFiles[0]);
            if (!sprintContext) {
                this.logger.info('❌ Failed to read sprint context');
                return;
            }
            this.logger.info(`🔄 Resetting ${sprintContext.tasks.length} tasks to 'open' status...`);
            // Reset all task statuses to 'open'
            for (const task of sprintContext.tasks) {
                if (task.type === 'task' && task.issuestatus !== 'open') {
                    this.logger.info(`🔄 Resetting task: ${task.name} (${task.issuestatus} -> open)`);
                    await this.statusUpdater.updateTaskStatus(sprintContext, task.name, 'open');
                }
            }
            this.logger.info('✅ All task statuses reset to open');
        }
        catch (error) {
            this.logger.info('💥 Sprint reset failed:', error);
            throw error;
        }
    }
    async executeTaskWorkflow(task) {
        try {
            this.logger.info(`🔍 executeTaskWorkflow called for: ${task.name}`);
            // Step 1: Mark task as in progress
            this.logger.info(`🔄 Step 1: Marking task as in progress: ${task.name}`);
            await this.statusUpdater.markTaskInProgress(this.currentSprintContext, task);
            // Step 2: Generate AI prompt with context
            this.logger.info(`🔍 Step 2: Getting agent context for: ${task.assignedto}`);
            const agentContext = this.getAgentContext(task.assignedto);
            this.logger.info('📝 Agent context:', agentContext);
            this.logger.info('🔍 Step 3: Generating AI prompt...');
            const aiPrompt = await this.promptGenerator.generateTaskPrompt(this.currentSprintContext, task, agentContext);
            this.logger.info(`📝 AI prompt generated (${aiPrompt.length} characters)`);
            // Step 3: Execute AI interaction
            this.logger.info('🔍 Step 4: Executing AI interaction...');
            const interactionSuccess = await this.executeAIInteraction(aiPrompt, task.name);
            if (!interactionSuccess) {
                this.logger.info('❌ AI interaction failed, marking task as blocked');
                await this.statusUpdater.markTaskBlocked(this.currentSprintContext, task, 'AI interaction failed');
                return false;
            }
            // Step 4: Mark as done immediately - trust the AI to create the file
            this.logger.info('✅ AI prompt sent successfully, marking task as done (trusting AI to create the file)');
            await this.statusUpdater.markTaskDone(this.currentSprintContext, task);
            this.logger.info(`✅ Task completed: ${task.name} -> ${task.outputfile}`);
            return true;
        }
        catch (error) {
            this.logger.info(`💥 Task workflow failed: ${task.name}`, error);
            return false;
        }
    }
    getAgentContext(assignedTo) {
        if (!assignedTo) {
            return undefined;
        }
        switch (assignedTo.toLowerCase()) {
            case 'systemsengineeragent':
            case 'systems-engineer':
                return {
                    name: 'AI Systems Engineer',
                    role: 'Systems Engineer',
                    expertise: ['systems-engineering', 'autosar', 'iso-26262', 'function-design', 'safety-architecture'],
                    context: ['sylang-dsl', 'automotive-systems', 'functional-safety', 'electric-park-brake']
                };
            case 'requirementsengineeragent':
            case 'requirements-engineer':
                return {
                    name: 'AI Requirements Engineer',
                    role: 'Requirements Engineer',
                    expertise: ['requirement-analysis', 'safety-requirements', 'iso-26262', 'traceability', 'verification'],
                    context: ['sylang-dsl', 'automotive-requirements', 'asil-d-compliance', 'functional-safety']
                };
            case 'testengineeragent':
            case 'test-engineer':
                return {
                    name: 'AI Test Engineer',
                    role: 'Test Engineer',
                    expertise: ['test-design', 'verification-validation', 'test-automation', 'safety-testing', 'coverage-analysis'],
                    context: ['sylang-dsl', 'automotive-testing', 'safety-validation', 'test-strategies']
                };
            case 'scrummaster':
            case 'scrum-master':
                return {
                    name: 'AI Scrum Master',
                    role: 'Scrum Master',
                    expertise: ['project-management', 'sprint-planning', 'agile-methodologies'],
                    context: ['sylang-dsl', 'automotive-systems', 'team-coordination']
                };
            case 'architect':
            case 'systems-architect':
                return {
                    name: 'AI Systems Architect',
                    role: 'Systems Architect',
                    expertise: ['systems-engineering', 'autosar', 'iso-26262', 'model-based-design'],
                    context: ['sylang-dsl', 'automotive-architecture', 'safety-critical-systems']
                };
            case 'sme':
            case 'subject-matter-expert':
                return {
                    name: 'AI Subject Matter Expert',
                    role: 'SME',
                    expertise: ['domain-knowledge', 'technical-specifications', 'requirement-analysis'],
                    context: ['sylang-dsl', 'automotive-domain', 'technical-documentation']
                };
            default:
                return {
                    name: `AI ${assignedTo}`,
                    role: 'Generic AI Agent',
                    expertise: ['sylang-dsl', 'systems-engineering'],
                    context: ['automotive-systems', 'model-based-engineering']
                };
        }
    }
    async executeAIInteraction(prompt, taskName) {
        // Check configuration to decide which approach to use
        const executionMode = vscode.workspace.getConfiguration('sylangai').get('executionMode', 'directAPI');
        switch (executionMode) {
            case 'directAPI':
                this.logger.info(`🤖 Using MODE 1: Direct LLM API for task: ${taskName}`);
                return await this.executeDirectAPIMode(prompt, taskName);
            case 'timeout':
                this.logger.info(`⏰ Using MODE 2: Timeout-based execution for task: ${taskName}`);
                return await this.executeTimeoutMode(prompt, taskName);
            case 'logMonitoring':
                this.logger.info(`📊 Using MODE 3: Copilot log monitoring for task: ${taskName}`);
                return await this.executeLogMonitoringMode(prompt, taskName);
            default:
                this.logger.info(`❌ Unknown execution mode: ${executionMode}, falling back to directAPI`);
                return await this.executeDirectAPIMode(prompt, taskName);
        }
    }
    async executeDirectAPIMode(prompt, taskName) {
        try {
            this.logger.info(`🤖 Executing DIRECT API interaction for task: ${taskName} using vscode.lm API`);
            // Check if vscode.lm API is available
            if (!vscode.lm) {
                this.logger.info('⚠️ vscode.lm API not available, falling back to manual chat approach');
                return await this.fallbackChatApproach(prompt, taskName);
            }
            // Step 1: Get available Copilot models
            this.logger.info('🔍 Selecting GitHub Copilot models...');
            const models = await vscode.lm.selectChatModels({ family: 'gpt-4' });
            if (models.length === 0) {
                this.logger.info('❌ No GitHub Copilot models available. Ensure Copilot is installed and enabled.');
                vscode.window.showErrorMessage('No GitHub Copilot models available. Ensure Copilot is installed and enabled.');
                return false;
            }
            // Prefer GPT-4o if available, otherwise use first available model
            let copilotModel = models.find((model) => model.name?.includes('gpt-4o') || model.name?.includes('gpt-4.1'));
            if (!copilotModel) {
                copilotModel = models[0];
            }
            this.logger.info(`✅ Using Copilot model: ${copilotModel.name} (family: ${copilotModel.family})`);
            this.logger.info(`📋 Available models: ${models.map((m) => m.name).join(', ')}`);
            // Step 2: Create the message
            const messages = [
                vscode.LanguageModelChatMessage.User(prompt)
            ];
            this.logger.info('📤 Sending request to Copilot model...');
            // Show progress dialog during AI processing
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `🤖 AI Processing: ${taskName}`,
                cancellable: false
            }, async (progress) => {
                progress.report({ message: 'Sending prompt to GPT-4o...' });
                // Step 3: Send request and await full response
                const request = await copilotModel.sendRequest(messages, {});
                progress.report({ message: 'Receiving AI response...' });
                // Step 4: Collect the full streaming response
                let fullResponse = '';
                let chunkCount = 0;
                this.logger.info('📥 Receiving streaming response...');
                try {
                    // Try different approaches to get the response
                    if (request.stream && typeof request.stream[Symbol.asyncIterator] === 'function') {
                        // Async iterator approach
                        for await (const chunk of request.stream) {
                            // Handle different chunk types - extract text content
                            let chunkText = '';
                            if (typeof chunk === 'string') {
                                chunkText = chunk;
                            }
                            else if (chunk && typeof chunk === 'object') {
                                // Try to extract text from various possible object structures
                                chunkText = chunk.text || chunk.content || chunk.message || chunk.value || JSON.stringify(chunk);
                            }
                            else {
                                chunkText = String(chunk);
                            }
                            fullResponse += chunkText;
                            chunkCount++;
                            // Update progress every 10 chunks
                            if (chunkCount % 10 === 0) {
                                progress.report({
                                    message: `AI responding... (${fullResponse.length} characters received)`,
                                    increment: 5
                                });
                            }
                        }
                    }
                    else if (request.response) {
                        // Direct response approach
                        fullResponse = request.response;
                    }
                    else {
                        // Fallback: try to get response as string
                        fullResponse = String(request);
                    }
                }
                catch (streamError) {
                    this.logger.info('⚠️ Stream processing failed, trying alternative approach:', streamError);
                    // Try to get response directly
                    fullResponse = request.response || request.text || String(request);
                }
                progress.report({ message: 'Saving response to file...' });
                this.logger.info(`✅ AI response completed (${fullResponse.length} characters)`);
                this.logger.info('📝 AI Response Preview:', { preview: fullResponse.substring(0, 200) + '...' });
                // Debug: Log response structure
                this.logger.info('🔍 Debug: Response structure:', {
                    responseType: typeof fullResponse,
                    responseLength: fullResponse.length,
                    responseStart: fullResponse.substring(0, 100),
                    hasContent: fullResponse.trim().length > 0
                });
                // Post-process: Strip any markdown code blocks that might have slipped through
                let cleanedResponse = fullResponse;
                if (fullResponse.includes('```sylang')) {
                    this.logger.info('🧹 Cleaning markdown code blocks from response...');
                    // Remove ```sylang and ``` markers
                    cleanedResponse = fullResponse
                        .replace(/```sylang\s*/g, '')
                        .replace(/```\s*$/g, '')
                        .trim();
                    this.logger.info(`🧹 Cleaned response length: ${cleanedResponse.length} characters`);
                }
                // Save the response to the expected output file if specified
                if (taskName && cleanedResponse.trim()) {
                    await this.saveAIResponseToFile(cleanedResponse, taskName);
                }
                progress.report({ message: 'Task completed!', increment: 100 });
            });
            // Show completion message
            vscode.window.showInformationMessage(`✅ Task "${taskName}" completed by AI! Response received.`);
            return true;
        }
        catch (error) {
            this.logger.info(`💥 AI interaction failed for task: ${taskName}`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('rate limit')) {
                vscode.window.showWarningMessage(`⚠️ Rate limit reached for task: ${taskName}. Please try again later.`);
            }
            else if (errorMessage.includes('model not available')) {
                vscode.window.showErrorMessage(`❌ Copilot model not available. Please check your Copilot subscription.`);
            }
            else {
                vscode.window.showErrorMessage(`❌ AI interaction failed: ${errorMessage}`);
            }
            return false;
        }
    }
    async executeTimeoutMode(prompt, taskName) {
        try {
            this.logger.info(`⏰ Starting timeout-based execution for task: ${taskName}`);
            // Get timeout from configuration
            const timeoutSeconds = vscode.workspace.getConfiguration('sylangai').get('timeoutSeconds', 30);
            // Send prompt to Copilot chat window
            this.logger.info('📤 Sending prompt to chat window...');
            await vscode.commands.executeCommand('workbench.action.chat.open', prompt);
            // Show user message and wait for timeout
            vscode.window.showInformationMessage(`🤖 Task "${taskName}" sent to chat! Waiting ${timeoutSeconds}s for completion...`);
            // Simple timeout wait
            this.logger.info(`⏰ Waiting ${timeoutSeconds} seconds for completion...`);
            await new Promise(resolve => setTimeout(resolve, timeoutSeconds * 1000));
            // Assume completion after timeout
            this.logger.info(`✅ Timeout completed for task: ${taskName}`);
            vscode.window.showInformationMessage(`✅ Task "${taskName}" timeout completed!`);
            return true;
        }
        catch (error) {
            this.logger.info(`💥 Timeout mode failed for task: ${taskName}`, error);
            vscode.window.showErrorMessage(`❌ Timeout mode failed for task: ${taskName}`);
            return false;
        }
    }
    async executeLogMonitoringMode(prompt, taskName) {
        try {
            this.logger.info(`📊 Starting log monitoring approach for task: ${taskName}`);
            // Get configuration
            const monitoringInterval = vscode.workspace.getConfiguration('sylangai').get('logMonitoringInterval', 5);
            const monitoringTimeout = vscode.workspace.getConfiguration('sylangai').get('logMonitoringTimeout', 120);
            // Create monitoring output channel
            const monitorChannel = vscode.window.createOutputChannel('Sylang AI Log Monitor');
            monitorChannel.show(true);
            monitorChannel.appendLine(`[${new Date().toISOString()}] 📊 Starting log monitoring for task: ${taskName}`);
            // Send prompt to Copilot chat window
            this.logger.info('📤 Sending prompt to chat window...');
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: '@copilot ' + prompt
            });
            monitorChannel.appendLine(`[${new Date().toISOString()}] 📤 Prompt sent to chat`);
            // Monitor for completion using log patterns
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `📊 Log Monitoring: ${taskName}`,
                cancellable: true
            }, async (progress, token) => {
                progress.report({ message: 'Monitoring Copilot logs for completion...' });
                const result = await this.monitorCopilotLogs(taskName, monitoringInterval, monitoringTimeout, progress, token, monitorChannel);
                if (result) {
                    monitorChannel.appendLine(`[${new Date().toISOString()}] ✅ Task completed via log monitoring: ${taskName}`);
                    vscode.window.showInformationMessage(`✅ Task "${taskName}" completed via log monitoring!`);
                }
                else {
                    monitorChannel.appendLine(`[${new Date().toISOString()}] ⏰ Log monitoring timed out: ${taskName}`);
                    vscode.window.showWarningMessage(`⏰ Task "${taskName}" log monitoring timed out.`);
                }
                return result;
            });
        }
        catch (error) {
            this.logger.info(`💥 Log monitoring approach failed for task: ${taskName}`, error);
            vscode.window.showErrorMessage(`❌ Log monitoring failed for task: ${taskName}`);
            return false;
        }
    }
    async monitorCopilotLogs(taskName, intervalSeconds, timeoutSeconds, progress, token, monitorChannel) {
        const startTime = Date.now();
        let checkCount = 0;
        let lastRequestId = '';
        this.logger.info(`📊 Starting Copilot log monitoring for ${timeoutSeconds}s...`);
        while (Date.now() - startTime < timeoutSeconds * 1000) {
            if (token.isCancellationRequested) {
                this.logger.info('🛑 Log monitoring cancelled by user');
                return false;
            }
            checkCount++;
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            progress.report({
                message: `Monitoring logs... (${elapsedSeconds}s / ${timeoutSeconds}s)`,
                increment: 1
            });
            monitorChannel.appendLine(`[${new Date().toISOString()}] 🔍 Check ${checkCount}: Scanning Copilot logs...`);
            try {
                // Check for completion patterns in logs
                // Note: This is a simplified approach - in practice, you'd need to hook into VSCode's logging system
                // For now, we'll simulate log checking and look for patterns like:
                // "message 0 returned. finish reason: [stop]"
                // "request done: requestId: [xyz]"
                // "ccreq:xyz | success | gpt-4.1 | Xms | [panel/editAgent]"
                const completionDetected = await this.checkForCopilotCompletion(monitorChannel, lastRequestId);
                if (completionDetected.found) {
                    this.logger.info(`✅ Copilot completion detected via logs! RequestID: ${completionDetected.requestId}`);
                    monitorChannel.appendLine(`[${new Date().toISOString()}] ✅ Completion detected: ${completionDetected.pattern}`);
                    return true;
                }
            }
            catch (error) {
                monitorChannel.appendLine(`[${new Date().toISOString()}] ⚠️ Error checking logs: ${error}`);
            }
            // Wait before next check
            await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
        }
        this.logger.info(`⏰ Log monitoring timed out after ${timeoutSeconds}s`);
        return false;
    }
    async checkForCopilotCompletion(monitorChannel, lastRequestId) {
        // Note: This is a placeholder implementation
        // In a real implementation, you would need to:
        // 1. Access VSCode's output channels programmatically
        // 2. Parse the GitHub Copilot logs
        // 3. Look for completion patterns
        // For now, we'll simulate this by checking if files were created
        // (which indicates the user completed the task in the chat)
        monitorChannel.appendLine(`[${new Date().toISOString()}] 🔍 Simulating log pattern check...`);
        // Check if expected output file exists as a proxy for completion
        if (this.currentSprintContext) {
            const currentTask = this.currentSprintContext.tasks.find((t) => t.issuestatus === 'inprogress');
            if (currentTask && currentTask.outputfile) {
                const outputExists = await this.statusUpdater.verifyOutputFileExists(currentTask);
                if (outputExists) {
                    return {
                        found: true,
                        requestId: 'simulated-' + Date.now(),
                        pattern: 'ccreq:simulated | success | gpt-4.1 | file-created | [panel/editAgent]'
                    };
                }
            }
        }
        return { found: false, requestId: '', pattern: '' };
    }
    async waitForChatCompletion(taskName, timeoutSeconds, progress, token, monitorChannel) {
        const startTime = Date.now();
        let checkCount = 0;
        while (Date.now() - startTime < timeoutSeconds * 1000) {
            if (token.isCancellationRequested) {
                this.logger.info('🛑 Chat monitoring cancelled by user');
                return false;
            }
            checkCount++;
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            progress.report({
                message: `Waiting for completion... (${elapsedSeconds}s / ${timeoutSeconds}s)`,
                increment: 1
            });
            monitorChannel.appendLine(`[${new Date().toISOString()}] 🔍 Check ${checkCount}: Waiting for task completion...`);
            // Check if the expected output file exists (simple completion detection)
            if (this.currentSprintContext) {
                const task = this.currentSprintContext.tasks.find((t) => t.name === taskName);
                if (task && task.outputfile) {
                    const outputExists = await this.statusUpdater.verifyOutputFileExists(task);
                    if (outputExists) {
                        this.logger.info(`✅ Output file detected: ${task.outputfile}`);
                        monitorChannel.appendLine(`[${new Date().toISOString()}] 📁 Output file detected: ${task.outputfile}`);
                        return true;
                    }
                }
            }
            // Wait 5 seconds before next check
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        this.logger.info(`⏰ Chat monitoring timed out after ${timeoutSeconds}s`);
        return false;
    }
    async fallbackChatApproach(prompt, taskName) {
        try {
            this.logger.info('🔄 Using fallback chat approach - opening chat with prompt');
            // Try to open chat directly with the prompt
            await vscode.commands.executeCommand('workbench.action.chat.open', prompt);
            // Show user message about manual completion
            vscode.window.showInformationMessage(`🤖 Task "${taskName}" sent to chat! Please review and run the AI response, then manually save to the expected output file.`);
            return true;
        }
        catch (error) {
            this.logger.info(`💥 Fallback chat approach failed for task: ${taskName}`, error);
            vscode.window.showErrorMessage(`❌ Failed to open chat for task: ${taskName}`);
            return false;
        }
    }
    updateStatusBar(text) {
        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = text;
        this.statusBarItem.command = 'sylang.ai.runAutoAgent';
    }
}
//# sourceMappingURL=extension.js.map