// Sylang Keywords Management System
// This file defines all allowed keywords for each Sylang file extension
// Keywords are categorized by type for better validation and autocomplete

export enum KeywordType {
    HEADER_DEFINITION = 'header-definition',
    DEFINITION = 'definition',
    PROPERTY = 'property',
    RELATION = 'relation',
    REFERENCE = 'reference',
    DIRECTION = 'direction',
    ENUM = 'enum',
    OPTIONAL_FLAG = 'optional-flag',
    CONFIG = 'config'
}

export interface Keyword {
    name: string;
    type: KeywordType;
    description: string;
    required?: boolean;
    allowMultiple?: boolean;
    isExtension?: boolean;  // NEW: Mark extension keywords
    supportsMultiLine?: boolean;  // NEW: Support backslash line continuation
}

export interface FileTypeKeywords {
    fileExtension: string;
    displayName: string;
    allowedKeywords: Keyword[];
    requiredKeywords: string[];
    headerKeyword: string;
}

// Extensible enum values system
export interface EnumDefinition {
    name: string;
    values: string[];
    description: string;
    isExtension?: boolean;  // NEW: Mark extension enums
}

// Predefined enum values - EXTENSIBLE ARRAY as requested
export const SYLANG_ENUMS: EnumDefinition[] = [
    {
        name: 'safetylevel',
        values: ['ASIL-A', 'ASIL-B', 'ASIL-C', 'ASIL-D', 'QM', 'SIL-1', 'SIL-2', 'SIL-3', 'SIL-4'],
        description: 'Safety integrity levels for automotive and general systems'
    },
    {
        name: 'level',
        values: ['productline', 'system', 'subsystem', 'component', 'module', 'interface'],
        description: 'Hierarchical levels for system design and feature models'
    },
    {
        name: 'porttype',
        values: ['data', 'communication', 'power', 'mechanical', 'signal'],
        description: 'Types of ports for system interfaces'
    },
    {
        name: 'status',
        values: ['draft', 'review', 'approved', 'deprecated', 'implemented'],
        description: 'Status values for requirements and other artifacts'
    },
    {
        name: 'reqtype',
        values: ['functional', 'non-functional', 'system', 'software', 'hardware', 'interface', 'safety'],
        description: 'Types of requirements'
    },
    {
        name: 'testresult',
        values: ['pass', 'fail', 'intest', 'notrun', 'blocked'],
        description: 'Test execution results'
    },
    {
        name: 'method',
        values: ['MIL', 'SIL', 'PIL', 'HIL', 'VIL', 'manual', 'automated'],
        description: 'Testing methods and approaches'
    },
    {
        name: 'issuestatus',
        values: ['backlog', 'open', 'inprogress', 'blocked', 'canceled', 'done'],
        description: 'Issue status values for sprint tasks'
    },
    {
        name: 'priority',
        values: ['low', 'medium', 'high', 'critical'],
        description: 'Priority levels for sprint tasks'
    }
];

// .ple file keywords
const PLE_KEYWORDS: Keyword[] = [
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for product line', required: true },
    { name: 'productline', type: KeywordType.HEADER_DEFINITION, description: 'Product line identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', allowMultiple: false },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property', allowMultiple: false },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property', allowMultiple: false },
    { name: 'domain', type: KeywordType.PROPERTY, description: 'Domain property', allowMultiple: true },
    { name: 'compliance', type: KeywordType.PROPERTY, description: 'Compliance standards', allowMultiple: true },
    { name: 'firstrelease', type: KeywordType.PROPERTY, description: 'First release date', allowMultiple: false },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'region', type: KeywordType.PROPERTY, description: 'Target regions', allowMultiple: true }
];

// .fml file keywords
const FML_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for feature set', required: true },
    { name: 'featureset', type: KeywordType.HEADER_DEFINITION, description: 'Feature set identifier' },
    { name: 'listedfor', type: KeywordType.RELATION, description: 'Listed for relation' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', supportsMultiLine: true },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property', supportsMultiLine: true },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'feature', type: KeywordType.DEFINITION, description: 'Feature definition' },
    { name: 'mandatory', type: KeywordType.OPTIONAL_FLAG, description: 'Mandatory flag' },
    { name: 'optional', type: KeywordType.OPTIONAL_FLAG, description: 'Optional flag' },
    { name: 'or', type: KeywordType.OPTIONAL_FLAG, description: 'Or flag' },
    { name: 'alternative', type: KeywordType.OPTIONAL_FLAG, description: 'Alternative flag' },
    { name: 'requires', type: KeywordType.RELATION, description: 'Requires relation' },
    { name: 'excludes', type: KeywordType.RELATION, description: 'Excludes relation' },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'productline', type: KeywordType.REFERENCE, description: 'Product line reference' },
    { name: 'inherits', type: KeywordType.RELATION, description: 'Inherits relation' }
];

// .vml file keywords
const VML_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for variant set', required: true },
    { name: 'variantset', type: KeywordType.HEADER_DEFINITION, description: 'Variant set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', supportsMultiLine: true },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property', supportsMultiLine: true },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'feature', type: KeywordType.REFERENCE, description: 'Feature reference' },
    { name: 'extends', type: KeywordType.RELATION, description: 'Extends relation' },
    { name: 'mandatory', type: KeywordType.OPTIONAL_FLAG, description: 'Mandatory flag' },
    { name: 'optional', type: KeywordType.OPTIONAL_FLAG, description: 'Optional flag' },
    { name: 'or', type: KeywordType.OPTIONAL_FLAG, description: 'Or flag' },
    { name: 'alternative', type: KeywordType.OPTIONAL_FLAG, description: 'Alternative flag' },
    { name: 'selected', type: KeywordType.OPTIONAL_FLAG, description: 'Selected flag' },
    { name: 'featureset', type: KeywordType.REFERENCE, description: 'Feature set reference' },
    { name: 'inherits', type: KeywordType.RELATION, description: 'Inherits relation' }
];

// .vcf file keywords  
const VCF_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for config set', required: true },
    { name: 'configset', type: KeywordType.HEADER_DEFINITION, description: 'Config set identifier' },
    { name: 'generatedfrom', type: KeywordType.RELATION, description: 'Generated from relation' },
    { name: 'generatedat', type: KeywordType.PROPERTY, description: 'Generation timestamp' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', supportsMultiLine: true },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property', supportsMultiLine: true },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config definition' },
    { name: 'variantset', type: KeywordType.REFERENCE, description: 'Variant set reference' },
    { name: 'inherits', type: KeywordType.RELATION, description: 'Inherits relation' }
];

// .fun file keywords
const FUN_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for function set', required: true },
    { name: 'functionset', type: KeywordType.HEADER_DEFINITION, description: 'Function set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', supportsMultiLine: true },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property', supportsMultiLine: true },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'function', type: KeywordType.DEFINITION, description: 'Function definition' },
    { name: 'enables', type: KeywordType.RELATION, description: 'Enables relation' },
    { name: 'feature', type: KeywordType.REFERENCE, description: 'Feature reference' },
    { name: 'allocatedto', type: KeywordType.RELATION, description: 'Allocated to relation' },
    { name: 'block', type: KeywordType.REFERENCE, description: 'Block reference' },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' },
    { name: 'when', type: KeywordType.RELATION, description: 'When relation for conditional config references' },
    { name: 'featureset', type: KeywordType.REFERENCE, description: 'Feature set reference' },
    { name: 'configset', type: KeywordType.REFERENCE, description: 'Config set reference' }
];

// .req file keywords
const REQ_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for requirement set', required: true },
    { name: 'requirementset', type: KeywordType.HEADER_DEFINITION, description: 'Requirement set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', supportsMultiLine: true },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property', supportsMultiLine: true },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'requirement', type: KeywordType.DEFINITION, description: 'Requirement definition' },
    { name: 'refinedfrom', type: KeywordType.RELATION, description: 'Refined from relation' },
    { name: 'derivedfrom', type: KeywordType.RELATION, description: 'Derived from relation' },
    { name: 'implements', type: KeywordType.RELATION, description: 'Implements relation' },
    { name: 'function', type: KeywordType.REFERENCE, description: 'Function reference' },
    { name: 'allocatedto', type: KeywordType.RELATION, description: 'Allocated to relation' },
    { name: 'block', type: KeywordType.REFERENCE, description: 'Block reference' },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' },
    { name: 'when', type: KeywordType.RELATION, description: 'When relation for conditional config references' },
    { name: 'rationale', type: KeywordType.PROPERTY, description: 'Rationale property' },
    { name: 'verificationcriteria', type: KeywordType.PROPERTY, description: 'Verification criteria property' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'reqtype', type: KeywordType.ENUM, description: 'Requirement type enum' },
    { name: 'functiongroup', type: KeywordType.REFERENCE, description: 'Function group reference' },
    { name: 'configset', type: KeywordType.REFERENCE, description: 'Config set reference' }
];

// .tst file keywords
const TST_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for test set', required: true },
    { name: 'testset', type: KeywordType.HEADER_DEFINITION, description: 'Test set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', supportsMultiLine: true },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property', supportsMultiLine: true },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'testcase', type: KeywordType.DEFINITION, description: 'Test case definition' },
    { name: 'refinedfrom', type: KeywordType.RELATION, description: 'Refined from relation' },
    { name: 'derivedfrom', type: KeywordType.RELATION, description: 'Derived from relation' },
    { name: 'requirement', type: KeywordType.REFERENCE, description: 'Requirement reference' },
    { name: 'satisfies', type: KeywordType.RELATION, description: 'Satisfies relation' },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' },
    { name: 'when', type: KeywordType.RELATION, description: 'When relation for conditional config references' },
    { name: 'expected', type: KeywordType.PROPERTY, description: 'Expected result property', supportsMultiLine: true },
    { name: 'passcriteria', type: KeywordType.PROPERTY, description: 'Pass criteria property', supportsMultiLine: true },
    { name: 'testresult', type: KeywordType.ENUM, description: 'Test result enum' },
    { name: 'steps', type: KeywordType.PROPERTY, description: 'Test steps property (multi-line string)', supportsMultiLine: true },
    { name: 'method', type: KeywordType.ENUM, description: 'Test method enum' },
    { name: 'setup', type: KeywordType.PROPERTY, description: 'Test setup property', supportsMultiLine: true },
    { name: 'requirementset', type: KeywordType.REFERENCE, description: 'Requirement set reference' },
    { name: 'configset', type: KeywordType.REFERENCE, description: 'Config set reference' }
];

// .blk file keywords
const BLK_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for block', required: true },
    { name: 'block', type: KeywordType.HEADER_DEFINITION, description: 'Block identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', supportsMultiLine: true },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property', supportsMultiLine: true },
    { name: 'designrationale', type: KeywordType.PROPERTY, description: 'Design rationale property' },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'tags', type: KeywordType.PROPERTY, description: 'Tags property', allowMultiple: true },
    { name: 'level', type: KeywordType.ENUM, description: 'Hierarchical level enum' },
    { name: 'safetylevel', type: KeywordType.ENUM, description: 'Safety level enum' },
    { name: 'status', type: KeywordType.ENUM, description: 'Status enum' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'port', type: KeywordType.DEFINITION, description: 'Port definition' },
    { name: 'porttype', type: KeywordType.ENUM, description: 'Port type enum' },
    { name: 'composedof', type: KeywordType.RELATION, description: 'Composed of relation' },
    { name: 'enables', type: KeywordType.RELATION, description: 'Enables relation' },
    { name: 'needs', type: KeywordType.RELATION, description: 'Needs relation' },
    { name: 'feature', type: KeywordType.REFERENCE, description: 'Feature reference' },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'config', type: KeywordType.CONFIG, description: 'Config reference' },
    { name: 'when', type: KeywordType.RELATION, description: 'When relation for conditional config references' },
    { name: 'featureset', type: KeywordType.REFERENCE, description: 'Feature set reference' },
    { name: 'configset', type: KeywordType.REFERENCE, description: 'Config set reference' }
];

// .spr file keywords
const SPR_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'agentset', type: KeywordType.HEADER_DEFINITION, description: 'Agent set identifier for import' },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for sprint', required: true },
    { name: 'sprint', type: KeywordType.HEADER_DEFINITION, description: 'Sprint identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', supportsMultiLine: true },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property', supportsMultiLine: true },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'startdate', type: KeywordType.PROPERTY, description: 'Sprint start date' },
    { name: 'enddate', type: KeywordType.PROPERTY, description: 'Sprint end date' },
    { name: 'assignedto', type: KeywordType.RELATION, description: 'Assigned agent reference' },
    { name: 'ref', type: KeywordType.REFERENCE, description: 'Reference keyword' },
    { name: 'agent', type: KeywordType.REFERENCE, description: 'Agent reference' },
    { name: 'issuestatus', type: KeywordType.ENUM, description: 'Issue status enum (backlog, open, inprogress, blocked, canceled, done)' },
    { name: 'priority', type: KeywordType.ENUM, description: 'Priority enum (low, medium, high, critical)' },
    { name: 'points', type: KeywordType.PROPERTY, description: 'Story points for estimation' },
    { name: 'outputfile', type: KeywordType.PROPERTY, description: 'Expected output file from task' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'epic', type: KeywordType.DEFINITION, description: 'Epic definition' },
    { name: 'story', type: KeywordType.DEFINITION, description: 'Story definition' },
    { name: 'task', type: KeywordType.DEFINITION, description: 'Task definition' }
];

// .agt file keywords
const AGT_KEYWORDS: Keyword[] = [
    { name: 'use', type: KeywordType.REFERENCE, description: 'Import statement', allowMultiple: true },
    { name: 'hdef', type: KeywordType.HEADER_DEFINITION, description: 'Header definition for agent set', required: true },
    { name: 'agentset', type: KeywordType.HEADER_DEFINITION, description: 'Agent set identifier' },
    { name: 'name', type: KeywordType.PROPERTY, description: 'Name property', supportsMultiLine: true },
    { name: 'description', type: KeywordType.PROPERTY, description: 'Description property', supportsMultiLine: true },
    { name: 'owner', type: KeywordType.PROPERTY, description: 'Owner property' },
    { name: 'def', type: KeywordType.DEFINITION, description: 'Definition keyword', allowMultiple: true },
    { name: 'agent', type: KeywordType.DEFINITION, description: 'Agent definition' },
    { name: 'role', type: KeywordType.PROPERTY, description: 'Agent role property' },
    { name: 'specialization', type: KeywordType.PROPERTY, description: 'Agent specialization property' },
    { name: 'expertise', type: KeywordType.PROPERTY, description: 'Agent expertise property', allowMultiple: true },
    { name: 'context', type: KeywordType.PROPERTY, description: 'Agent context property', allowMultiple: true }
];

// File type definitions - EXTENSIBLE ARRAY as requested
export const SYLANG_FILE_TYPES: FileTypeKeywords[] = [
    {
        fileExtension: '.ple',
        displayName: 'Product Line',
        allowedKeywords: PLE_KEYWORDS,
        requiredKeywords: ['hdef', 'productline'],
        headerKeyword: 'productline'
    },
    {
        fileExtension: '.fml',
        displayName: 'Feature Model',
        allowedKeywords: FML_KEYWORDS,
        requiredKeywords: ['hdef', 'featureset'],
        headerKeyword: 'featureset'
    },
    {
        fileExtension: '.vml',
        displayName: 'Variant Model',
        allowedKeywords: VML_KEYWORDS,
        requiredKeywords: ['hdef', 'variantset'],
        headerKeyword: 'variantset'
    },
    {
        fileExtension: '.vcf',
        displayName: 'Variant Config',
        allowedKeywords: VCF_KEYWORDS,
        requiredKeywords: ['hdef', 'configset'],
        headerKeyword: 'configset'
    },
    {
        fileExtension: '.fun',
        displayName: 'Function Group',
        allowedKeywords: FUN_KEYWORDS,
        requiredKeywords: ['hdef', 'functionset'],
        headerKeyword: 'functionset'
    },
    {
        fileExtension: '.req',
        displayName: 'Requirements',
        allowedKeywords: REQ_KEYWORDS,
            requiredKeywords: ['hdef', 'requirementset'],
    headerKeyword: 'requirementset'
    },
    {
        fileExtension: '.tst',
        displayName: 'Test Suite',
        allowedKeywords: TST_KEYWORDS,
        requiredKeywords: ['hdef', 'testset'],
        headerKeyword: 'testset'
    },
    {
        fileExtension: '.blk',
        displayName: 'Block',
        allowedKeywords: BLK_KEYWORDS,
        requiredKeywords: ['hdef', 'block'],
        headerKeyword: 'block'
    },
    {
        fileExtension: '.spr',
        displayName: 'Sprint',
        allowedKeywords: SPR_KEYWORDS,
        requiredKeywords: ['hdef', 'sprint'],
        headerKeyword: 'sprint'
    },
    {
        fileExtension: '.agt',
        displayName: 'Agent',
        allowedKeywords: AGT_KEYWORDS,
        requiredKeywords: ['hdef', 'agentset'],
        headerKeyword: 'agentset'
    }
];

// Forward declaration for extension manager
export interface ISylangExtensionManager {
    extendKeywords(baseKeywords: Keyword[], fileType: string): Keyword[];
    getExtendedEnums(baseEnums: EnumDefinition[], fileType: string): EnumDefinition[];
    hasExtensions(): boolean;
    getPropertyCardinality?(propertyName: string, fileType: string): 'single' | 'multiple' | null;
    getRelationCardinality?(relationName: string, targetType: string, fileType: string): 'single' | 'multiple' | null;
}

// Utility functions for keyword management  
export class SylangKeywordManager {
    
    static getFileTypeKeywords(fileExtension: string): FileTypeKeywords | undefined {
        return SYLANG_FILE_TYPES.find(ft => ft.fileExtension === fileExtension);
    }

    /**
     * Get keywords for file type with optional extension support (NON-BREAKING)
     */
    static getKeywordsForFileType(fileExtension: string, extensionManager?: ISylangExtensionManager): Keyword[] {
        const fileType = this.getFileTypeKeywords(fileExtension);
        const baseKeywords = fileType ? fileType.allowedKeywords : [];
        
        // NEW: Check if extension manager has a new file type definition
        if (extensionManager && extensionManager.hasExtensions()) {
            const extendedKeywords = extensionManager.extendKeywords(baseKeywords, fileExtension);
            // If this returned keywords when baseKeywords was empty, it's a new file type
            if (extendedKeywords.length > 0) {
                return extendedKeywords;
            }
        }
        
        return baseKeywords; // Fallback to existing behavior
    }

    /**
     * Get enums for file type with optional extension support (NON-BREAKING)
     */
    static getEnumsForFileType(fileExtension: string, extensionManager?: ISylangExtensionManager): EnumDefinition[] {
        // Get base enums (all enums for all file types for now)
        const baseEnums = SYLANG_ENUMS;
        
        // Extend with custom enums if extension manager provided
        if (extensionManager && extensionManager.hasExtensions()) {
            return extensionManager.getExtendedEnums(baseEnums, fileExtension);
        }
        
        return baseEnums; // Fallback to existing behavior
    }
    
    static isKeywordAllowed(fileExtension: string, keyword: string, extensionManager?: ISylangExtensionManager): boolean {
        const allKeywords = this.getKeywordsForFileType(fileExtension, extensionManager);
        return allKeywords.some(k => k.name === keyword);
    }
    
    static getKeywordType(fileExtension: string, keyword: string, extensionManager?: ISylangExtensionManager): KeywordType | null {
        // NEW: Get all keywords including extensions
        const allKeywords = this.getKeywordsForFileType(fileExtension, extensionManager);
        
        if (allKeywords.length === 0) {
            // Log for debugging
            console.log(`[KEYWORD MANAGER v${require('./version').SYLANG_VERSION}] No keywords found for extension: ${fileExtension}`);
            return null;
        }

        const keywordDef = allKeywords.find(k => k.name === keyword);
        if (!keywordDef) {
            // Log for debugging - especially for assignedto
            if (keyword === 'assignedto') {
                console.log(`[KEYWORD MANAGER v${require('./version').SYLANG_VERSION}] ❌ ASSIGNEDTO NOT FOUND in ${fileExtension}!`);
                console.log(`[KEYWORD MANAGER v${require('./version').SYLANG_VERSION}] Available keywords:`, allKeywords.map(k => k.name));
            }
            return null;
        }

        // Log successful assignedto detection
        if (keyword === 'assignedto') {
            console.log(`[KEYWORD MANAGER v${require('./version').SYLANG_VERSION}] ✅ ASSIGNEDTO FOUND in ${fileExtension} as type: ${keywordDef.type}`);
        }

        return keywordDef.type;
    }
    
    static getEnumValues(enumName: string): string[] {
        const enumDef = SYLANG_ENUMS.find(e => e.name === enumName);
        return enumDef?.values || [];
    }
    
    static getAllowedKeywords(fileExtension: string, extensionManager?: ISylangExtensionManager): string[] {
        const allKeywords = this.getKeywordsForFileType(fileExtension, extensionManager);
        return allKeywords.map(k => k.name);
    }
    
    static getRequiredKeywords(fileExtension: string): string[] {
        const fileType = this.getFileTypeKeywords(fileExtension);
        return fileType?.requiredKeywords || [];
    }
    
    static supportsMultiLineString(fileExtension: string, keyword: string): boolean {
        const fileTypeKeywords = this.getFileTypeKeywords(fileExtension);
        if (!fileTypeKeywords) return false;
        
        const keywordDef = fileTypeKeywords.allowedKeywords.find(k => k.name === keyword);
        return keywordDef?.supportsMultiLine || false;
    }
} 