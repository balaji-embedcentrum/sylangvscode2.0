import * as vscode from 'vscode';

/**
 * Represents a single item in the docview table
 */
export interface DocViewItem {
    /** Unique identifier (from def statement) */
    identifier: string;
    /** Human-readable name */
    name?: string;
    /** Description of the item */
    description?: string;
    /** File type (.req, .tst, .fml, .fun) */
    fileType: string;
    /** Source file URI */
    fileUri: vscode.Uri;
    /** Line number in source file */
    line: number;
    /** All properties as key-value pairs */
    properties: Map<string, string[]>;
    /** For test cases - special handling of steps */
    steps?: string;
    /** Symbol kind (requirement, testcase, feature, function, etc.) */
    kind: string;
    /** Parent identifier if hierarchical */
    parentId?: string;
    /** Children identifiers for hierarchical display */
    children: string[];
}

/**
 * Supported file types for docview
 */
export type DocViewFileType = '.req' | '.tst' | '.fml' | '.fun';

/**
 * Data structure for docview webview
 */
export interface DocViewData {
    /** File type being displayed */
    fileType: DocViewFileType;
    /** Display name for the file type */
    displayName: string;
    /** Array of all items to display */
    items: DocViewItem[];
    /** Header symbol information */
    headerSymbol?: {
        identifier: string;
        name?: string;
        description?: string;
        properties: Record<string, string[]>;
    };
    /** Source file path */
    sourceFile: string;
    /** Timestamp of data generation */
    timestamp: string;
}

/**
 * Message types for webview communication
 */
export interface DocViewMessage {
    type: 'selectItem' | 'openSource' | 'refresh';
    data?: any;
}

/**
 * WebView message for item selection
 */
export interface ItemSelectionMessage extends DocViewMessage {
    type: 'selectItem';
    data: {
        identifier: string;
    };
}

/**
 * WebView message for opening source file
 */
export interface OpenSourceMessage extends DocViewMessage {
    type: 'openSource';
    data: {
        fileUri: string;
        line: number;
    };
}
