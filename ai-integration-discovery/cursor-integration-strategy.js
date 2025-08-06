"use strict";
/*
 * CURSOR AI INTEGRATION - OPTIMIZED STRATEGY
 *
 * Based on discovery findings:
 * 1. Copy + Ctrl+L = Auto @ context injection
 * 2. Enter = Send (after instruction is added)
 * 3. workbench.action.toggleSecondarySidebar = Chat window
 */
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
exports.SylangAICommands = exports.AgentInstructionFactory = exports.CursorAIIntegrator = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class CursorAIIntegrator {
    /**
     * Main integration method - Copy + Auto-Context + Instruction
     */
    async executeAgentTask(instruction, sylangFiles) {
        try {
            // Step 1: Prepare complete prompt with context
            const fullPrompt = await this.prepareCompletePrompt(instruction, sylangFiles);
            // Step 2: Copy to clipboard (for auto-context injection)
            await vscode.env.clipboard.writeText(fullPrompt);
            // Step 3: Open Cursor chat (auto-injects @ context)
            await vscode.commands.executeCommand('workbench.action.toggleSecondarySidebar');
            // Step 4: Wait a moment for auto-context to load
            await this.delay(500);
            // Step 5: Show user notification with next steps
            const action = await vscode.window.showInformationMessage(`🤖 ${instruction.role} task ready! Context auto-loaded in chat. Press Enter to send.`, 'Open Files', 'Done');
            if (action === 'Open Files') {
                // Optionally open the context files for reference
                for (const file of sylangFiles.slice(0, 3)) { // Limit to 3 files
                    await vscode.window.showTextDocument(file, { preview: true });
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to prepare AI task: ${error}`);
        }
    }
    /**
     * Prepare complete prompt with agent instruction + file context
     */
    async prepareCompletePrompt(instruction, files) {
        // Format agent instruction
        const agentPrompt = this.formatAgentInstruction(instruction);
        // Prepare file context
        const fileContext = await this.prepareSylangContext(files);
        // Combine: Instruction first, then context
        return `${agentPrompt}\n\n${fileContext}`;
    }
    /**
     * Format agent instruction as structured prompt
     */
    formatAgentInstruction(instruction) {
        return `Please act as a ${instruction.role} and help me with the following task:

**Task**: ${instruction.task}

**Context**: ${instruction.context}

**Constraints**:
${instruction.constraints.map(c => `- ${c}`).join('\n')}

**Expected Deliverables**:
${instruction.deliverables.map(d => `- ${d}`).join('\n')}

Please analyze the attached Sylang files and provide the requested deliverables following the specified constraints.`;
    }
    /**
     * Prepare Sylang files context for auto-injection
     */
    async prepareSylangContext(files) {
        const contextParts = [];
        for (const file of files) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const textContent = Buffer.from(content).toString('utf8');
                const fileName = path.basename(file.fsPath);
                const fileType = path.extname(file.fsPath);
                // Format each file with clear headers
                contextParts.push(`// === ${fileName} (${fileType.toUpperCase()}) ===\n${textContent}`);
            }
            catch (error) {
                contextParts.push(`// === ${path.basename(file.fsPath)} ===\n// Error reading file: ${error}`);
            }
        }
        return contextParts.join('\n\n');
    }
    /**
     * Utility: Small delay for async operations
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.CursorAIIntegrator = CursorAIIntegrator;
/**
 * AGENT INSTRUCTION FACTORIES
 */
class AgentInstructionFactory {
    static createScrumMasterInstruction(requirements, projectContext) {
        return {
            role: 'ScrumMaster',
            task: 'Refine high-level requirements into detailed user stories with acceptance criteria',
            context: `Sylang systems engineering project: ${projectContext}`,
            constraints: [
                'Use Sylang syntax for all deliverables (.req files)',
                'Include clear acceptance criteria for each story',
                'Estimate stories in story points (1, 2, 3, 5, 8, 13)',
                'Maintain traceability to original requirements',
                'Follow agile best practices and INVEST criteria'
            ],
            deliverables: [
                'User stories in .req format',
                'Acceptance criteria for each story',
                'Story point estimates',
                'Dependencies between stories',
                'Priority recommendations'
            ]
        };
    }
    static createSMEDevelopmentInstruction(userStory, domain) {
        return {
            role: 'SMEAgent',
            task: `Implement technical solution for user story: "${userStory}"`,
            context: `${domain} domain expertise required for Sylang systems engineering`,
            constraints: [
                'Follow Sylang coding standards and patterns',
                'Implement comprehensive error handling',
                'Include unit tests for all functions',
                'Document all public interfaces',
                'Ensure thread safety where applicable',
                'Follow SOLID principles'
            ],
            deliverables: [
                'Implementation code (.ts, .fun files)',
                'Unit tests (.tst files)',
                'Integration tests where needed',
                'Technical documentation',
                'API documentation if applicable'
            ]
        };
    }
    static createArchitectInstruction(systemRequirements, scope) {
        return {
            role: 'ArchitectAgent',
            task: 'Design system architecture and component interactions',
            context: `System architecture design for ${scope} using Sylang systems engineering`,
            constraints: [
                'Follow Sylang architecture patterns (.blk files)',
                'Design for scalability and maintainability',
                'Consider safety-critical requirements',
                'Include component interaction diagrams',
                'Define clear interfaces between components',
                'Consider deployment and operational requirements'
            ],
            deliverables: [
                'System architecture (.blk files)',
                'Component definitions (.fun files)',
                'Interface specifications',
                'Architecture decision records',
                'Deployment diagrams',
                'Integration guidelines'
            ]
        };
    }
}
exports.AgentInstructionFactory = AgentInstructionFactory;
/**
 * CONTEXT MENU INTEGRATION
 */
class SylangAICommands {
    constructor(integrator) {
        this.integrator = integrator;
    }
    /**
     * Right-click command: Refine with Scrum Master
     */
    async refineWithScrumMaster(fileUri) {
        const projectName = this.getProjectName();
        const instruction = AgentInstructionFactory.createScrumMasterInstruction(['Requirements from selected file'], projectName);
        await this.integrator.executeAgentTask(instruction, [fileUri]);
    }
    /**
     * Right-click command: Start Sprint with Multiple Agents
     */
    async startSprintWithAgents(folderUri) {
        // Find all Sylang files in folder
        const sylangFiles = await this.findSylangFiles(folderUri);
        if (sylangFiles.length === 0) {
            vscode.window.showWarningMessage('No Sylang files found in selected folder');
            return;
        }
        // Create comprehensive instruction for sprint
        const instruction = {
            role: 'ScrumMaster',
            task: 'Analyze project files and create comprehensive sprint plan',
            context: `Complete Sylang project analysis for sprint planning`,
            constraints: [
                'Analyze all file types (.ple, .fml, .req, .fun, .blk)',
                'Create prioritized backlog',
                'Identify dependencies and risks',
                'Estimate effort for each component',
                'Create sprint goals and milestones'
            ],
            deliverables: [
                'Sprint backlog with prioritized items',
                'Sprint goals and success criteria',
                'Risk assessment and mitigation',
                'Effort estimates and timeline',
                'Team assignments and responsibilities'
            ]
        };
        await this.integrator.executeAgentTask(instruction, sylangFiles);
    }
    /**
     * Find all Sylang files in directory
     */
    async findSylangFiles(folderUri) {
        const sylangExtensions = ['.ple', '.fml', '.vml', '.vcf', '.fun', '.req', '.tst', '.blk'];
        const files = [];
        try {
            const entries = await vscode.workspace.fs.readDirectory(folderUri);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.File) {
                    const ext = path.extname(name);
                    if (sylangExtensions.includes(ext)) {
                        files.push(vscode.Uri.joinPath(folderUri, name));
                    }
                }
            }
        }
        catch (error) {
            console.error('Error reading directory:', error);
        }
        return files;
    }
    /**
     * Get project name from workspace
     */
    getProjectName() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        return workspaceFolder ? path.basename(workspaceFolder.uri.fsPath) : 'Sylang Project';
    }
    /**
     * Register all commands
     */
    static register(context) {
        const integrator = new CursorAIIntegrator();
        const commands = new SylangAICommands(integrator);
        return [
            vscode.commands.registerCommand('sylang.ai.refineWithScrumMaster', (uri) => commands.refineWithScrumMaster(uri)),
            vscode.commands.registerCommand('sylang.ai.startSprintWithAgents', (uri) => commands.startSprintWithAgents(uri)),
            vscode.commands.registerCommand('sylang.ai.testClipboardIntegration', () => integrator.testBasicIntegration())
        ];
    }
}
exports.SylangAICommands = SylangAICommands;
// Add to CursorAIIntegrator class
class CursorAIIntegrator {
    // ... existing methods ...
    /**
     * Test basic integration workflow
     */
    async testBasicIntegration() {
        const testInstruction = {
            role: 'ScrumMaster',
            task: 'Test the AI integration workflow',
            context: 'This is a test of the Cursor AI integration system',
            constraints: [
                'Respond with a simple acknowledgment',
                'Confirm you can see the context',
                'List any Sylang files provided'
            ],
            deliverables: [
                'Acknowledgment message',
                'Context confirmation',
                'File list (if any)'
            ]
        };
        // Get current active file for testing
        const activeEditor = vscode.window.activeTextEditor;
        const testFiles = activeEditor ? [activeEditor.document.uri] : [];
        await this.executeAgentTask(testInstruction, testFiles);
    }
}
exports.CursorAIIntegrator = CursorAIIntegrator;
//# sourceMappingURL=cursor-integration-strategy.js.map