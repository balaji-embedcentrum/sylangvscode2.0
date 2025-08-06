"use strict";
generateSylangrulesContent();
string;
{
    const timestamp = new Date().toISOString();
    return `# Sylang Project Rules and AI Development Guidelines
# This file provides comprehensive context for AI development of Sylang projects

project_name: "Sylang Model-Based Systems Engineering Project"
language: "Sylang"
version: "${SYLANG_VERSION}"
domain: "Model-Based Systems Engineering, Digital Twin, Feature Modeling"

# CRITICAL: Only these 10 extensions are fully implemented and working
implemented_extensions:
  - .ple (Product Line Engineering) - COMPLETE
  - .fml (Feature Model) - COMPLETE  
  - .vml (Variant Model) - COMPLETE
  - .vcf (Variant Configuration) - COMPLETE
  - .blk (Block Definition) - COMPLETE
  - .fun (Function Definition) - COMPLETE
  - .req (Requirement Definition) - COMPLETE
  - .tst (Test Definition) - COMPLETE
  - .spr (Sprint Definition) - COMPLETE
  - .agt (Agent Definition) - COMPLETE

planned_extensions:
  - .phy (Physical Models) - PLANNED
  - .sim (Simulation Models) - PLANNED
  - .cal (Calibration) - PLANNED

# REAL SYLANG FILE STRUCTURE EXAMPLES

## .ple FILES (Product Line Engineering)
# Rule: ONE hdef productline, NO def statements, NO use statements
ple_example: |
  hdef productline BloodPressureProductLine
    name "Blood Pressure Monitoring System Product Line"
    description "Comprehensive digital blood pressure monitoring system for home and clinical use"
    owner "Medical Device Engineering Team"
    domain "medical-devices", "health-monitoring", "connected-health"
    compliance "ISO 14971", "IEC 62304", "ISO 13485"
    firstrelease "2025-06-01"
    tags "blood-pressure", "sphygmomanometer", "digital-health"
    safetylevel ASIL-C
    region "Global", "North America", "Europe"

# Multiple def Rules by File Type
def_statement_rules:
  .ple: "NO def statements - only hdef productline with properties"
  .fml: "MULTIPLE def feature allowed - hierarchical features with constraints"
  .vml: "AUTO-GENERATED - Do not create manually, use right-click command on .fml"
  .vcf: "AUTO-GENERATED - Do not create manually, use right-click command on .vml"
  .blk: "MULTIPLE def port allowed - hardware/software component definitions"
  .fun: "MULTIPLE def function/parameter allowed - behavioral specifications"
  .req: "MULTIPLE def requirement allowed - hierarchical requirements with traceability"
  .tst: "MULTIPLE def test allowed - validation test cases and procedures"
  .spr: "MULTIPLE def epic/story/task allowed - hierarchical project planning"
  .agt: "MULTIPLE def agent allowed - specialized AI agents"

# Core Language Rules - ACTUAL SYLANG SYNTAX
core_syntax:
  header_definition: "hdef <type> <identifier>"  # Only ONE per file
  symbol_definition: "def <type> <identifier> [optional_flags]"  # Multiple allowed except .ple/.vml
  property_statement: "<property> <value>"  # Properties indented under parent
  relation_statement: "<relation> ref <target> <identifier>"  # Cross-file references
  conditional_visibility: "when ref config <config_identifier>"  # Config-based graying
  import_statement: "use <type> <identifier>"  # Import external symbols
  
indentation_rules:
  - Use 2 spaces or tab per indentation level
  - Parent-child relationships through indentation
  - Properties and relations indented under their parent symbols

# Auto-Generation Commands
auto_generation_commands:
  .vml_from_fml: "Right-click .fml file → 'Generate VML from FML'"
  .vcf_from_vml: "Right-click .vml file → 'Generate VCF from VML'"
  note: "AI should NOT create .vml or .vcf files manually - instruct users to use these commands"

# Config-Based Feature Management  
config_system:
  - Config definitions: "def config <name> <0|1>" (in .vcf files)
  - Symbol visibility: "when ref config <config_name>" (in .fun/.blk/.req/.tst files)
  - Graying behavior: config=0 makes symbols gray and functionally unavailable
  - File restrictions: when ref config NOT allowed in .ple/.fml/.vml/.vcf files

# AI Development Guidelines
ai_instructions:
  file_creation:
    - Always start with appropriate use statements (except .ple)
    - Follow with single hdef statement  
    - Use only valid keywords for each file type
    - Follow indentation hierarchy (2 spaces or tab)
    - Use when ref config only in .fun/.blk/.req/.tst files
    - Reference valid symbols from imported files
    
  symbol_naming:
    - Use CamelCase for identifiers
    - Descriptive names reflecting purpose
    - Consistent naming across related files
    - Follow c_FeatureName pattern for configs
    
  validation_awareness:
    - .fml sibling consistency rules
    - .vml selection constraint rules  
    - Cross-file symbol resolution
    - Config-based graying behavior

last_updated: "${timestamp}"
generated_by: "Sylang VSCode Extension v${SYLANG_VERSION}"
`;
}
//# sourceMappingURL=new_sylangrules_method.js.map