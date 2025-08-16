# UCD Implementation Plan

## ✅ COMPLETED TASKS:
1. **Keywords & Specification** - Complete UCD keywords defined in `src/core/keywords.ts`
2. **Documentation** - Full UCD specification added to `NewSylang.md`  
3. **Syntax Highlighting** - Grammar file `syntaxes/sylang-ucd.tmLanguage.json` created
4. **Language Registration** - Added to `package.json` and `extension.ts`
5. **Command Manager Rules** - Updated with UCD keywords and validation rules

## 🔧 REMAINING IMPLEMENTATION TASKS:

### 1. UCD Validation Engine (`src/core/validationEngine.ts`)
**Priority: HIGH - Required for basic language support**

**Tasks:**
- Add UCD-specific validation rules for actor types
- Implement hierarchical `associated`/`includes` relationship validation
- Validate primary actors can have nested relationships
- Ensure secondary actors only associate with tail-end functions
- Cross-reference validation with imported function sets

**Implementation:**
```typescript
// Add to SylangValidationEngine class
private validateUCDSpecificRules(document: vscode.TextDocument, errors: ValidationError[]): void {
    // 1. Actor type validation (primary/secondary)
    // 2. Hierarchical relationship validation 
    // 3. Secondary actor constraints (tail-end only)
    // 4. Function reference validation
}
```

### 2. UCD Symbol Management (`src/core/symbolManager.ts`)
**Priority: HIGH - Required for cross-file references**

**Tasks:**
- Parse UCD files to extract actors and relationships
- Build hierarchical function relationship trees
- Handle `associated` vs `includes` relationship types
- Integrate with existing symbol resolution system

**Implementation:**
```typescript
// Add UCD parsing to parseFileContent method
case '.ucd':
    return this.parseUCDContent(content, fileUri);

private parseUCDContent(content: string, fileUri: vscode.Uri): SylangSymbol[] {
    // Parse actors, functions, and relationships
    // Build hierarchical relationship trees
}
```

### 3. UCD Webview Diagram Component
**Priority: MEDIUM - For visual diagram rendering**

**Structure:**
```
src/diagrams/webview/src/components/
├── UseCaseDiagram.tsx          # Main UCD component
├── common/
│   ├── ActorNode.tsx          # Actor visualization
│   ├── FunctionNode.tsx       # Function visualization  
│   └── RelationshipEdge.tsx   # Relationship lines (solid/dotted)
```

**Features:**
- Actor positioning (primary left, secondary right)
- Function hierarchy visualization
- Solid lines for `associated` relationships  
- Dotted lines for `includes` relationships
- Interactive zoom/pan capabilities

### 4. UCD Data Transformer (`src/diagrams/core/diagramDataTransformer.ts`)
**Priority: MEDIUM - Transform parsed data for rendering**

**Tasks:**
- Convert UCD symbols to diagram nodes/edges
- Calculate actor and function positions
- Determine relationship line types (solid/dotted)
- Handle hierarchical function layouts

### 5. UCD Layout Algorithm
**Priority: MEDIUM - Proper diagram layout**

**Algorithm Design:**
- **Primary actors**: Left side vertical arrangement
- **Secondary actors**: Right side vertical arrangement  
- **Functions**: Center area with hierarchical clustering
- **Relationships**: Bezier curves for clean connections
- **Collision avoidance**: Prevent node overlaps

### 6. Integration Testing
**Priority: LOW - Comprehensive testing**

**Test Cases:**
- UCD file parsing and validation
- Cross-file function references
- Diagram rendering with complex hierarchies
- Primary vs secondary actor constraints
- Mixed `associated`/`includes` relationships

## 🔄 DEVELOPMENT SEQUENCE:

### Phase 1: Core Language Support (Week 1)
1. ✅ Language registration and syntax highlighting  
2. 🔧 UCD validation engine implementation
3. 🔧 Symbol management integration

### Phase 2: Diagram Infrastructure (Week 2)  
4. 🔧 Data transformer for UCD diagrams
5. 🔧 Basic UCD webview component
6. 🔧 Actor and function node rendering

### Phase 3: Advanced Features (Week 3)
7. 🔧 Hierarchical relationship visualization
8. 🔧 Layout algorithm optimization
9. 🔧 Interactive diagram features

### Phase 4: Testing & Polish (Week 4)
10. 🔧 Comprehensive testing suite
11. 🔧 Performance optimization
12. 🔧 Documentation and examples

## 🎯 IMMEDIATE NEXT STEPS:

1. **Start UCD Validation Engine** - Add UCD validation rules to handle actor types and relationship hierarchies
2. **Test with Example File** - Use `AutomotiveHMI.ucd` to validate parser and validation
3. **Symbol Management** - Integrate UCD parsing into existing symbol system
4. **Basic Webview** - Create minimal UCD diagram renderer

## 🔗 ARCHITECTURE ADHERENCE:

- **Loosely Coupled**: UCD components separate from existing diagram types
- **Extensible**: Uses existing keyword/validation framework  
- **Performance**: Leverages existing caching and optimization
- **Maintainable**: Follows established patterns from other file types

This plan ensures systematic implementation while maintaining the existing codebase stability and following the established architectural patterns.
