# Sylang AI - Sprint Automation Extension

🤖 **AI-first sprint automation** for Sylang DSL projects. Reads `.spr` files, executes tasks via AI chat, and updates sprint status automatically.

## Features

### 🎯 Sprint-AI Integration Workflow
1. **Read Sprint Context** - Parses `.spr` files to extract sprint/epic/story/task hierarchies
2. **Find Next Task** - Identifies available tasks with `open` or `backlog` status
3. **Execute with AI** - Generates context-aware prompts and integrates with Cursor AI/GitHub Copilot
4. **Auto-Status Updates** - Updates task `issuestatus` based on AI execution results
5. **Output Verification** - Checks if expected Sylang files were created/updated

### 🏗️ Clean Architecture
- **`core/logger.ts`** - Production-grade logging (debug/info/warn/error)
- **`core/sprintReader.ts`** - Sprint file parser with task hierarchy extraction  
- **`core/statusUpdater.ts`** - Sprint status updates with file modification
- **`core/aiPromptGenerator.ts`** - Context-aware prompt generation with agent personas

### 👥 Agent Context Support
- **ScrumMaster** - Project management, sprint planning, agile methodologies
- **Architect** - Systems engineering, AUTOSAR, ISO 26262, model-based design  
- **SME** - Domain knowledge, technical specifications, requirement analysis
- **Custom Agents** - Extensible agent definitions with expertise and context

### 📝 Sylang Syntax Integration
- **`.ple`** - Product Line syntax reference and validation
- **`.fml`** - Feature Model syntax with mandatory/optional/alternative patterns
- **`.fun`** - Function Group syntax with safety levels
- **`.req`** - Requirements syntax with verification traceability
- **Generic** - Fallback syntax for other Sylang file types

## Installation

1. Download the latest `.vsix` from releases
2. Install in VSCode: `code --install-extension sylangai-1.0.0.vsix`
3. Reload VSCode

## Usage

### 1. Create Sprint File
Create a `.spr` file in your Sylang project:

```sylang
hdef sprint ElectricParkBrakeSprint
  name "Electric Park Brake Development Sprint"
  description "Implement EPB system with AI automation"
  owner "Systems Team"
  startdate "2025-01-28"
  enddate "2025-02-11"

def epic EPBSystemArchitecture
  name "EPB System Architecture"
  description "Design complete EPB system architecture"
  assignedto "architect"
  issuestatus "open"
  priority "high"
  outputfile "systems/EPBArchitecture.ple"

def story EPBFeatureModel
  name "EPB Feature Model"
  description "Create feature model for EPB variants"
  assignedto "sme"
  issuestatus "backlog"
  priority "medium"
  outputfile "features/EPBFeatures.fml"

def task EPBSafetyRequirements
  name "EPB Safety Requirements"
  description "Define ASIL-D safety requirements"
  assignedto "scrummaster"
  issuestatus "backlog"
  priority "critical"
  outputfile "requirements/EPBSafety.req"
```

### 2. Run Sprint Automation
- Open Command Palette (`Ctrl+Shift+P`)
- Run: **"Run Auto AI Agent"**
- The extension will:
  - Find the next available task
  - Generate AI prompt with sprint + agent context
  - Open chat with Cursor AI/GitHub Copilot
  - Update task status based on results

### 3. Monitor Progress
- Check the **Sylang AI** output panel for detailed logs
- Sprint file is automatically updated with task status changes
- Generated Sylang files are created in specified output paths

## Sprint Status Values
- **`backlog`** - Task not yet started
- **`open`** - Task ready to begin
- **`inprogress`** - AI is currently working on task
- **`blocked`** - Task failed or output file missing
- **`canceled`** - Task cancelled
- **`done`** - Task completed successfully

## Agent Assignments
- **`architect`** - Systems architecture, AUTOSAR, safety-critical design
- **`scrummaster`** - Project coordination, sprint planning, process management
- **`sme`** - Subject matter expertise, domain knowledge, specifications
- **Custom** - Any string creates a generic AI agent with Sylang expertise

## Configuration

The extension works with:
- **Cursor AI** - Primary integration with auto-context and chat automation
- **GitHub Copilot** - Secondary integration via `workbench.action.chat.open`
- **Manual Mode** - Fallback with clipboard-based context injection

## Requirements

- VSCode 1.74.0+
- Sylang Core Extension (for `.spr` file syntax support)
- Cursor AI or GitHub Copilot for AI interaction

## Architecture

This extension is completely **separate and removable** from the core Sylang extension:
- Zero impact on existing Sylang functionality
- Independent VSIX package
- Clean separation of concerns
- Can be uninstalled without affecting core features

## Development

```bash
# Clone and setup
git clone https://github.com/balaji-embedcentrum/sylangai.git
cd sylangai
npm install

# Compile and package
npm run compile
npx vsce package

# Install for testing
code --install-extension sylangai-1.0.0.vsix
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with proper logging (no `console.log`!)
4. Test with real `.spr` files
5. Submit pull request

## License

MIT License - see [LICENSE](LICENSE) file.

## Related Projects

- [Sylang Core Extension](https://github.com/balaji-embedcentrum/sylangvscode) - Main Sylang DSL support
- [Sylang Language Specification](https://github.com/balaji-embedcentrum/sylang-spec) - Language documentation

---

**🎯 Vision**: Enable 80% AI automation, 20% human validation for Sylang-based systems engineering projects. 