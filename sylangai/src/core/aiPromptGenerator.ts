import * as vscode from 'vscode';
import * as path from 'path';
import { SprintTask, SprintContext } from './sprintReader';
import { SylangAILogger } from './logger';

export interface AgentContext {
    name: string;
    description: string;
    role: string;
    specialization: string;
    expertise: string[];
    context: string[];
}

export interface AgentDefinition {
    name: string;
    description: string;
    role: string;
    specialization: string;
    expertise: string[];
    context: string[];
}

export class AIPromptGenerator {
    private logger: SylangAILogger;

    constructor(logger: SylangAILogger) {
        this.logger = logger;
    }

    async generateTaskPrompt(
        sprintContext: SprintContext,
        task: SprintTask,
        agentContext?: AgentContext
    ): Promise<string> {
        this.logger.info(`🎯 Generating AI prompt for task: ${task.name}`);

        // 1. DEPENDENCY VALIDATION (HARD REQUIREMENT)
        await this.validateRequiredFiles();

        // 2. AGENT CONTEXT EXTRACTION (HARD REQUIREMENT)
        const resolvedAgentContext = await this.extractAgentContext(task.assignedto);

        // 3. SYLANG RULES INJECTION (COMPLETE FILE)
        const sylangRules = await this.readSylangRules();

        // 4. LANGUAGE DETECTION
        const outputLanguage = this.detectOutputLanguage(task.outputfile);

        // 5. STRUCTURED PROMPT GENERATION
        const prompt = this.buildStructuredPrompt(
            resolvedAgentContext,
            sylangRules,
            sprintContext,
            task,
            outputLanguage
        );

        this.logger.info(`✅ Generated prompt with ${prompt.length} characters`);
        return prompt;
    }

    /**
     * HARD DEPENDENCY VALIDATION - NO FALLBACKS
     */
    private async validateRequiredFiles(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceRoot) {
            throw new Error('❌ HARD ERROR: No workspace found. SylangAI requires an active workspace.');
        }

        const requiredFiles = [
            { name: '.agt', pattern: '**/*.agt' },
            { name: '.spr', pattern: '**/*.spr' },
            { name: '.sylangrules', pattern: '**/.sylangrules' }
        ];

        for (const file of requiredFiles) {
            const files = await vscode.workspace.findFiles(file.pattern);
            if (files.length === 0) {
                throw new Error(`❌ HARD ERROR: Required file ${file.name} not found. SylangAI requires .agt, .spr, and .sylangrules files in the workspace.`);
            }
            this.logger.info(`✅ Found required file: ${file.name} (${files.length} files)`);
        }
    }

    /**
     * EXTRACT AGENT CONTEXT FROM .AGT FILE (HARD REQUIREMENT)
     */
    private async extractAgentContext(agentName?: string): Promise<AgentContext> {
        if (!agentName) {
            throw new Error('❌ HARD ERROR: No agent assigned to task. Task must have assignedto ref agent AgentName.');
        }

        this.logger.info(`🔍 Extracting agent context for: ${agentName}`);

        const agentDefinitions = await this.readAgentDefinitions();
        const agentDef = agentDefinitions[agentName];

        if (!agentDef) {
            const availableAgents = Object.keys(agentDefinitions).join(', ');
            throw new Error(`❌ HARD ERROR: Agent '${agentName}' not found in .agt file. Available agents: ${availableAgents}`);
        }

        this.logger.info(`✅ Found agent definition: ${agentName} - ${agentDef.role}`);
        return {
            name: agentDef.name,
            description: agentDef.description,
            role: agentDef.role,
            specialization: agentDef.specialization,
            expertise: agentDef.expertise,
            context: agentDef.context
        };
    }

    /**
     * READ COMPLETE .SYLANGRULES FILE (NO FILTERING)
     */
    private async readSylangRules(): Promise<string> {
        this.logger.info(`📋 Reading complete .sylangrules file...`);

        const files = await vscode.workspace.findFiles('**/.sylangrules');
        if (files.length === 0) {
            throw new Error('❌ HARD ERROR: .sylangrules file not found');
        }

        const sylangRulesUri = files[0];
        const document = await vscode.workspace.openTextDocument(sylangRulesUri);
        const content = document.getText();

        this.logger.info(`✅ Loaded .sylangrules: ${content.length} characters`);
        return content;
    }

    /**
     * DETECT OUTPUT LANGUAGE FROM FILE EXTENSION
     */
    private detectOutputLanguage(outputfile?: string): string {
        if (!outputfile) {
            throw new Error('❌ HARD ERROR: No output file specified for task. Task must have outputfile property.');
        }

        const ext = path.extname(outputfile).toLowerCase();
        
        // Sylang extensions
        const sylangExtensions = ['.ple', '.fml', '.vml', '.vcf', '.fun', '.req', '.tst', '.blk', '.spr', '.agt'];
        if (sylangExtensions.includes(ext)) {
            return 'sylang';
        }

        // Programming languages
        const languageMap: Record<string, string> = {
            '.py': 'python',
            '.js': 'javascript',
            '.ts': 'typescript',
            '.c': 'c',
            '.cpp': 'cpp',
            '.h': 'c_header',
            '.html': 'html',
            '.css': 'css',
            '.json': 'json',
            '.xml': 'xml',
            '.md': 'markdown',
            '.txt': 'text'
        };

        return languageMap[ext] || 'unknown';
    }

    /**
     * BUILD STRUCTURED PROMPT TEMPLATE
     */
    private buildStructuredPrompt(
        agentContext: AgentContext,
        sylangRules: string,
        sprintContext: SprintContext,
        task: SprintTask,
        outputLanguage: string
    ): string {
        const prompt = `# AI TASK EXECUTION PROMPT

## AGENT CONTEXT
**Agent Name**: ${agentContext.name}
**Role**: ${agentContext.role}
**Specialization**: ${agentContext.specialization}
**Description**: ${agentContext.description}

**Expertise Areas**:
${agentContext.expertise.map(exp => `- ${exp}`).join('\n')}

**Domain Context**:
${agentContext.context.map(ctx => `- ${ctx}`).join('\n')}

## SPRINT CONTEXT
**Sprint**: ${sprintContext.sprintName}
**Sprint Description**: ${sprintContext.sprintDescription}

## TASK DETAILS
**Task Name**: ${task.name}
**Task Description**: ${task.description}
**Output File**: ${task.outputfile}
**Priority**: ${task.priority}
**Status**: ${task.issuestatus}

## OUTPUT REQUIREMENTS
**Target Language**: ${outputLanguage}
**Expected Output**: Raw ${outputLanguage} file content for ${task.outputfile}

${outputLanguage === 'sylang' ? this.buildSylangInstructions(sylangRules, task) : this.buildProgrammingInstructions(outputLanguage, task)}

## CRITICAL OUTPUT CONSTRAINTS
1. Generate ONLY the raw file content - no explanations, headers, or markdown
2. Start directly with the first line of code/content
3. Do NOT include any preamble like "Here is the code" or "This file contains"
4. Do NOT wrap in markdown code blocks (\`\`\`)
5. Include proper comments within the code only
6. Ensure production-ready, high-quality output
7. Follow industry best practices for ${outputLanguage}

Execute this task with your full expertise as a ${agentContext.role}.`;

        return prompt;
    }

    /**
     * BUILD SYLANG-SPECIFIC INSTRUCTIONS
     */
    private buildSylangInstructions(sylangRules: string, task: SprintTask): string {
        const fileExtension = task.outputfile ? path.extname(task.outputfile) : '.unknown';
        
        return `## SYLANG SYNTAX RULES
The complete Sylang language specification follows. Use this as your definitive reference:

${sylangRules}

## SYLANG TASK INSTRUCTIONS
1. Follow the exact syntax from the .sylangrules above
2. Use appropriate file type rules for ${fileExtension}
3. Include proper use statements if required
4. Follow indentation hierarchy (2 spaces per level)
5. Use meaningful identifiers and descriptions
6. Include safety levels and compliance information where applicable
7. Ensure cross-file references are valid
8. Apply automotive industry best practices`;
    }

    /**
     * BUILD PROGRAMMING LANGUAGE INSTRUCTIONS
     */
    private buildProgrammingInstructions(language: string, task: SprintTask): string {
        return `## ${language.toUpperCase()} PROGRAMMING INSTRUCTIONS
1. Write clean, production-ready ${language} code
2. Follow ${language} best practices and conventions
3. Include appropriate comments and documentation
4. Ensure code is modular and maintainable
5. Handle error cases appropriately
6. Use proper naming conventions for ${language}
7. Include necessary imports/includes
8. Optimize for readability and performance`;
    }

    /**
     * READ AGENT DEFINITIONS FROM .AGT FILES (PER-TASK)
     */
    private async readAgentDefinitions(): Promise<Record<string, AgentDefinition>> {
        const agentFiles = await vscode.workspace.findFiles('**/*.agt');
        const agentDefinitions: Record<string, AgentDefinition> = {};

        for (const agentFile of agentFiles) {
            const document = await vscode.workspace.openTextDocument(agentFile);
            const content = document.getText();
            const agents = this.parseAgentDefinitions(content);
            Object.assign(agentDefinitions, agents);
        }

        this.logger.info(`📖 Loaded ${Object.keys(agentDefinitions).length} agent definitions`);
        return agentDefinitions;
    }

    /**
     * PARSE AGENT DEFINITIONS FROM .AGT FILE CONTENT
     */
    private parseAgentDefinitions(content: string): Record<string, AgentDefinition> {
        const agents: Record<string, AgentDefinition> = {};
        const lines = content.split('\n');
        let currentAgent: Partial<AgentDefinition> | null = null;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('//')) continue;

            // Agent definition start
            const agentMatch = trimmedLine.match(/def\s+agent\s+([A-Za-z_][A-Za-z0-9_]*)/);
            if (agentMatch) {
                // Save previous agent
                if (currentAgent && currentAgent.name) {
                    agents[currentAgent.name] = currentAgent as AgentDefinition;
                }
                // Start new agent
                currentAgent = {
                    name: agentMatch[1],
                    description: '',
                    role: '',
                    specialization: '',
                    expertise: [],
                    context: []
                };
                continue;
            }

            // Parse agent properties
            if (currentAgent) {
                this.parseAgentProperty(currentAgent, trimmedLine);
            }
        }

        // Save last agent
        if (currentAgent && currentAgent.name) {
            agents[currentAgent.name] = currentAgent as AgentDefinition;
        }

        return agents;
    }

    /**
     * PARSE INDIVIDUAL AGENT PROPERTIES
     */
    private parseAgentProperty(agent: Partial<AgentDefinition>, line: string): void {
        const quotedMatch = line.match(/^\s*(\w+)\s+"([^"]+)"/);
        const unquotedMatch = line.match(/^\s*(\w+)\s+([^\s].+)/);
        const match = quotedMatch || unquotedMatch;

        if (match) {
            const [, property, value] = match;
            const cleanValue = value.replace(/"/g, '');

            switch (property) {
                case 'description':
                    agent.description = cleanValue;
                    break;
                case 'role':
                    agent.role = cleanValue;
                    break;
                case 'specialization':
                    agent.specialization = cleanValue;
                    break;
                case 'expertise':
                    if (!agent.expertise) agent.expertise = [];
                    agent.expertise.push(cleanValue);
                    break;
                case 'context':
                    if (!agent.context) agent.context = [];
                    agent.context.push(cleanValue);
                    break;
            }
        }
    }
} 