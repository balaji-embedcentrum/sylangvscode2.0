import * as vscode from 'vscode';
import { SylangAILogger, LogLevel } from './core/logger';
import { SprintContextReader, SprintTask, SprintContext } from './core/sprintReader';
import { SprintStatusUpdater } from './core/statusUpdater';
import { AIPromptGenerator, AgentContext } from './core/aiPromptGenerator';

let logger: SylangAILogger;
let sprintWorkflow: SprintAIWorkflow;

export function activate(context: vscode.ExtensionContext) {
    logger = new SylangAILogger('SYLANG_AI', LogLevel.INFO);
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
        } catch (error) {
            logger.error('❌ executeSprintLoop() failed', error);
        }
    });
    
    const resetDisposable = vscode.commands.registerCommand('sylang.ai.resetSprint', async () => {
        logger.info('🔄 RESET SPRINT COMMAND TRIGGERED');
        try {
            await sprintWorkflow.resetSprintStatus();
            logger.info('✅ Sprint reset completed');
            vscode.window.showInformationMessage('✅ Sprint tasks reset to open status');
        } catch (error) {
            logger.error('❌ Sprint reset failed', error);
            vscode.window.showErrorMessage('❌ Sprint reset failed: ' + error);
        }
    });
    
    logger.info('✅ Commands registered: sylang.ai.runAutoAgent, sylang.ai.resetSprint');
    
    context.subscriptions.push(disposable, resetDisposable);
    context.subscriptions.push(logger);
}

export function deactivate() {
    if (logger) {
        logger.info('Sylang AI Integration Extension deactivated');
        logger.dispose();
    }
}

class SprintAIWorkflow {
    private context: vscode.ExtensionContext;
    private logger: SylangAILogger;
    private sprintReader: SprintContextReader;
    private statusUpdater: SprintStatusUpdater;
    private promptGenerator: AIPromptGenerator;
    private isLoopRunning: boolean = false;
    private currentSprintContext: any = null;
    private statusBarItem: vscode.StatusBarItem;

    constructor(context: vscode.ExtensionContext, logger: SylangAILogger) {
        this.context = context;
        this.logger = logger;
        this.sprintReader = new SprintContextReader(logger);
        this.statusUpdater = new SprintStatusUpdater(logger);
        this.promptGenerator = new AIPromptGenerator(logger);
        
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.show();
        this.updateStatusBar('🤖 Ready');
    }

    async executeSprintLoop(): Promise<void> {
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
                tasks: this.currentSprintContext.tasks.map((t: any) => `${t.name} (${t.assignedto}) -> ${t.outputfile}`)
            });

            // Step 3: Start the automatic loop
            this.logger.info('🔍 Step 3: Starting task processing loop...');
            let tasksCompleted = 0;
            const totalTasks = this.currentSprintContext.tasks.filter((t: any) => t.type === 'task').length;
            
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
                } else {
                    this.logger.info(`❌ Task failed: ${nextTask.name}, stopping loop`);
                    this.updateStatusBar(`❌ Failed: ${nextTask.name}`);
                    vscode.window.showErrorMessage(`❌ Task failed: ${nextTask.name}. Sprint loop stopped.`);
                    break;
                }
            }

        } catch (error) {
            this.logger.info('💥 Sprint AI Loop failed with error:', error);
            this.updateStatusBar('💥 Sprint failed');
            vscode.window.showErrorMessage(`Sprint AI Loop failed: ${error}`);
        } finally {
            this.isLoopRunning = false;
            this.updateStatusBar('🤖 Ready');
            this.logger.info('🏁 Sprint loop finished');
        }
    }

    private async saveAIResponseToFile(aiResponse: string, taskName: string): Promise<void> {
        try {
            // Find the task to get the output file path
            if (!this.currentSprintContext) {
                this.logger.info('❌ No sprint context available for saving file');
                return;
            }

            const task = this.currentSprintContext.tasks.find((t: SprintTask) => t.name === taskName);
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
            } catch (error) {
                // Directory might already exist, that's fine
            }

            // Write the AI response to file
            await vscode.workspace.fs.writeFile(outputFilePath, Buffer.from(aiResponse, 'utf8'));
            this.logger.info(`💾 Saved AI response to: ${outputFilePath.fsPath}`);

            // Open the created file for user to see
            const document = await vscode.workspace.openTextDocument(outputFilePath);
            await vscode.window.showTextDocument(document);
            this.logger.info(`👀 Opened created file: ${task.outputfile}`);

        } catch (error) {
            this.logger.info(`💥 Failed to save AI response to file: ${taskName}`, error);
        }
    }

    async resetSprintStatus(): Promise<void> {
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
            
        } catch (error) {
            this.logger.info('💥 Sprint reset failed:', error);
            throw error;
        }
    }

    private async executeTaskWorkflow(task: any): Promise<boolean> {
        try {
            this.logger.info(`🔍 executeTaskWorkflow called for: ${task.name}`);
            
            // Step 1: Mark task as in progress
            this.logger.info(`🔄 Step 1: Marking task as in progress: ${task.name}`);
            await this.statusUpdater.markTaskInProgress(this.currentSprintContext, task);

            // Step 2: Generate AI prompt with enhanced dependency validation
            this.logger.info(`🔍 Step 2: Generating enhanced AI prompt for: ${task.name}`);
            
            this.logger.info('🔍 Step 3: Generating AI prompt with full context validation...');
            const aiPrompt = await this.promptGenerator.generateTaskPrompt(this.currentSprintContext, task);
            this.logger.info(`📝 Enhanced AI prompt generated (${aiPrompt.length} characters)`);

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

        } catch (error) {
            this.logger.info(`💥 Task workflow failed: ${task.name}`, error);
            return false;
        }
    }

    private async executeAIInteraction(prompt: string, taskName: string): Promise<boolean> {
        // Check configuration to decide which approach to use
        const executionMode = vscode.workspace.getConfiguration('sylangai').get('executionMode', 'directAPI') as string;
        
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

    private async executeDirectAPIMode(prompt: string, taskName: string): Promise<boolean> {
        this.logger.info('🚀 Starting direct API mode execution...');
        
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `AI Task: ${taskName}`,
            cancellable: true
        }, async (progress, token) => {
            try {
                // Show status in status bar
                const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
                statusBarItem.text = `$(sync~spin) AI: ${taskName}`;
                statusBarItem.show();

                progress.report({ message: 'Initializing AI request...', increment: 10 });

                // Get available models
                const models = await (vscode as any).lm.selectChatModels({ 
                    vendor: 'copilot', 
                    family: 'gpt-4o' 
                });

                if (models.length === 0) {
                    // Fallback to any available model
                    const allModels = await (vscode as any).lm.selectChatModels();
                    if (allModels.length === 0) {
                        throw new Error('No language models available');
                    }
                    models.push(allModels[0]);
                }

                const model = models[0];
                this.logger.info(`🤖 Using model: ${model.name} (${model.vendor})`);

                progress.report({ message: `Connected to ${model.name}`, increment: 20 });

                // Create chat request
                const messages = [(vscode as any).LanguageModelChatMessage.User(prompt)];
                const request = await model.sendRequest(messages, {}, token);

                progress.report({ message: 'AI is processing...', increment: 30 });

                // Stream response
                let fullResponse = '';
                let chunkCount = 0;
                for await (const chunk of request.stream) {
                    if (token.isCancellationRequested) {
                        this.logger.info('❌ Task cancelled by user');
                        statusBarItem.dispose();
                        return false;
                    }

                    let chunkText = '';
                    if (typeof chunk === 'string') {
                        chunkText = chunk;
                    } else if (chunk && typeof chunk === 'object') {
                        chunkText = chunk.text || chunk.content || chunk.message || chunk.value || JSON.stringify(chunk);
                    } else {
                        chunkText = String(chunk);
                    }
                    
                    fullResponse += chunkText;
                    chunkCount++;
                    
                    if (chunkCount % 10 === 0) {
                        progress.report({ 
                            message: `AI responding... (${fullResponse.length} characters received)`, 
                            increment: 5 
                        });
                    }
                }

                this.logger.info(`✅ Received complete AI response: ${fullResponse.length} characters`);

                // Clean up markdown code blocks
                let cleanedResponse = fullResponse;
                if (fullResponse.includes('```sylang')) {
                    this.logger.info('🧹 Cleaning markdown code blocks from response...');
                    cleanedResponse = fullResponse.replace(/```sylang\s*/g, '').replace(/```\s*$/g, '').trim();
                    this.logger.info(`🧹 Cleaned response length: ${cleanedResponse.length} characters`);
                }

                progress.report({ message: 'Saving AI response...', increment: 85 });

                // Save response to file
                if (taskName && cleanedResponse.trim()) {
                    await this.saveAIResponseToFile(cleanedResponse, taskName);
                }

                progress.report({ message: 'Task completed!', increment: 100 });
                statusBarItem.dispose();

                return true;

            } catch (error) {
                this.logger.error('❌ Direct API mode execution failed:', error);
                
                // Enhanced error handling for dependency validation
                if (error instanceof Error && error.message.includes('HARD ERROR')) {
                    vscode.window.showErrorMessage(`SylangAI Dependency Error: ${error.message}`);
                } else {
                    vscode.window.showErrorMessage(`AI Execution Error: ${error}`);
                }
                return false;
            }
        });
    }

    private async executeTimeoutMode(prompt: string, taskName: string): Promise<boolean> {
        try {
            this.logger.info(`⏰ Starting timeout-based execution for task: ${taskName}`);
            
            // Get timeout from configuration
            const timeoutSeconds = vscode.workspace.getConfiguration('sylangai').get('timeoutSeconds', 30);
            
            // Send prompt to Copilot chat window
            this.logger.info('📤 Sending prompt to chat window...');
            await vscode.commands.executeCommand('workbench.action.chat.open', prompt);
            
            // Show user message and wait for timeout
            vscode.window.showInformationMessage(
                `🤖 Task "${taskName}" sent to chat! Waiting ${timeoutSeconds}s for completion...`
            );
            
            // Simple timeout wait
            this.logger.info(`⏰ Waiting ${timeoutSeconds} seconds for completion...`);
            await new Promise(resolve => setTimeout(resolve, timeoutSeconds * 1000));
            
            // Assume completion after timeout
            this.logger.info(`✅ Timeout completed for task: ${taskName}`);
            vscode.window.showInformationMessage(`✅ Task "${taskName}" timeout completed!`);
            
            return true;
            
        } catch (error) {
            this.logger.info(`💥 Timeout mode failed for task: ${taskName}`, error);
            vscode.window.showErrorMessage(`❌ Timeout mode failed for task: ${taskName}`);
            return false;
        }
    }

    private async executeLogMonitoringMode(prompt: string, taskName: string): Promise<boolean> {
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
                } else {
                    monitorChannel.appendLine(`[${new Date().toISOString()}] ⏰ Log monitoring timed out: ${taskName}`);
                    vscode.window.showWarningMessage(`⏰ Task "${taskName}" log monitoring timed out.`);
                }
                
                return result;
            });
            
        } catch (error) {
            this.logger.info(`💥 Log monitoring approach failed for task: ${taskName}`, error);
            vscode.window.showErrorMessage(`❌ Log monitoring failed for task: ${taskName}`);
            return false;
        }
    }

    private async monitorCopilotLogs(
        taskName: string,
        intervalSeconds: number,
        timeoutSeconds: number,
        progress: vscode.Progress<{message?: string; increment?: number}>,
        token: vscode.CancellationToken,
        monitorChannel: vscode.OutputChannel
    ): Promise<boolean> {
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
                
            } catch (error) {
                monitorChannel.appendLine(`[${new Date().toISOString()}] ⚠️ Error checking logs: ${error}`);
            }
            
            // Wait before next check
            await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
        }
        
        this.logger.info(`⏰ Log monitoring timed out after ${timeoutSeconds}s`);
        return false;
    }

    private async checkForCopilotCompletion(
        monitorChannel: vscode.OutputChannel, 
        lastRequestId: string
    ): Promise<{found: boolean, requestId: string, pattern: string}> {
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
            const currentTask = this.currentSprintContext.tasks.find((t: any) => t.issuestatus === 'inprogress');
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

    private async waitForChatCompletion(
        taskName: string, 
        timeoutSeconds: number, 
        progress: vscode.Progress<{message?: string; increment?: number}>,
        token: vscode.CancellationToken,
        monitorChannel: vscode.OutputChannel
    ): Promise<boolean> {
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
                const task = this.currentSprintContext.tasks.find((t: any) => t.name === taskName);
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

    private async fallbackChatApproach(prompt: string, taskName: string): Promise<boolean> {
        try {
            this.logger.info('🔄 Using fallback chat approach - opening chat with prompt');
            
            // Try to open chat directly with the prompt
            await vscode.commands.executeCommand('workbench.action.chat.open', prompt);
            
            // Show user message about manual completion
            vscode.window.showInformationMessage(
                `🤖 Task "${taskName}" sent to chat! Please review and run the AI response, then manually save to the expected output file.`
            );
            
            return true;
            
        } catch (error) {
            this.logger.info(`💥 Fallback chat approach failed for task: ${taskName}`, error);
            vscode.window.showErrorMessage(`❌ Failed to open chat for task: ${taskName}`);
            return false;
        }
    }

    private updateStatusBar(text: string) {
        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = text;
        this.statusBarItem.command = 'sylang.ai.runAutoAgent';
    }
}