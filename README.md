# 🔧 Sylang VSCode Extension

[![Version](https://img.shields.io/badge/version-2.0.4-blue.svg)](https://github.com/balaji-embedcentrum/sylangvscode)
[![VSCode](https://img.shields.io/badge/VSCode-1.74+-brightgreen.svg)](https://code.visualstudio.com/)
[![MIT License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)

A comprehensive Visual Studio Code extension for **Sylang** - a domain-specific language for Model Based Systems Engineering and Digital Twin development.

## 🎯 Overview

Sylang is designed for AI-assisted systems development in safety-critical industries such as **Automotive**, **Aerospace**, **Medical**, and **Industrial**. This VSCode extension provides full language support with intelligent syntax highlighting, real-time cross-file validation, configuration-based feature management, and automated code generation.

### ✨ **What Makes Sylang Special?**
- **AI-First Design**: Built for AI-assisted engineering workflows
- **Safety-Critical Ready**: Compliance with ASIL standards and safety requirements  
- **Feature Model Integration**: Advanced product line management and variant configuration
- **Cross-File Intelligence**: Smart symbol resolution across multiple files
- **Configuration-Based Features**: Visual graying and functional disabling based on feature selections

## Features

### 🎨 **Syntax Highlighting**
- Support for all 7 Sylang file extensions: `.ple`, `.fml`, `.vml`, `.vcf`, `.fun`, `.req`, `.tst`, `.blk`
- Context-aware keyword highlighting
- String and comment highlighting
- Identifier and enum value highlighting

### ⚡ **Real-time Validation & Intelligence**
- **Grammar Validation**: Complete syntax checking for all file types
- **Cross-File Symbol Resolution**: Smart symbol resolution across project files
- **Import Validation**: Strict `use` statement validation with unused import detection
- **Relationship Validation**: Enforces correct target types for all relations
- **Configuration-Based Validation**: Detects references to disabled symbols
- **Nested Hierarchy Support**: Complex parent-child-grandchild symbol relationships
- **File Restriction Enforcement**: Prevents invalid relation usage in high-level files

### 🎨 **Configuration-Based Visual Feedback** ⭐ **NEW**
- **Smart Graying**: Disabled symbols visually grayed out based on config values
- **Individual Symbol Disabling**: `def` with `when ref config` where config = 0
- **Whole File Disabling**: `hdef` with `when ref config` where config = 0  
- **Functional Unavailability**: Disabled symbols cannot be referenced or imported
- **Enhanced Error Messages**: Clear distinction between missing and disabled symbols

### 🔍 **Error Reporting**
- **Problems Panel**: Integrated error display
- **Inline Squiggly Underlines**: Immediate visual feedback
- **Output Console**: Detailed logging with timestamps
- Comprehensive error codes for easy debugging

### 🧠 **Intelligent Features**
- **Autocomplete**: Keywords, enum values, and symbol references
- **Symbol Management**: Cross-file reference resolution
- **Import Validation**: Ensures `use` statements are correctly formed
- **Config-based Visibility**: Symbols with `config 0` are hidden

### 🏗️ **Code Generation**
- **Create .sylangrules**: Initialize Sylang projects via Command Palette
- **Generate .vml from .fml**: Right-click on Feature Model files
- **Generate .vcf from .vml**: Right-click on Variant Model files
- Auto-generation with proper templates and structure

### 📊 **Logging & Debugging**
- Configurable log levels (debug, info, warn, error)
- Version visibility in console output
- Detailed validation reports
- Performance monitoring

## 📁 File Types Supported (7 Extensions)

> **🚀 Current Version (v2.0.4)** - Fully supports 7 file extensions with complete cross-file validation

| Extension | Description | Rules | Status |
|-----------|-------------|-------|--------|
| `.ple` | Product Line | Only one per project, no `use` statements | ✅ **Complete** |
| `.fml` | Feature Model | Only one per project | ✅ **Complete** |
| `.vml` | Variant Model | Multiple allowed, derived from `.fml` | ✅ **Complete** |
| `.vcf` | Variant Config | Auto-generated, only one per project | ✅ **Complete** |
| `.fun` | Function Group | Multiple allowed at various levels | ✅ **Complete** |
| `.req` | Requirements | Multiple allowed at various levels | ✅ **Complete** |
| `.tst` | Test Suite | Multiple allowed at various levels | ✅ **Complete** |
| `.blk` | Block | Multiple allowed, hierarchical system design | ✅ **Complete** |

### 🔮 **Coming Soon**
- **Systems Analysis**: `.fma`, `.fmc`, `.fta`
- **Safety Analysis**: `.itm`, `.haz`, `.rsk`, `.sgl`  
- **General Definitions**: `.enm`

## 🚀 Installation

### From VSCode Marketplace
1. Open VSCode
2. Go to Extensions (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "Sylang"
4. Click **Install**

### From VSIX Package
1. Download the latest `.vsix` file from releases
2. Open VSCode Command Palette (`Ctrl+Shift+P`)
3. Type "Extensions: Install from VSIX"
4. Select the downloaded `.vsix` file

## 🏁 Quick Start

### 1. Create a Sylang Project
1. Open a folder in VSCode
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "Sylang: Create Sylang Project"
4. This creates a `.sylangrules` file marking your project root

### 2. Create Your First Files
Start with a Product Line file (`.ple`):

```sylang
hdef productline MyProductLine
  name "My Systems Product Line"
  description "Sample product line for demonstration"
  owner "Engineering Team"
  domain "automotive", "safety-critical"
  safetylevel ASIL-C
  region "Global"
```

### 3. Generate Derived Files
- Right-click on `.fml` files → "Create .vml template"
- Right-click on `.vml` files → "Generate variant config (.vcf)"

## Language Features

### Indentation-based Structure
Sylang uses strict indentation (2 spaces or 1 tab per level):

```sylang
hdef featureset MyFeatures
  name "Feature Set Name"
  
  def feature CoreFeature mandatory
    name "Core System Feature"
    
    def feature SubFeature optional
      name "Optional Sub-feature"
```

### Cross-file References
Sylang enforces strict cross-file reference rules:

**1. Import Required:** External symbols must be imported with `use`:
```sylang
use productline MyProductLine
use featureset MyFeatures
```

**2. Reference Required:** External symbols must use `ref` keyword:
```sylang
hdef variantset MyVariants
  listedfor ref productline MyProductLine
  extends ref feature CoreFeature mandatory selected
```

**❌ Common Errors:**
```sylang
// ERROR: Missing 'use' statement
listedfor ref productline SomeProductLine

// ERROR: Missing 'ref' keyword  
listedfor productline MyProductLine
```

### Relationship Validation
Sylang enforces strict relationship target type rules:

**✅ Valid Relationships:**
- `listedfor ref productline` ✓
- `implements ref function` ✓  
- `enables ref feature` ✓
- `allocatedto ref block` ✓
- `satisfies ref requirement` ✓
- `extends ref feature` ✓

**❌ Invalid Relationships:**
```sylang
// ERROR: Wrong target type
listedfor ref feature SomeFeature  // Should be productline
implements ref requirement SomeReq // Should be function
```

### Import Rules
**✅ Valid Imports:**
```sylang
use productline MyProductLine    // ✓ hdef symbols only
use featureset MyFeatures       // ✓ hdef symbols only
```

**❌ Invalid Imports:**
```sylang
use feature SomeFeature         // ✗ Can't import def symbols
```

**⚠️ Unused Import Warnings:**
- Unused `use` statements show yellow warnings
- Import is considered "used" if any of its children are referenced

### Configuration-based Visibility ⭐ **NEW**
Symbols can be disabled based on configuration values, with both visual graying and functional unavailability:

#### **New Pattern** (Recommended):
```sylang
def function AdvancedAnalytics
  name "Advanced Analytics Function"
  when ref config c_AdvancedAlgorithms_PredictiveAnalytics
  // If config = 0: function is grayed out AND unavailable for reference
```

#### **Legacy Pattern** (Still Supported):
```sylang
def feature OptionalFeature
  ref config c_OptionalFeature  // If config = 0, feature is invisible
```

#### **File-Level Disabling**:
```sylang
hdef functionset AdvancedFunctions
  when ref config c_AdvancedFeatures
  // If config = 0: ENTIRE FILE is grayed out and all symbols unavailable
```

### Enhanced Error Handling
The extension now provides clear distinction between different error types:

- **Missing Symbol**: `"Unresolved reference to 'X'. Symbol not found in project."`
- **Disabled Symbol**: `"Reference to 'X' is not available because the symbol is disabled by configuration."`
- **Missing Import**: `"Reference to 'X' requires a 'use' statement. Add 'use <type> X' at the top of the file."`

## Extension Settings

Configure the extension in VSCode settings:

```json
{
  "sylang.validation.enabled": true,
  "sylang.validation.realTime": true,
  "sylang.logging.level": "info"
}
```

## Architecture

### Core Components

1. **Keywords Manager** (`src/core/keywords.ts`)
   - Extensible keyword definitions for each file type
   - Enum value management
   - File-specific validation rules

2. **Symbol Manager** (`src/core/symbolManager.ts`)
   - In-memory symbol table
   - Cross-file reference resolution
   - Configuration-based visibility

3. **Validation Engine** (`src/core/validationEngine.ts`)
   - Real-time grammar validation
   - File-specific validation rules
   - Error code generation

4. **Diagnostics Provider** (`src/diagnostics/diagnosticsProvider.ts`)
   - Problems panel integration
   - Inline error display
   - Console logging

5. **Command Manager** (`src/commands/commandManager.ts`)
   - Project initialization
   - Code generation commands
   - File templates

### Extensibility

The extension is designed for easy extension:

- **Add new file types**: Update `SYLANG_FILE_TYPES` array
- **Add new keywords**: Extend file-specific keyword arrays
- **Add new enums**: Update `SYLANG_ENUMS` array
- **Add new validation rules**: Extend validation methods

## Development

### Project Structure
```
newsylangcursor/
├── src/
│   ├── core/                  # Core language components
│   ├── commands/              # Command implementations
│   ├── diagnostics/           # Error reporting
│   └── extension.ts           # Main extension entry point
├── syntaxes/                  # TextMate grammars
├── package.json               # Extension manifest
└── tsconfig.json             # TypeScript configuration
```

### Building
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch
```

### Testing
1. Press `F5` in VSCode to launch Extension Development Host
2. Create a test folder with `.sylangrules` file
3. Create sample Sylang files to test features

## 🎯 Changelog

### v2.4.9 (Latest)
- **SYNTAX HIGHLIGHTING FIX**: Fixed inconsistent highlighting for comma-separated identifiers
  - **Consistent colors**: All identifiers in comma-separated lists now have the same green highlighting
  - **Updated grammar files**: Fixed regex patterns in .blk, .fml, .vml, and .vcf syntax files
  - **Visual consistency**: First and subsequent identifiers now have identical syntax highlighting
  - **Example**: `composedof ref block Block1, Block2, Block3` - all three identifiers are now green

### v2.4.8 (Latest)
- **MULTIPLE REFERENCE VALIDATION FIX**: Fixed validation for comma-separated identifiers in relations
  - **All identifiers validated**: Now validates every identifier in comma-separated lists, not just the first one
  - **Consistent error reporting**: All missing identifiers show proper error highlighting and messages
  - **Proper tokenization**: Comma-separated identifiers are correctly parsed and validated individually
  - **Example**: `composedof ref block Block1, Block2, Block3` now validates all three identifiers

### v2.4.7 (Latest)
- **COMMA-SEPARATED IDENTIFIERS**: Added support for multiple identifiers in relations
  - **Multiple identifier relations**: `enables ref feature xx, yy, zz`, `composedof ref block jjj, kkk, ddd`
  - **Single identifier relations**: `extends ref feature <identifier>` (1:1 relation for FML/VML)
  - **Cardinality validation**: Enforces correct number of identifiers per relation type
  - **Tokenization enhancement**: Properly handles comma-separated identifiers in parsing
  - **Core relations defined**: All core relations have proper cardinality rules

### v2.4.6 (Latest)
- **FOLDER STRUCTURE VALIDATION**: Added enforcement of file organization rules
  - **One .fml per folder**: Only one feature model allowed per folder
  - **One .vcf per folder**: Only one configuration file allowed per folder
  - **Multiple .vml per folder**: Multiple variant definitions allowed per folder
  - **Real-time validation**: Shows errors when multiple .fml/.vcf files found in same folder
  - **Project organization**: Supports hierarchical folder structure (productline/, systems/, subsystems/)

### v2.4.5
- **HIERARCHICAL FEATURE MODELS**: Added support for multi-level feature models
  - **Level Enum**: Replaced `blocktype` with `level` enum for consistent hierarchy across all file types
  - **Inherits Relation**: Added `inherits` relation for cross-file inheritance
    - `.fml`: `inherits ref featureset <identifier>` - Inherit features from parent
    - `.vml`: `inherits ref variantset <identifier>` - Inherit variant selections  
    - `.vcf`: `inherits ref configset <identifier>` - Inherit configuration values
  - **Level Values**: `productline`, `system`, `subsystem`, `component`, `module`, `interface`
  - **Syntax Highlighting**: Updated for new keywords and relations

### v2.4.4
- **GO TO REFERENCES**: Added Find All References functionality
  - Right-click on any identifier and select "Find All References" (⇧F12)
  - Shows all places where a symbol is defined and referenced
  - Works across all Sylang files in the project
  - Includes references in properties and relations

### v2.4.3
- **DUPLICATE IDENTIFIER FIX**: Fixed cross-file duplicate identifier detection
  - Now properly detects when same identifier is used as different types across files
  - Shows "Duplicate identifier 'X'. You have a 'function' in this file and a 'feature' in another file"
  - Prevents confusion between type mismatch and duplicate identifier errors

### v2.4.2
- **CRITICAL FIXES**: Fixed validation issues that were causing incorrect error messages
  - Fixed string literal validation - keywords inside quoted strings are no longer validated
  - Fixed duplicate identifier detection - now properly detects when function and feature have same name
  - Added missing Go to Definition, Hover, and Document Symbols providers
  - Improved tokenization to respect quoted strings
  - Enhanced error messages for duplicate identifiers

### v2.4.1
- **KEYWORD CHANGE**: `resolves ref config` → `when ref config` for better semantic clarity
- Updated all syntax highlighting, validation, and documentation
- Improved readability of configuration references

### v2.2.1 - 2025-07-21
#### 🛡️ **Critical Validation Improvements**
- **Complete Sibling Validation**: Full implementation of feature sibling consistency checking for .fml files
- **VML File Validation**: Extended sibling validation to .vml files to prevent manual editing errors
- **VCF Generation Protection**: Added mandatory validation before .vcf generation to ensure data integrity
- **Error Prevention**: Blocks .vcf generation if .vml files have validation errors, preventing corrupt configurations

### v2.0.2 - 2025-07-21
#### 🎨 **Visual Improvements**
- **Extension Icon**: Added custom Sylang favicon for better marketplace visibility
- **Brand Consistency**: Professional icon representation in VSCode Extensions panel

### v2.0.1 - 2025-07-21
#### 🎉 **Major Release**
- **Marketplace Ready**: Complete documentation and professional presentation
- **Enhanced .sylangrules Generation**: Comprehensive project configuration with AI development guidelines
- **Version Management**: Centralized versioning across all components
- **Documentation Complete**: Full specification for all 7 file extensions with sample code

#### 🔧 **Infrastructure Improvements**
- Professional README.md for marketplace publication
- Complete NewSylang.md specification for AI development
- Comprehensive .sylangrules template with validation checklists
- Improved command management for project initialization

### v1.3.9 - 2025-07-21
#### 🆕 **Major Features**
- **Configuration-Based Symbol Management**: New `when ref config` pattern for advanced feature control
- **Visual Graying System**: Disabled symbols are visually grayed out and functionally unavailable
- **Enhanced Cross-File Validation**: Support for complex nested hierarchies and improved error detection
- **Strict Relationship Validation**: Enhanced validation rules preventing invalid relation usage

#### 🔧 **Improvements**
- Improved symbol resolution algorithm with nested hierarchy support
- Enhanced error messages with clear distinction between missing and disabled symbols
- Better import validation with unused import detection
- File restriction enforcement for relations (e.g., `resolves` not allowed in `.ple`, `.fml`, `.vml`, `.vcf`)
- Centralized version management and logging system

#### 🐛 **Bug Fixes**
- Fixed symbol parsing to properly recognize `when ref config` as properties
- Corrected import usage detection for nested parent-child relationships
- Fixed graying out logic to exclude disabled symbols from symbol resolution
- Improved validation engine to handle disabled symbol references

### v1.2.x - Development Versions
- Cross-file validation enhancements
- Symbol management improvements
- Import validation system

### v1.1.0 - Initial Release
- Complete language support for 7 file extensions
- Real-time validation and autocomplete
- Code generation commands
- Basic cross-file symbol resolution

## 🆘 Support & Help

### Having Issues?
1. **Check the Problems Panel**: Most validation errors are displayed with helpful messages
2. **Check Output Console**: Select "Sylang" from the dropdown for detailed logs
3. **Verify Project Setup**: Ensure you have a `.sylangrules` file in your project root

### Common Solutions
- **Symbol not found**: Check if you have the correct `use` statement
- **Import errors**: Verify the symbol exists and is properly defined with `hdef`
- **Grayed out symbols**: Check config values in your `.vcf` file

### Getting Help
- 📖 **Documentation**: Complete language specification in `NewSylang.md`
- 🐛 **Issues**: Report bugs on GitHub repository
- 💡 **Feature Requests**: Suggest improvements via GitHub issues

## 🤝 Contributing

We welcome contributions to improve Sylang VSCode extension! 

### For Users:
- Report bugs and issues
- Suggest new features
- Share example projects
- Improve documentation

### For Developers:
- Follow existing modular architecture
- Maintain extensibility for new file types
- Ensure comprehensive validation
- Update documentation for changes

### Development Setup:
```bash
git clone https://github.com/balaji-embedcentrum/sylangvscode
cd sylangvscode
npm install
npm run compile
```

## 📄 License

MIT License - This project is developed for Sylang language support in VSCode environments, focusing on Model Based Systems Engineering and Digital Twin applications.

---

**🔧 Built for Systems Engineers | 🤖 Designed for AI Collaboration | 🛡️ Ready for Safety-Critical Development** 