# 🚀 CURSOR AI INTEGRATION ARCHITECTURE

## Overview

This document outlines the complete architecture for integrating Cursor AI capabilities with the Sylang VSCode extension, enabling automated AI-driven development workflows.

## 🔍 Discovery Findings

### Cursor AI Structure
- **Cursor IDE**: VSCode fork with native AI integration (not an extension)
- **Built-in AI**: Native chat, composer, and tab completion
- **Command-based API**: Standard VSCode `executeCommand` interface
- **Keyboard Shortcuts**: `Ctrl+L` (chat), `Ctrl+K` (edit), `Ctrl+I` (composer)

### Key Integration Points
1. **VSCode Commands API**: `vscode.commands.executeCommand()`
2. **Chat Panel Control**: Standard workbench panel management
3. **Text/Context Injection**: Clipboard, file system, editor APIs
4. **File Context Sharing**: VSCode workspace and editor APIs

## 🏗️ Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 SYLANG AI ORCHESTRATION PLATFORM               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Human Interface │  │ JSON Generator  │  │ AI Trigger      │ │
│  │ (VSCode Cmds)   │  │ (Agent Schemas) │  │ (Cursor API)    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Task Manager    │  │ Workflow Engine │  │ Context Manager │ │
│  │ (State/Queue)   │  │ (Orchestration) │  │ (Sylang Files)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 Component Specifications

### 1. Human System Integrator Interface

**Purpose**: Right-click commands for triggering AI workflows

```typescript
interface HumanInterfaceCommands {
  // Right-click menu commands
  'sylang.ai.refineWithScrumMaster': (fileUri: vscode.Uri) => Promise<void>;
  'sylang.ai.startSprintWithAgents': (projectUri: vscode.Uri) => Promise<void>;
  'sylang.ai.executeTaskWithSME': (taskDef: TaskDefinition) => Promise<void>;
  'sylang.ai.reviewAndApprove': (content: GeneratedContent) => Promise<void>;
}

// Context menu configuration
const contextMenus = {
  "explorer/context": [
    {
      "command": "sylang.ai.refineWithScrumMaster",
      "when": "resourceExtname == .ple || resourceExtname == .req",
      "group": "ai@1"
    }
  ]
};
```

### 2. JSON Orchestration Engine

**Purpose**: Generate structured instructions for AI agents

```typescript
interface AgentInstruction {
  role: 'ScrumMaster' | 'SMEAgent' | 'ArchitectAgent';
  context: SylangContext;
  task: TaskDefinition;
  constraints: string[];
  expectedOutput: OutputSpecification;
  followUpActions: string[];
}

interface ScrumMasterInstruction extends AgentInstruction {
  role: 'ScrumMaster';
  task: {
    type: 'requirement-refinement' | 'sprint-planning' | 'backlog-management';
    input: string | SylangFile[];
    deliverables: ('epics' | 'user-stories' | 'tasks' | 'acceptance-criteria')[];
  };
}

class JSONOrchestrationEngine {
  generateScrumMasterInstruction(requirements: string[]): ScrumMasterInstruction {
    return {
      role: 'ScrumMaster',
      context: this.buildSylangContext(),
      task: {
        type: 'requirement-refinement',
        input: requirements,
        deliverables: ['user-stories', 'acceptance-criteria']
      },
      constraints: [
        'Use Sylang syntax for all deliverables',
        'Maintain traceability between requirements and stories',
        'Follow agile best practices',
        'Include estimation in story points'
      ],
      expectedOutput: {
        format: 'sylang-files',
        fileTypes: ['.req', '.ple'],
        structure: 'hierarchical'
      },
      followUpActions: [
        'Create technical tasks with SME agents',
        'Generate test scenarios',
        'Update project documentation'
      ]
    };
  }
}
```

### 3. Cursor AI Trigger System

**Purpose**: Programmatically control Cursor AI chat/composer

```typescript
class CursorAIIntegrator {
  private discoveredCommands: string[] = [];
  
  async initialize(): Promise<void> {
    // Discover available commands
    this.discoveredCommands = await vscode.commands.getCommands();
    
    // Find Cursor-specific commands
    const cursorCommands = this.discoveredCommands.filter(cmd => 
      cmd.includes('chat') || 
      cmd.includes('composer') || 
      cmd.includes('workbench.action')
    );
    
    this.logger.info(`Found ${cursorCommands.length} potential Cursor commands`);
  }
  
  async triggerCursorChat(): Promise<boolean> {
    // Priority order of commands to try
    const chatTriggers = [
      'workbench.action.chat.open',
      'workbench.view.chat',
      'workbench.panel.chat.focus',
      'workbench.action.toggleSidebarVisibility' // Fallback
    ];
    
    for (const command of chatTriggers) {
      try {
        await vscode.commands.executeCommand(command);
        this.logger.info(`✅ Successfully triggered chat with: ${command}`);
        return true;
      } catch (error) {
        this.logger.debug(`❌ Command failed: ${command} - ${error.message}`);
        continue;
      }
    }
    
    return false;
  }
  
  async injectAgentInstruction(instruction: AgentInstruction): Promise<void> {
    // Strategy 1: Clipboard injection
    const jsonInstruction = JSON.stringify(instruction, null, 2);
    const prompt = `Please act as a ${instruction.role} and help me with the following task:\n\n\`\`\`json\n${jsonInstruction}\n\`\`\`\n\nPlease analyze the context and deliver the requested output following the specified constraints.`;
    
    await vscode.env.clipboard.writeText(prompt);
    
    // Strategy 2: Create temporary instruction file
    const tempFile = await this.createTempInstructionFile(instruction);
    await vscode.window.showTextDocument(tempFile);
    
    // Strategy 3: Show information message with instruction
    const action = await vscode.window.showInformationMessage(
      `AI Instruction ready for ${instruction.role}. Paste in chat and add context files.`,
      'Open Chat', 'Copy Instruction'
    );
    
    if (action === 'Open Chat') {
      await this.triggerCursorChat();
    } else if (action === 'Copy Instruction') {
      await vscode.env.clipboard.writeText(prompt);
    }
  }
  
  async attachSylangContext(files: vscode.Uri[]): Promise<void> {
    // Create context summary for AI
    const contextText = await Promise.all(
      files.map(async (uri) => {
        const content = await vscode.workspace.fs.readFile(uri);
        const textContent = Buffer.from(content).toString('utf8');
        return `// File: ${uri.fsPath}\n${textContent}`;
      })
    );
    
    const fullContext = `Please use the following Sylang files as context:\n\n${contextText.join('\n\n')}`;
    
    // Copy to clipboard for easy pasting
    await vscode.env.clipboard.writeText(fullContext);
    
    // Optional: Create workspace file with context
    const contextUri = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders![0].uri, 
      '.ai-context',
      `context-${Date.now()}.md`
    );
    
    await vscode.workspace.fs.writeFile(
      contextUri, 
      Buffer.from(fullContext, 'utf8')
    );
    
    await vscode.window.showTextDocument(contextUri);
  }
}
```

### 4. Task State Manager

**Purpose**: Track AI workflow progress and orchestrate multi-step tasks

```typescript
interface TaskDefinition {
  id: string;
  type: 'scrum-master' | 'sme-development' | 'testing' | 'review';
  status: 'pending' | 'in-progress' | 'waiting-human' | 'completed' | 'failed';
  priority: number;
  dependencies: string[];
  assignedAgent: AgentRole;
  context: SylangContext;
  instruction: AgentInstruction;
  expectedOutputs: string[];
  createdAt: Date;
  updatedAt: Date;
}

class TaskStateManager {
  private tasks: Map<string, TaskDefinition> = new Map();
  private taskQueue: string[] = [];
  
  async createTask(instruction: AgentInstruction): Promise<string> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const task: TaskDefinition = {
      id: taskId,
      type: this.mapRoleToTaskType(instruction.role),
      status: 'pending',
      priority: 1,
      dependencies: [],
      assignedAgent: instruction.role,
      context: instruction.context,
      instruction,
      expectedOutputs: this.extractExpectedOutputs(instruction),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.tasks.set(taskId, task);
    this.taskQueue.push(taskId);
    
    await this.persistTaskState();
    return taskId;
  }
  
  async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    // Update status
    task.status = 'in-progress';
    task.updatedAt = new Date();
    
    // Trigger AI
    await this.aiIntegrator.triggerCursorChat();
    await this.aiIntegrator.injectAgentInstruction(task.instruction);
    await this.aiIntegrator.attachSylangContext(task.context.files);
    
    // Set up file watchers for completion detection
    await this.setupCompletionWatchers(task);
    
    // Show progress notification
    vscode.window.showInformationMessage(
      `🤖 AI Agent (${task.assignedAgent}) is working on: ${task.type}`,
      'View Progress', 'Cancel Task'
    );
  }
  
  async markTaskCompleted(taskId: string, outputs: vscode.Uri[]): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    task.status = 'completed';
    task.updatedAt = new Date();
    
    // Process outputs and trigger next tasks
    await this.processTaskOutputs(task, outputs);
    await this.triggerDependentTasks(taskId);
    
    // Notify user
    vscode.window.showInformationMessage(
      `✅ Task completed: ${task.type}`,
      'View Results', 'Start Next Task'
    );
  }
}
```

### 5. Workflow Orchestration Engine

**Purpose**: Coordinate multi-agent workflows

```typescript
class WorkflowOrchestrator {
  async startSprintWorkflow(requirements: string[]): Promise<void> {
    // Step 1: Create Scrum Master task
    const scrumMasterInstruction = this.jsonEngine.generateScrumMasterInstruction(requirements);
    const scrumTaskId = await this.taskManager.createTask(scrumMasterInstruction);
    
    // Step 2: Execute Scrum Master task
    await this.taskManager.executeTask(scrumTaskId);
    
    // Step 3: Wait for completion (human approval)
    await this.waitForTaskCompletion(scrumTaskId);
    
    // Step 4: Generate SME tasks based on stories
    const stories = await this.extractUserStories(scrumTaskId);
    const smeTasks = await this.generateSMETasks(stories);
    
    // Step 5: Execute SME tasks in parallel or sequence
    for (const smeTask of smeTasks) {
      const taskId = await this.taskManager.createTask(smeTask);
      await this.taskManager.executeTask(taskId);
    }
    
    // Step 6: Monitor progress and handle dependencies
    await this.monitorWorkflowProgress(smeTasks.map(t => t.id));
  }
  
  async generateSMETasks(stories: UserStory[]): Promise<AgentInstruction[]> {
    return stories.map(story => ({
      role: 'SMEAgent',
      context: this.buildContextForStory(story),
      task: {
        type: 'technical-implementation',
        input: story,
        deliverables: ['code', 'tests', 'documentation']
      },
      constraints: [
        'Follow Sylang coding standards',
        'Include comprehensive tests',
        'Update relevant documentation',
        'Ensure backward compatibility'
      ],
      expectedOutput: {
        format: 'code-files',
        fileTypes: ['.ts', '.test.ts', '.md'],
        structure: 'modular'
      },
      followUpActions: [
        'Code review',
        'Integration testing',
        'Documentation update'
      ]
    }));
  }
}
```

## 🚀 Implementation Plan

### Phase 1: Discovery & Basic Integration (Week 1-2)
1. **Run Discovery Script** - Execute `cursor-command-discovery.js` in Cursor
2. **Identify Working Commands** - Find exact command IDs for chat/composer
3. **Build Basic Trigger** - Create simple command to open chat + inject text
4. **Test File Context** - Verify file attachment capabilities

### Phase 2: JSON Agent System (Week 3-4)
1. **Agent Schema Design** - Implement JSON schemas for each agent role
2. **Instruction Generator** - Build system to create agent instructions
3. **Context Manager** - Develop Sylang file context extraction
4. **Basic Workflow** - Single agent (Scrum Master) proof of concept

### Phase 3: Multi-Agent Orchestration (Week 5-6)
1. **Task State Management** - Implement task queue and state tracking
2. **Workflow Engine** - Build multi-step task orchestration
3. **Progress Monitoring** - Add completion detection and notifications
4. **Error Handling** - Implement robust error recovery

### Phase 4: Production Features (Week 7-8)
1. **Human Approval Gates** - Add review and approval workflows
2. **Advanced Context** - Implement smart context selection
3. **Performance Optimization** - Add caching and efficiency improvements
4. **Documentation** - Complete user guides and API docs

## 🔧 Integration Strategies

### Strategy 1: Clipboard + Manual Paste
```typescript
async injectInstruction(instruction: AgentInstruction): Promise<void> {
  const prompt = this.formatInstructionAsPrompt(instruction);
  await vscode.env.clipboard.writeText(prompt);
  await this.triggerCursorChat();
  
  vscode.window.showInformationMessage(
    'AI instruction copied to clipboard. Paste in Cursor chat and add @files for context.',
    'Done'
  );
}
```

### Strategy 2: Temporary File + Auto-Open
```typescript
async injectViaFile(instruction: AgentInstruction): Promise<void> {
  const tempUri = await this.createTempInstructionFile(instruction);
  await vscode.window.showTextDocument(tempUri);
  await this.triggerCursorChat();
  
  // Optional: Auto-delete after use
  setTimeout(() => vscode.workspace.fs.delete(tempUri), 60000);
}
```

### Strategy 3: Context Window + File Refs
```typescript
async attachContext(files: vscode.Uri[]): Promise<void> {
  // Create context file with file references
  const contextContent = files.map(uri => `@${uri.fsPath}`).join('\n');
  const contextUri = await this.createContextFile(contextContent);
  
  await vscode.window.showTextDocument(contextUri);
  await this.triggerCursorChat();
}
```

## 📊 Expected Outcomes

### Immediate Benefits
- **Right-click AI Workflows** - Instant access to AI agents from file explorer
- **Structured AI Instructions** - Consistent, high-quality AI prompts
- **Context-Aware AI** - AI agents understand Sylang project structure
- **Progress Tracking** - Visual feedback on multi-step AI workflows

### Long-term Value
- **Automated Development** - AI-driven sprint execution
- **Quality Assurance** - Consistent deliverable formats
- **Knowledge Capture** - Reusable agent templates and workflows
- **Team Scaling** - Standardized AI-assisted development processes

## 🧪 Next Steps

1. **Execute Discovery Script**: Run `ai-integration-discovery/cursor-command-discovery.js` in Cursor Developer Console
2. **Analyze Results**: Review discovered commands and plan integration approach
3. **Build Proof of Concept**: Implement basic Scrum Master agent trigger
4. **Validate Approach**: Test with real Sylang files and gather feedback
5. **Iterate and Expand**: Add more agents and workflow complexity

This architecture provides a solid foundation for command-based AI integration while remaining completely separate from existing Sylang extension functionality. 