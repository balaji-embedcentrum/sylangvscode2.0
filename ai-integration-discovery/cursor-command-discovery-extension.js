"use strict";
/*
 * CURSOR COMMAND DISCOVERY - EXTENSION APPROACH
 *
 * Since VSCode APIs aren't available in Developer Console,
 * this creates a temporary extension command for discovery.
 *
 * Usage: Add this to your extension temporarily and run via Command Palette
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
exports.ClipboardTester = exports.ManualCursorTesting = exports.CursorCommandDiscovery = void 0;
const vscode = __importStar(require("vscode"));
class CursorCommandDiscovery {
    static register(context) {
        return vscode.commands.registerCommand('sylang.discoverCursorCommands', async () => {
            const discovery = new CursorCommandDiscovery();
            const results = await discovery.runDiscovery();
            await discovery.showResults(results);
        });
    }
    async runDiscovery() {
        console.log('🚀 Starting Cursor Command Discovery...');
        // Get all available commands
        const allCommands = await vscode.commands.getCommands();
        console.log(`📋 Found ${allCommands.length} total commands`);
        // Filter for cursor/AI related commands
        const cursorKeywords = [
            'cursor', 'chat', 'ai', 'anthropic', 'claude',
            'composer', 'tab', 'completion', 'agent', 'edit'
        ];
        const cursorCommands = allCommands.filter(cmd => {
            const lower = cmd.toLowerCase();
            return cursorKeywords.some(keyword => lower.includes(keyword));
        });
        // Filter for chat-specific commands
        const chatCommands = allCommands.filter(cmd => cmd.toLowerCase().includes('chat') ||
            cmd.toLowerCase().includes('composer'));
        // Filter for workbench commands
        const workbenchCommands = allCommands.filter(cmd => cmd.startsWith('workbench.') && (cmd.includes('panel') ||
            cmd.includes('view') ||
            cmd.includes('sidebar') ||
            cmd.includes('chat')));
        // Test key commands
        const testCommands = [
            'workbench.action.toggleSidebarVisibility',
            'workbench.action.togglePanel',
            'workbench.action.chat.open',
            'workbench.view.chat',
            'workbench.panel.chat.focus',
            'workbench.action.showCommands'
        ];
        const testResults = {};
        for (const cmd of testCommands) {
            testResults[cmd] = allCommands.includes(cmd);
        }
        // Analyze extensions
        const extensions = vscode.extensions.all
            .filter(ext => {
            const id = ext.id.toLowerCase();
            const name = (ext.packageJSON.displayName || '').toLowerCase();
            return id.includes('cursor') ||
                id.includes('ai') ||
                id.includes('chat') ||
                name.includes('cursor') ||
                name.includes('ai');
        })
            .map(ext => ({
            id: ext.id,
            active: ext.isActive,
            name: ext.packageJSON.displayName || ext.packageJSON.name,
            version: ext.packageJSON.version,
            commands: ext.packageJSON.contributes?.commands || []
        }));
        return {
            totalCommands: allCommands.length,
            cursorCommands,
            chatCommands,
            workbenchCommands,
            extensions,
            testResults
        };
    }
    async showResults(results) {
        // Create results document
        const resultText = this.formatResults(results);
        // Create temporary file with results
        const doc = await vscode.workspace.openTextDocument({
            content: resultText,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
        // Also show summary in notification
        vscode.window.showInformationMessage(`Discovery Complete: ${results.cursorCommands.length} Cursor commands, ${results.chatCommands.length} chat commands found`, 'View Results');
    }
    formatResults(results) {
        return `# Cursor Command Discovery Results

## Summary
- **Total Commands**: ${results.totalCommands}
- **Cursor Related**: ${results.cursorCommands.length}
- **Chat Commands**: ${results.chatCommands.length}
- **Workbench Commands**: ${results.workbenchCommands.length}
- **AI Extensions**: ${results.extensions.length}

## 🤖 Cursor AI Related Commands
${results.cursorCommands.map(cmd => `- \`${cmd}\``).join('\n')}

## 💬 Chat Commands
${results.chatCommands.map(cmd => `- \`${cmd}\``).join('\n')}

## 🖥️ Workbench Commands
${results.workbenchCommands.map(cmd => `- \`${cmd}\``).join('\n')}

## 🧪 Test Results
${Object.entries(results.testResults).map(([cmd, exists]) => `- \`${cmd}\`: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`).join('\n')}

## 📦 AI/Cursor Extensions
${results.extensions.map(ext => `
### ${ext.name} (${ext.id})
- **Active**: ${ext.active}
- **Version**: ${ext.version}
- **Commands**: ${ext.commands.length}
${ext.commands.length > 0 ? ext.commands.map((cmd) => `  - \`${cmd.command}\`: ${cmd.title}`).join('\n') : '  - No commands'}
`).join('\n')}

## 🎯 Recommended Integration Commands

Based on the discovery, here are the most promising commands for AI integration:

### Chat Triggers
${results.chatCommands.slice(0, 3).map(cmd => `- \`vscode.commands.executeCommand('${cmd}')\``).join('\n')}

### Panel Controls
${results.workbenchCommands.slice(0, 3).map(cmd => `- \`vscode.commands.executeCommand('${cmd}')\``).join('\n')}

### Next Steps
1. Test the above commands manually via Command Palette (\`Ctrl+Shift+P\`)
2. Implement basic trigger using working commands
3. Build clipboard + file context injection strategy
4. Create proof-of-concept with Scrum Master agent

Generated: ${new Date().toISOString()}
`;
    }
}
exports.CursorCommandDiscovery = CursorCommandDiscovery;
// Alternative: Manual testing approach
class ManualCursorTesting {
    static register(context) {
        return vscode.commands.registerCommand('sylang.testCursorCommands', async () => {
            const tester = new ManualCursorTesting();
            await tester.runTests();
        });
    }
    async runTests() {
        const testCommands = [
            { cmd: 'workbench.action.toggleSidebarVisibility', desc: 'Toggle Sidebar' },
            { cmd: 'workbench.action.togglePanel', desc: 'Toggle Panel' },
            { cmd: 'workbench.action.chat.open', desc: 'Open Chat' },
            { cmd: 'workbench.view.chat', desc: 'Focus Chat View' },
            { cmd: 'workbench.panel.chat.focus', desc: 'Focus Chat Panel' }
        ];
        const results = [];
        for (const test of testCommands) {
            try {
                await vscode.commands.executeCommand(test.cmd);
                results.push(`✅ ${test.cmd}: SUCCESS (${test.desc})`);
                console.log(`✅ Command worked: ${test.cmd}`);
                // Wait a bit before next test
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                results.push(`❌ ${test.cmd}: FAILED - ${error.message}`);
                console.log(`❌ Command failed: ${test.cmd} - ${error}`);
            }
        }
        // Show results
        const resultText = `# Cursor Command Test Results\n\n${results.join('\n')}`;
        const doc = await vscode.workspace.openTextDocument({
            content: resultText,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(`Command testing complete. Working commands found.`, 'View Results');
    }
}
exports.ManualCursorTesting = ManualCursorTesting;
// Quick clipboard test
class ClipboardTester {
    static register(context) {
        return vscode.commands.registerCommand('sylang.testClipboardIntegration', async () => {
            const tester = new ClipboardTester();
            await tester.testClipboardStrategy();
        });
    }
    async testClipboardStrategy() {
        // Sample AI instruction
        const sampleInstruction = {
            role: 'ScrumMaster',
            task: 'Refine the attached requirements into user stories',
            context: 'Sylang project with automotive focus',
            constraints: [
                'Use Sylang syntax for deliverables',
                'Include acceptance criteria',
                'Estimate in story points'
            ]
        };
        const prompt = `Please act as a Scrum Master and help me with the following task:

\`\`\`json
${JSON.stringify(sampleInstruction, null, 2)}
\`\`\`

Please analyze the context and deliver user stories with acceptance criteria using Sylang syntax.`;
        // Copy to clipboard
        await vscode.env.clipboard.writeText(prompt);
        // Try to open chat (attempt multiple commands)
        const chatCommands = [
            'workbench.action.chat.open',
            'workbench.view.chat',
            'workbench.action.toggleSidebarVisibility'
        ];
        let chatOpened = false;
        for (const cmd of chatCommands) {
            try {
                await vscode.commands.executeCommand(cmd);
                console.log(`✅ Chat opened with: ${cmd}`);
                chatOpened = true;
                break;
            }
            catch (error) {
                console.log(`❌ Chat command failed: ${cmd}`);
                continue;
            }
        }
        // Show result
        const message = chatOpened
            ? 'AI instruction copied to clipboard! Paste in Cursor chat.'
            : 'AI instruction copied to clipboard! Manually open Cursor chat and paste.';
        vscode.window.showInformationMessage(message, 'Done');
    }
}
exports.ClipboardTester = ClipboardTester;
//# sourceMappingURL=cursor-command-discovery-extension.js.map