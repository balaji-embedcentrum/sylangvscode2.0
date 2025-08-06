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
exports.AIPromptGenerator = void 0;
const vscode = __importStar(require("vscode"));
class AIPromptGenerator {
    constructor(logger) {
        this.logger = logger;
    }
    async findAgentFile() {
        try {
            // Look for .agt file in workspace root
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (!workspaceRoot) {
                this.logger.info('❌ No workspace root found for agent file lookup');
                return null;
            }
            // Try common agent file names
            const agentFileNames = ['sylang.agt', 'agents.agt', 'sylangagents.agt'];
            for (const fileName of agentFileNames) {
                const agentFileUri = vscode.Uri.joinPath(workspaceRoot, fileName);
                try {
                    await vscode.workspace.fs.stat(agentFileUri);
                    this.logger.info(`✅ Found agent file: ${fileName}`);
                    return agentFileUri;
                }
                catch {
                    // File doesn't exist, continue
                }
            }
            this.logger.info('⚠️ No .agt agent file found in workspace root');
            return null;
        }
        catch (error) {
            this.logger.info('❌ Error finding agent file:', error);
            return null;
        }
    }
    async readAgentDefinitions() {
        const agentFile = await this.findAgentFile();
        if (!agentFile) {
            return {};
        }
        try {
            const content = await vscode.workspace.fs.readFile(agentFile);
            const contentStr = Buffer.from(content).toString('utf8');
            this.logger.info(`📖 Reading agent definitions from: ${agentFile.fsPath}`);
            return this.parseAgentDefinitions(contentStr);
        }
        catch (error) {
            this.logger.info('❌ Error reading agent file:', error);
            return {};
        }
    }
    parseAgentDefinitions(content) {
        const agents = {};
        const lines = content.split('\n');
        let currentAgent = null;
        let inAgent = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('//')) {
                continue;
            }
            // Check for agent definition
            const agentMatch = trimmedLine.match(/def\s+agent\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
            if (agentMatch) {
                // Save previous agent if exists
                if (currentAgent && currentAgent.name) {
                    agents[currentAgent.name] = currentAgent;
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
                inAgent = true;
                this.logger.debug(`📝 Found agent definition: ${currentAgent.name}`);
                continue;
            }
            // Parse agent properties
            if (inAgent && currentAgent) {
                // Check if we've left the current agent (next def or end)
                if (trimmedLine.startsWith('def ') && !trimmedLine.includes('agent')) {
                    inAgent = false;
                    continue;
                }
                this.parseAgentProperty(currentAgent, trimmedLine);
            }
        }
        // Save last agent
        if (currentAgent && currentAgent.name) {
            agents[currentAgent.name] = currentAgent;
        }
        this.logger.info(`✅ Parsed ${Object.keys(agents).length} agent definitions`);
        return agents;
    }
    parseAgentProperty(agent, line) {
        const quotedMatch = line.match(/^\s*(\w+)\s+"([^"]+)"/);
        const listMatch = line.match(/^\s*(\w+)\s+\[([^\]]+)\]/);
        const unquotedMatch = line.match(/^\s*(\w+)\s+([^\s]+)/);
        const match = quotedMatch || listMatch || unquotedMatch;
        if (match) {
            const [, property, value] = match;
            switch (property) {
                case 'description':
                    agent.description = value.replace(/"/g, '');
                    break;
                case 'role':
                    agent.role = value.replace(/"/g, '');
                    break;
                case 'specialization':
                    agent.specialization = value.replace(/"/g, '');
                    break;
                case 'expertise':
                    if (listMatch) {
                        agent.expertise = value.split(',').map(s => s.trim().replace(/"/g, ''));
                    }
                    else {
                        agent.expertise = [value.replace(/"/g, '')];
                    }
                    break;
                case 'context':
                    if (listMatch) {
                        agent.context = value.split(',').map(s => s.trim().replace(/"/g, ''));
                    }
                    else {
                        agent.context = [value.replace(/"/g, '')];
                    }
                    break;
            }
        }
    }
    async generateTaskPrompt(sprintContext, task, agentContext) {
        this.logger.info(`Generating AI prompt for task: ${task.name}`, {
            type: task.type,
            assignedto: task.assignedto,
            outputfile: task.outputfile
        });
        // Read agent definitions from .agt file
        const agentDefinitions = await this.readAgentDefinitions();
        // Try to find agent definition from .agt file first
        let resolvedAgentContext = agentContext;
        if (task.assignedto && agentDefinitions[task.assignedto]) {
            const agentDef = agentDefinitions[task.assignedto];
            resolvedAgentContext = {
                name: agentDef.name,
                role: agentDef.role,
                expertise: agentDef.expertise,
                context: agentDef.context,
                description: agentDef.description,
                specialization: agentDef.specialization
            };
            this.logger.info(`✅ Using agent definition from .agt file: ${task.assignedto}`);
        }
        else if (task.assignedto) {
            // Fallback to hardcoded agent context if no .agt file
            resolvedAgentContext = this.getHardcodedAgentContext(task.assignedto);
            this.logger.info(`⚠️ Using hardcoded agent context for: ${task.assignedto} (no .agt file found)`);
        }
        const prompt = `${this.generateAgentPersona(resolvedAgentContext)}

${this.generateSprintContext(sprintContext)}

${this.generateTaskDetails(task)}

${this.generateTaskInstructions(task)}

${this.generateSylangSyntaxReference(task)}`;
        this.logger.debug('Generated complete AI prompt', {
            promptLength: prompt.length,
            sections: ['persona', 'sprint', 'task', 'instructions', 'syntax']
        });
        return prompt;
    }
    generateAgentPersona(agentContext) {
        if (!agentContext) {
            return `Please act as a Product Line Engineering Expert specializing in Automotive Systems Engineering with expertise in ISO 26262 Functional Safety, AUTOSAR Architecture, and Sylang Language.`;
        }
        const expertiseList = agentContext.expertise.join(', ');
        const contextList = agentContext.context.join(', ');
        return `Please act as ${agentContext.name}, a ${agentContext.role} with expertise in: ${expertiseList}.

Your working context includes: ${contextList}.

You are an expert in Sylang DSL and follow automotive industry standards for systems engineering.`;
    }
    generateSprintContext(sprintContext) {
        const taskSummary = this.summarizeTasksByType(sprintContext.tasks);
        return `SPRINT CONTEXT:
Sprint: ${sprintContext.sprintName}
${sprintContext.sprintDescription ? `Description: ${sprintContext.sprintDescription}` : ''}
${sprintContext.sprintOwner ? `Owner: ${sprintContext.sprintOwner}` : ''}
${sprintContext.startdate ? `Start Date: ${sprintContext.startdate}` : ''}
${sprintContext.enddate ? `End Date: ${sprintContext.enddate}` : ''}

Task Summary:
${taskSummary}`;
    }
    generateTaskDetails(task) {
        const parentInfo = task.parent ? `\nParent: ${task.parent}` : '';
        const priorityInfo = task.priority ? `\nPriority: ${task.priority}` : '';
        const pointsInfo = task.points ? `\nEstimated Points: ${task.points}` : '';
        return `CURRENT TASK:
Type: ${task.type}
Name: ${task.name}${task.description ? `\nDescription: ${task.description}` : ''}${parentInfo}${priorityInfo}${pointsInfo}
Status: ${task.issuestatus}
${task.outputfile ? `Expected Output: ${task.outputfile}` : 'No specific output file expected'}`;
    }
    generateTaskInstructions(task) {
        // Use the task's description as the primary instruction
        const primaryInstruction = task.description ||
            `Complete this ${task.type}: ${task.name}`;
        const outputInstruction = task.outputfile ?
            `\n\nIMPORTANT: Create the file "${task.outputfile}" with the generated Sylang content.` : '';
        return `TASK INSTRUCTIONS:
${primaryInstruction}${outputInstruction}

CRITICAL OUTPUT REQUIREMENTS:
- Generate ONLY pure Sylang code without ANY markdown formatting
- DO NOT include \`\`\`sylang or \`\`\` code blocks
- DO NOT include phrases like "Here is the Sylang content" or "This file adheres to..."
- DO NOT include any explanations, headers, or comments outside the code
- Output ONLY the raw Sylang syntax starting with "hdef" or "def"
- The file should start directly with the first Sylang definition, no preamble

Follow these guidelines:
1. Generate production-ready Sylang code that exactly matches the task description
2. Include proper documentation and comments WITHIN the Sylang code only
3. Follow automotive industry best practices for ${task.type} deliverables
4. Ensure compliance with safety standards where applicable
5. Use meaningful identifiers and descriptions that reflect the task requirements
6. Output ONLY the Sylang code - no markdown, no explanations, no headers, no code blocks`;
    }
    generateSylangSyntaxReference(task) {
        if (!task.outputfile) {
            return this.getGenericSylangSyntax();
        }
        const fileExtension = task.outputfile.split('.').pop();
        switch (fileExtension) {
            case 'ple':
                return this.getPLESyntax();
            case 'fml':
                return this.getFMLSyntax();
            case 'fun':
                return this.getFUNSyntax();
            case 'req':
                return this.getREQSyntax();
            default:
                return this.getGenericSylangSyntax();
        }
    }
    getPLESyntax() {
        return `SYLANG .PLE SYNTAX REFERENCE:
\`\`\`sylang
hdef productline <identifier>
  name "Product Line Name"
  description "Detailed description"
  owner "Owner Name"
  domain "domain1", "domain2"
  compliance "ISO26262", "AUTOSAR"
  firstrelease "YYYY-MM-DD"
  tags "tag1", "tag2"
  safetylevel ASIL-D
  region "Global", "Regional"
\`\`\``;
    }
    getFMLSyntax() {
        return `SYLANG .FML SYNTAX REFERENCE:
\`\`\`sylang
hdef featureset <identifier>
  name "Feature Set Name"
  description "Feature model description"
  owner "Owner Name"

def feature <identifier> [mandatory|optional|or|alternative]
  name "Feature Name"
  description "Feature description"
  requires <feature_reference>
  excludes <feature_reference>
\`\`\``;
    }
    getFUNSyntax() {
        return `SYLANG .FUN SYNTAX REFERENCE:
\`\`\`sylang
hdef functionset <identifier>
  name "Function Set Name"
  description "Function group description"
  owner "Owner Name"

def function <identifier>
  name "Function Name"
  description "Function description"
  safetylevel ASIL-D
  needs <reference>
  provides <interface>
\`\`\``;
    }
    getREQSyntax() {
        return `SYLANG .REQ SYNTAX REFERENCE:
\`\`\`sylang
hdef reqset <identifier>
  name "Requirement Set Name"
  description "Requirements description"
  owner "Owner Name"

def requirement <identifier>
  name "Requirement Name"
  description "Detailed requirement description"
  priority high
  safetylevel ASIL-D
  verifiedby <test_reference>
\`\`\``;
    }
    getGenericSylangSyntax() {
        return `SYLANG GENERAL SYNTAX:
- Use "hdef <type> <identifier>" for header definitions
- Use "def <type> <identifier>" for item definitions
- Properties: name, description, owner, tags, etc.
- Relations: needs, provides, requires, excludes, verifiedby
- Enums: safetylevel (ASIL-A to ASIL-D, QM), priority (low, medium, high, critical)
- Use proper indentation for hierarchy
- Quote strings with spaces, identifiers without spaces don't need quotes`;
    }
    summarizeTasksByType(tasks) {
        const summary = tasks.reduce((acc, task) => {
            const key = `${task.type} (${task.issuestatus})`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(summary)
            .map(([key, count]) => `- ${count} ${key}`)
            .join('\n');
    }
    getHardcodedAgentContext(assignedTo) {
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
            default:
                return undefined;
        }
    }
}
exports.AIPromptGenerator = AIPromptGenerator;
//# sourceMappingURL=aiPromptGenerator.js.map