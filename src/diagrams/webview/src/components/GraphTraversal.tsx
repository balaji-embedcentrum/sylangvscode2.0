import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GraphTraversalData, GraphNode, GraphEdge } from '../../types/diagramTypes';
import { WebviewLogger } from '../utils/logger';

interface GraphTraversalProps {
  data: GraphTraversalData;
}

// PERFORMANCE CONFIG - Static layout only
const RENDERING_CONFIG = {
  USE_STATIC_LAYOUT: true,        // Static layout for performance
  DEBUG_PERFORMANCE: true         // Set to true for performance logging
};

export function GraphTraversal({ data }: GraphTraversalProps) {
  WebviewLogger.info(`GRAPH TRAVERSAL - Component rendering: ${data?.nodes?.length || 0} nodes, ${data?.edges?.length || 0} edges, Mode: Static`);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [containerReady, setContainerReady] = useState(false);
  const [showLegend, setShowLegend] = useState(false); // Hidden by default
  const [showParentOf, setShowParentOf] = useState<boolean>(false);
  const [showChildOf, setShowChildOf] = useState<boolean>(true);
  const [nodePositions, setNodePositions] = useState<Map<string, {x: number, y: number}>>(new Map());
  
  // Unified pan/zoom state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Early return if no data
  if (!data || !data.nodes || data.nodes.length === 0) {
    WebviewLogger.warn('GRAPH TRAVERSAL - No data available, showing fallback');
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '16px',
        color: '#666'
      }}>
        <div>
          <h3>Graph Traversal View</h3>
          <p>No graph data available</p>
          <p>Data received: {JSON.stringify({
            hasData: !!data,
            nodeCount: data?.nodes?.length || 0,
            edgeCount: data?.edges?.length || 0
          })}</p>
        </div>
      </div>
    );
  }

  WebviewLogger.info('GRAPH TRAVERSAL - Data available, proceeding with render');

  // Helper functions
  const getNodeColor = (node: GraphNode): string => {
    // Debug: Log what we're actually getting
    WebviewLogger.debug(`GRAPH TRAVERSAL - Node type debug: ${node.name}, type: ${node.type}, file: ${node.fileUri}`);

    // Simplified color scheme as requested
    const symbolTypeColors: { [key: string]: string } = {
      // Organizational types - all Orange
      'productline': '#FF6B35',    // Orange - Root
      'featureset': '#FF6B35',     // Orange - Feature organization
      'functionset': '#FF6B35',    // Orange - Function organization  
      'reqset': '#FF6B35',         // Orange - Requirement organization
      'testset': '#FF6B35',        // Orange - Test organization
      'variantset': '#FF6B35',     // Orange - Variant organization
      'configset': '#FF6B35',      // Orange - Configuration organization
      
      // Individual item types - distinct colors as requested
      'feature': '#1E88E5',        // Blue - Features  
      'function': '#EC4899',       // Pink - Functions
      'block': '#00B894',          // Teal - System blocks
      'requirement': '#7CB342',    // Green - Requirements
      'testcase': '#5E35B1',       // Purple - Test cases
      'config': '#822659',         // Ruby - Configuration items
      'port': '#FFD700',           // Gold - Ports
      'unknown': '#6B7280'         // Gray - Unknown types
    };
    
    // Try multiple ways to get the symbol type
    let symbolKind = node.type || 'unknown';
    const fileExt = node.fileUri ? node.fileUri.split('.').pop() || '' : '';
    const nodeName = node.name ? node.name.toLowerCase() : '';
    
    // If the type doesn't match our colors, try inferring from file extension and name
    if (!symbolTypeColors[symbolKind]) {
      // CONFIG FIRST: Check for c_ prefix BEFORE anything else
      if (nodeName.startsWith('c_') || fileExt === 'vcf') {
        symbolKind = 'config'; // All c_ configs are Ruby
      } else if (nodeName.includes('productline') || fileExt === 'ple') {
        symbolKind = 'productline';
      } else if (nodeName.includes('featureset') || nodeName.includes('features') || nodeName.endsWith('features')) {
        symbolKind = 'featureset'; // Organizational feature containers
      } else if (nodeName.includes('feature') || fileExt === 'fml') {
        symbolKind = 'feature'; // Individual features (most .fml nodes are features, not featuresets)
      } else if (nodeName.includes('functionset') || nodeName.includes('functions')) {
        symbolKind = 'functionset';
      } else if (nodeName.includes('function')) {
        symbolKind = 'function';
      } else if (nodeName.includes('block') || fileExt === 'blk') {
        symbolKind = 'block';
      } else if (nodeName.includes('reqset') || nodeName.includes('requirements')) {
        symbolKind = 'reqset';
      } else if (nodeName.includes('req_') || nodeName.includes('requirement') || fileExt === 'req') {
        symbolKind = 'requirement';
      } else if (nodeName.includes('testset') || nodeName.includes('tests')) {
        symbolKind = 'testset';
      } else if (nodeName.includes('testcase') || nodeName.includes('tc_') || fileExt === 'tst') {
        symbolKind = 'testcase';
      } else if (nodeName.includes('config')) {
        symbolKind = 'config';
      } else if (nodeName.includes('variantset')) {
        symbolKind = 'variantset';
      } else if (nodeName.includes('configset')) {
        symbolKind = 'configset';
      } else {
        // Use file extension as fallback - but prioritize config detection
        if (fileExt === 'vcf') {
          symbolKind = 'config';
        } else {
          const extColors: { [key: string]: string } = {
            'ple': '#FF6B35',    // Product Line
            'fml': '#FFD700',    // Feature Model (Gold)
            'vml': '#F97316',    // Variant Model
            'fun': '#00B894',    // Functions (Teal)
            'blk': '#EC4899',    // Blocks
            'req': '#7CB342',    // Requirements (Light Green)
            'tst': '#5E35B1',    // Tests (Deep Purple)
          };
          return extColors[fileExt] || symbolTypeColors['unknown'];
        }
      }
    }
    
    WebviewLogger.debug(`GRAPH TRAVERSAL - Node: ${node.name}, File: ${fileExt}, Detected: ${symbolKind}, Color: ${symbolTypeColors[symbolKind]}`);
    return symbolTypeColors[symbolKind] || symbolTypeColors['unknown'];
  };

  // Helper function to get hierarchy level for symbol types
  const getHierarchyLevel = (symbolType: string): number => {
    const levelMap: { [key: string]: number } = {
      'productline': 0,
      'featureset': 1,
      'feature': 2,
      'functionset': 3,
      'function': 4,        // ← This ensures functions get level 4
      'reqset': 5,
      'requirement': 6,
      'testset': 7,
      'testcase': 8,
      'block': 9,
      'variantset': 10,
      'configset': 11,
      'config': 12
    };
    return levelMap[symbolType] ?? 99; // Unknown types go to bottom
  };

  // Helper function to get node symbol type for hierarchy
  const getNodeSymbolType = (node: GraphNode): string => {
    // Use the same logic as getNodeColor but return just the symbol type
    let symbolKind = node.type || 'unknown';
    const fileExt = node.fileUri ? node.fileUri.split('.').pop() || '' : '';
    const nodeName = node.name ? node.name.toLowerCase() : '';
    
    // If the type doesn't match our hierarchy, try inferring from file extension and name
    const hierarchyTypes = ['productline', 'featureset', 'feature', 'functionset', 'function', 'block', 'reqset', 'requirement', 'testset', 'testcase', 'config', 'variantset', 'configset'];
    
    if (!hierarchyTypes.includes(symbolKind)) {
      // CONFIG FIRST: Check for c_ prefix BEFORE anything else
      if (nodeName.startsWith('c_') || fileExt === 'vcf') {
        symbolKind = 'config'; // All c_ configs are Ruby
      } else if (nodeName.includes('productline') || fileExt === 'ple') {
        symbolKind = 'productline';
      } else if (nodeName.includes('featureset') || nodeName.includes('features') || nodeName.endsWith('features')) {
        symbolKind = 'featureset'; // Organizational feature containers
      } else if (nodeName.includes('feature') || fileExt === 'fml') {
        symbolKind = 'feature'; // Individual features (most .fml nodes are features, not featuresets)
      } else if (nodeName.includes('functionset') || nodeName.includes('functions')) {
        symbolKind = 'functionset';
      } else if (nodeName.includes('function') || fileExt === 'fun') {
        symbolKind = 'function';
      } else if (nodeName.includes('block') || fileExt === 'blk') {
        symbolKind = 'block';
      } else if (nodeName.includes('reqset') || nodeName.includes('requirements')) {
        symbolKind = 'reqset';
      } else if (nodeName.includes('req_') || nodeName.includes('requirement') || fileExt === 'req') {
        symbolKind = 'requirement';
      } else if (nodeName.includes('testset') || nodeName.includes('tests')) {
        symbolKind = 'testset';
      } else if (nodeName.includes('testcase') || nodeName.includes('tc_') || fileExt === 'tst') {
        symbolKind = 'testcase';
      } else if (nodeName.includes('config')) {
        symbolKind = 'config';
      } else if (nodeName.includes('variantset')) {
        symbolKind = 'variantset';
      } else if (nodeName.includes('configset')) {
        symbolKind = 'configset';
      }
    }
    
    return symbolKind;
  };

  const getEdgeColor = (edge: any): string => {
    // Color edges by relationship type for better understanding
    const relationColors: { [key: string]: string } = {
      // Structural relationships
      'parentof': '#4B5563',       // Dark Gray - Hierarchical
      'childof': '#6B7280',        // Gray - Hierarchical reverse
      'listedfor': '#7C3AED',      // Purple - FeatureSet to ProductLine
      'composedof': '#DC2626',     // Red - Block composition
      
      // Functional relationships
      'enables': '#059669',        // Green - Function enables feature
      'implements': '#0D9488',     // Teal - Function implements
      'allocatedto': '#7C2D12',    // Brown - Allocated to block
      'needs': '#BE185D',          // Pink - Port dependencies
      
      // Requirement relationships
      'satisfies': '#2563EB',      // Blue - Test satisfies requirement
      'derivedfrom': '#1D4ED8',    // Dark Blue - Requirement derivation
      'refinedfrom': '#3730A3',    // Indigo - Requirement refinement
      'traces': '#5B21B6',         // Purple - Traceability
      
      // Feature relationships
      'requires': '#EA580C',       // Orange - Feature requires
      'excludes': '#DC2626',       // Red - Feature excludes
      'extends': '#059669',        // Green - Feature extends
      
      // Configuration relationships
      'generatedfrom': '#7C3AED',  // Purple - Generated from variant
      'when': '#F59E0B',           // Amber - Configuration condition
      
      // Default
      'ref': '#6B7280',            // Gray - Generic reference
      'unknown': '#9CA3AF'         // Light Gray - Unknown
    };
    
    const relationType = edge.relationType || edge.type || 'unknown';
    return relationColors[relationType] || relationColors['unknown'];
  };

  // Filter nodes based on search and exclude .spr/.agt files (not relevant for traceability)
  const filteredNodes = useMemo(() => {
    WebviewLogger.debug('GRAPH TRAVERSAL - Filtering nodes');
    WebviewLogger.debug(`GRAPH TRAVERSAL - Total nodes: ${data.nodes.length}`);
    
    // DEBUG: Log all node file extensions before filtering
    const fileExtCounts = {};
    data.nodes.forEach(node => {
      const fileExt = node.fileUri ? node.fileUri.split('.').pop() || 'unknown' : 'no-uri';
      fileExtCounts[fileExt] = (fileExtCounts[fileExt] || 0) + 1;
    });
    WebviewLogger.info(`GRAPH TRAVERSAL - DEBUG: Node file extensions: ${JSON.stringify(fileExtCounts)}`);
    
    // Filter out .spr and .agt files - not relevant for traceability
    let nodes = data.nodes.filter(node => {
      const fileExt = node.fileUri ? node.fileUri.split('.').pop() || '' : '';
      const shouldInclude = fileExt !== 'spr' && fileExt !== 'agt';
      
      // DEBUG: Track if function nodes are being filtered out
      if (!shouldInclude && (node.name.includes('ValidateTextInput') || node.name.includes('EncryptText') || node.name.includes('Function'))) {
        WebviewLogger.warn(`GRAPH TRAVERSAL - DEBUG: FILTERED OUT function node: ${node.name} (${fileExt} file)`);
      }
      
      // DEBUG: Track function nodes that pass the filter
      if (shouldInclude && (node.name.includes('ValidateTextInput') || node.name.includes('EncryptText') || node.name.includes('Function'))) {
        WebviewLogger.info(`GRAPH TRAVERSAL - DEBUG: INCLUDED function node: ${node.name} (${fileExt} file)`);
      }
      
      return shouldInclude;
    });
    
    WebviewLogger.info(`GRAPH TRAVERSAL - DEBUG: After file extension filter: ${nodes.length} nodes (removed ${data.nodes.length - nodes.length})`);
    
    // DEBUG: Log file extensions of remaining nodes
    const remainingExtCounts = {};
    nodes.forEach(node => {
      const fileExt = node.fileUri ? node.fileUri.split('.').pop() || 'unknown' : 'no-uri';
      remainingExtCounts[fileExt] = (remainingExtCounts[fileExt] || 0) + 1;
    });
    WebviewLogger.info(`GRAPH TRAVERSAL - DEBUG: Remaining node file extensions: ${JSON.stringify(remainingExtCounts)}`);
    
    if (!searchTerm) {
      WebviewLogger.debug('GRAPH TRAVERSAL - No search term, showing all nodes (excluding .spr/.agt)');
      return nodes;
    }
    
    const filtered = nodes.filter(node => 
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.fileUri.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    WebviewLogger.debug(`GRAPH TRAVERSAL - Filtered nodes: ${filtered.length}`);
    return filtered;
  }, [data.nodes, searchTerm]);

  // Filter edges based on filtered nodes and relationship type filters
  const filteredEdges = useMemo(() => {
    WebviewLogger.debug('GRAPH TRAVERSAL - Filtering edges');
    WebviewLogger.debug(`GRAPH TRAVERSAL - Total edges: ${data.edges.length}`);
    WebviewLogger.debug(`GRAPH TRAVERSAL - Filter settings: parentof=${showParentOf}, childof=${showChildOf}`);
    
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filtered = data.edges.filter(edge => {
      // Apply relationship type filters
      const relationType = edge.type || edge.relationType || '';
      if (relationType === 'parentof' && !showParentOf) {
        return false;
      }
      if (relationType === 'childof' && !showChildOf) {
        return false;
      }
      
      // Only include edges where both nodes are in filtered set
      return nodeIds.has(edge.source) && nodeIds.has(edge.target);
    });
    
    WebviewLogger.debug(`GRAPH TRAVERSAL - Filtered edges: ${filtered.length} (after relationship filters)`);
    
    // Debug: Log relationship types in filtered edges
    const relationshipCounts = {};
    filtered.forEach(edge => {
      const relType = edge.type || edge.relationType || 'unknown';
      relationshipCounts[relType] = (relationshipCounts[relType] || 0) + 1;
    });
    WebviewLogger.debug(`GRAPH TRAVERSAL - Relationship distribution:`, relationshipCounts);
    
    // DEBUG: Specifically track implements edges
    const implementsCount = relationshipCounts['implements'] || 0;
    if (implementsCount > 0) {
      WebviewLogger.info(`GRAPH TRAVERSAL - DEBUG: Found ${implementsCount} 'implements' edges in filtered results ✅`);
    } else {
      WebviewLogger.warn(`GRAPH TRAVERSAL - DEBUG: NO 'implements' edges found in filtered results ❌`);
      // Log all available edge types for debugging
      WebviewLogger.warn(`GRAPH TRAVERSAL - DEBUG: Available edge types: ${Object.keys(relationshipCounts).join(', ')}`);
    }
    
    return filtered;
  }, [data.edges, filteredNodes, showParentOf, showChildOf]);

  // Helper function to get directional impact chain (upstream dependencies + downstream impacts)
  const getRelatedNodes = useCallback((nodeId: string | null): Set<string> => {
    try {
      const allRelatedNodes = new Set<string>();
      if (!nodeId || !filteredEdges) {
        WebviewLogger.debug(`getRelatedNodes: No nodeId or edges, returning empty set`);
        return allRelatedNodes;
      }

      // Build directional adjacency lists with edge metadata
      const outgoingEdges = new Map<string, {target: string, relationshipType: string}[]>(); // source -> [{target, type}] (downstream)
      const incomingEdges = new Map<string, {source: string, relationshipType: string}[]>(); // target -> [{source, type}] (upstream)
      
      filteredEdges.forEach(edge => {
        if (typeof edge.source === 'string' && typeof edge.target === 'string') {
          const relationshipType = edge.relationshipType || 'unknown';
          
          // Outgoing edges (what this node impacts)
          if (!outgoingEdges.has(edge.source)) outgoingEdges.set(edge.source, []);
          outgoingEdges.get(edge.source)!.push({ target: edge.target, relationshipType });
          
          // Incoming edges (what impacts this node)
          if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, []);
          incomingEdges.get(edge.target)!.push({ source: edge.source, relationshipType });
        }
      });

      // Helper function to check if a node is a "set" node (organizational container)
      const isSetNode = (nodeId: string): boolean => {
        const node = filteredNodes.find(n => n.id === nodeId);
        if (!node) return false;
        const symbolType = getNodeSymbolType(node);
        
        // List of all set types to filter
        const setTypes = ['featureset', 'functionset', 'reqset', 'requirementset', 'testset', 'configset', 'variantset'];
        const isSet = setTypes.includes(symbolType);
        
        WebviewLogger.debug(`isSetNode check: ${nodeId} -> symbolType: ${symbolType}, isSet: ${isSet}`);
        return isSet;
      };

      // Helper function to check if traversal should stop at a set node
      const shouldStopAtSetNode = (nodeId: string, relationshipType: string): boolean => {
        if (!isSetNode(nodeId)) return false;
        
        const node = filteredNodes.find(n => n.id === nodeId);
        if (!node) return true; // Stop if node not found
        
        const symbolType = getNodeSymbolType(node);
        
        // Exception: Allow featureset -> productline via 'listedfor' relationship
        if (symbolType === 'featureset' && relationshipType === 'listedfor') {
          return false; // Don't stop, allow traversal
        }
        
        // Stop at all other set nodes
        return true;
      };

      // Recursive traversal for UPSTREAM chain (dependencies)
      const visitedUpstream = new Set<string>();
      const traverseUpstream = (currentNodeId: string) => {
        if (visitedUpstream.has(currentNodeId)) return;
        visitedUpstream.add(currentNodeId);
        allRelatedNodes.add(currentNodeId);
        
        // Follow incoming edges (what depends on the current node)
        const upstreamConnections = incomingEdges.get(currentNodeId) || [];
        upstreamConnections.forEach(connection => {
          const upstreamNodeId = connection.source;
          const relationshipType = connection.relationshipType;
          
          // Check if we should stop at this set node
          if (shouldStopAtSetNode(upstreamNodeId, relationshipType)) {
            WebviewLogger.debug(`✋ STOPPED upstream traversal at set node: ${upstreamNodeId} (${relationshipType})`);
            return; // Stop traversal at this set node
          }
          
          WebviewLogger.debug(`✅ Continuing upstream traversal to: ${upstreamNodeId} (${relationshipType})`);
          
          if (!visitedUpstream.has(upstreamNodeId)) {
            traverseUpstream(upstreamNodeId);
          }
        });
      };

      // Recursive traversal for DOWNSTREAM chain (impacts)
      const visitedDownstream = new Set<string>();
      const traverseDownstream = (currentNodeId: string) => {
        if (visitedDownstream.has(currentNodeId)) return;
        visitedDownstream.add(currentNodeId);
        allRelatedNodes.add(currentNodeId);
        
        // Follow outgoing edges (what the current node impacts)
        const downstreamConnections = outgoingEdges.get(currentNodeId) || [];
        downstreamConnections.forEach(connection => {
          const downstreamNodeId = connection.target;
          const relationshipType = connection.relationshipType;
          
          // Check if we should stop at this set node
          if (shouldStopAtSetNode(downstreamNodeId, relationshipType)) {
            WebviewLogger.debug(`✋ STOPPED downstream traversal at set node: ${downstreamNodeId} (${relationshipType})`);
            return; // Stop traversal at this set node
          }
          
          WebviewLogger.debug(`✅ Continuing downstream traversal to: ${downstreamNodeId} (${relationshipType})`);
          
          if (!visitedDownstream.has(downstreamNodeId)) {
            traverseDownstream(downstreamNodeId);
          }
        });
      };

      // Start traversals from the selected node
      traverseUpstream(nodeId);   // Get dependency chain (what feeds into this)
      traverseDownstream(nodeId); // Get impact chain (what this affects)
      
      // Remove the original node from related nodes (it gets special coloring)
      allRelatedNodes.delete(nodeId);

      const upstreamCount = visitedUpstream.size - 1; // -1 for the original node
      const downstreamCount = visitedDownstream.size - 1; // -1 for the original node
      WebviewLogger.debug(`getRelatedNodes: Found directional impact chain - ${upstreamCount} upstream, ${downstreamCount} downstream, total ${allRelatedNodes.size} for ${nodeId}`);
      
      return allRelatedNodes;
    } catch (e) {
      WebviewLogger.error(`getRelatedNodes error: ${e.message}`);
      return new Set<string>();
    }
  }, [filteredEdges]);

  // Compute dynamic levels and positions based on graph structure
  const calculateNodePositions = useCallback((nodes: GraphNode[], edges: GraphEdge[], containerWidth: number, containerHeight: number) => {
    const positions = new Map<string, {x: number, y: number}>();
    
    // Build graph adjacency list (outgoing edges)
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    nodes.forEach(node => {
      adjList.set(node.id, []);
      inDegree.set(node.id, 0);
    });
    edges.forEach(edge => {
      adjList.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    // Find root (productline, assuming single root)
    let rootId = nodes.find(n => getNodeSymbolType(n) === 'productline')?.id;
    if (!rootId) {
      rootId = nodes.find(n => inDegree.get(n.id) === 0)?.id; // Fallback to any root
    }
    if (!rootId) return positions; // No root

    // BFS to assign levels
    const levels = new Map<string, number>();
    const queue: string[] = [rootId];
    levels.set(rootId, 0);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levels.get(current)!;
      adjList.get(current)?.forEach(child => {
        const childLevel = levels.get(child);
        if (childLevel === undefined || childLevel < currentLevel + 1) {
          levels.set(child, currentLevel + 1);
        }
        queue.push(child);
      });
    }

    // Group nodes by level
    const nodesByLevel: Map<number, GraphNode[]> = new Map();
    nodes.forEach(node => {
      const level = levels.get(node.id) ?? getHierarchyLevel(getNodeSymbolType(node));
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(node);
    });

    // Define hierarchy order (top to bottom) and columns
    const hierarchyOrder = [
      'productline',     // Level 0: Top
      'featureset',      // Level 1
      'feature',         // Level 2
      'functionset',     // Level 3
      'function',        // Level 4
      'reqset',          // Level 5 (requirementset)
      'requirement',     // Level 6
      'testset',         // Level 7
      'testcase',        // Level 8
      'block'            // Level 9
    ];

    // Side column types (variants/configs)
    const sideColumnTypes = ['variantset', 'configset', 'config'];
    
    // Group nodes by symbol type
    const nodesByType: Map<string, GraphNode[]> = new Map();
    nodes.forEach(node => {
      const symbolType = getNodeSymbolType(node);
      
      // DEBUG: Track function nodes specifically
      if (node.name.includes('ValidateTextInput') || node.name.includes('EncryptText') || symbolType === 'function') {
        WebviewLogger.warn(`POSITION CALC - Function node: ${node.name}, symbolType: ${symbolType}, level from BFS: ${levels.get(node.id)}, fallback level: ${getHierarchyLevel(symbolType)}`);
      }
      
      if (!nodesByType.has(symbolType)) {
        nodesByType.set(symbolType, []);
      }
      nodesByType.get(symbolType)!.push(node);
    });

    // Layout configuration
    const verticalSpacing = 120;  // Vertical spacing between hierarchy levels
    const horizontalSpacing = 200; // Horizontal spacing between same-level nodes
    const sideColumnX = containerWidth - 300; // Right side for variants/configs
    const mainColumnX = containerWidth / 2;   // Center for main hierarchy

    // Position main hierarchy (top-down)
    hierarchyOrder.forEach((symbolType, hierarchyLevel) => {
      const nodesOfType = nodesByType.get(symbolType) || [];
      const y = 100 + (hierarchyLevel * verticalSpacing);
      
      // DEBUG: Log function type positioning
      if (symbolType === 'function') {
        WebviewLogger.warn(`POSITION CALC - Positioning ${nodesOfType.length} '${symbolType}' nodes at level ${hierarchyLevel}, y=${y}`);
        nodesOfType.forEach(node => {
          WebviewLogger.warn(`POSITION CALC - Function node being positioned: ${node.name}`);
        });
      }
      
      nodesOfType.forEach((node, index) => {
        const x = mainColumnX + (index - (nodesOfType.length - 1) / 2) * horizontalSpacing;
        positions.set(node.id, { x, y });
        
        // DEBUG: Confirm position set for function nodes
        if (node.name.includes('ValidateTextInput') || node.name.includes('EncryptText')) {
          WebviewLogger.warn(`POSITION CALC - SET POSITION for ${node.name}: x=${x}, y=${y}`);
        }
      });
    });

    // Position side column (variants/configs) - parallel to main hierarchy
    let sideYOffset = 100;
    sideColumnTypes.forEach((symbolType) => {
      const nodesOfType = nodesByType.get(symbolType) || [];
      
      nodesOfType.forEach((node, index) => {
        const y = sideYOffset + (index * 80); // Tighter spacing for side column
        positions.set(node.id, { x: sideColumnX, y });
      });
      
      if (nodesOfType.length > 0) {
        sideYOffset += (nodesOfType.length * 80) + 40; // Add gap between different types
      }
    });

    // Handle any remaining unknown types
    const unknownNodes = nodesByType.get('unknown') || [];
    unknownNodes.forEach((node, index) => {
      const y = 100 + (hierarchyOrder.length * verticalSpacing) + (index * 60);
      positions.set(node.id, { x: mainColumnX, y });
    });
    
    return positions;
  }, []);

  // Wait for container to be ready with proper dimensions
  useEffect(() => {
    if (containerRef.current) {
      // Force container to have dimensions
      const container = containerRef.current;
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.minHeight = '400px';
      
      // Use a timeout to ensure the container has rendered
      const timer = setTimeout(() => {
        if (container) {
          WebviewLogger.debug(`GRAPH TRAVERSAL - Container ready: ${container.clientWidth} x ${container.clientHeight}`);
          setContainerReady(true);
          
          // Calculate initial positions
          const positions = calculateNodePositions(
            filteredNodes, 
            filteredEdges,
            container.clientWidth, 
            container.clientHeight
          );
          setNodePositions(positions);
        }
      }, 500); // Reduced timeout for faster startup
      
      return () => clearTimeout(timer);
    }
  }, [filteredNodes, filteredEdges, calculateNodePositions]);

  // Render with static layout
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || filteredNodes.length === 0) {
      WebviewLogger.debug(`GRAPH TRAVERSAL - Waiting for container or data: svg=${!!svgRef.current}, container=${!!containerRef.current}, ready=${containerReady}, nodes=${filteredNodes.length}`);
      return;
    }

    WebviewLogger.info('RENDERING WITH STATIC LAYOUT');
    renderWithStaticLayout();
  }, [filteredNodes, filteredEdges, selectedNode, searchTerm, containerReady, nodePositions]);

  // Update transform for static layout when pan or zoom changes
  useEffect(() => {
    if (!svgRef.current) return;
    
    const group = svgRef.current.querySelector('g');
    if (group) {
      group.setAttribute('transform', `translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`);
      WebviewLogger.debug(`TRANSFORM - Updated: translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`);
    }
  }, [panOffset, zoomLevel]);

  // Pan/zoom handlers for static layout
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.button === 0) {
      event.preventDefault();
      setIsPanning(true);
      setLastMousePos({ x: event.clientX, y: event.clientY });
      WebviewLogger.debug('PAN - Mouse down, starting pan');
    }
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (isPanning) {
      event.preventDefault();
      const deltaX = event.clientX - lastMousePos.x;
      const deltaY = event.clientY - lastMousePos.y;
      
      setPanOffset(prev => {
        const newOffset = {
          x: prev.x + deltaX,
          y: prev.y + deltaY
        };
        WebviewLogger.debug(`PAN - Moving: ${deltaX}, ${deltaY}, New offset: ${newOffset.x}, ${newOffset.y}`);
        return newOffset;
      });
      
      setLastMousePos({ x: event.clientX, y: event.clientY });
    } else if (isDragging && dragNode) {
      event.preventDefault();
      const rect = svgRef.current.getBoundingClientRect();
      const newX = (event.clientX - rect.left - panOffset.x) / zoomLevel;
      const newY = (event.clientY - rect.top - panOffset.y) / zoomLevel;
      
      setNodePositions(prev => {
        const newPositions = new Map(prev);
        newPositions.set(dragNode, { x: newX, y: newY });
        return newPositions;
      });
      
      setLastMousePos({ x: event.clientX, y: event.clientY });
    }
  }, [isPanning, isDragging, dragNode, panOffset, zoomLevel, lastMousePos]);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    event.preventDefault();
    setIsPanning(false);
    setIsDragging(false);
    setDragNode(null);
    WebviewLogger.debug('MOUSE UP - Stopping pan or drag');
  }, []);

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    
    const factor = event.deltaY > 0 ? 0.8 : 1.2;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const worldX = (mouseX - panOffset.x) / zoomLevel;
    const worldY = (mouseY - panOffset.y) / zoomLevel;
    
    const newZoom = Math.max(0.1, Math.min(5, zoomLevel * factor));
    
    const newPanX = mouseX - worldX * newZoom;
    const newPanY = mouseY - worldY * newZoom;
    
    setZoomLevel(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
    
    WebviewLogger.debug(`ZOOM - Factor: ${factor}, Mouse: ${mouseX},${mouseY}, New zoom: ${newZoom}, New pan: ${newPanX},${newPanY}`);
  }, [panOffset, zoomLevel]);

  // Pan/zoom event listeners for static layout
  useEffect(() => {
    if (containerRef.current && svgRef.current) {
      const container = containerRef.current;
      const svg = svgRef.current;
      
      container.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('wheel', handleWheel, { passive: false });
      
      container.style.cursor = isPanning ? 'grabbing' : 'grab';
      
      WebviewLogger.info('STATIC LAYOUT - Event listeners attached');
      
      return () => {
        container.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('wheel', handleWheel);
        WebviewLogger.info('STATIC LAYOUT - Event listeners cleaned up');
      };
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, isPanning]);

  // Static Layout Rendering
  const renderWithStaticLayout = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    
    try {
      WebviewLogger.info('STATIC LAYOUT - Starting render');
      
      const svg = svgRef.current;
      const container = containerRef.current;
      
      svg.innerHTML = '';
      
      const containerWidth = container.clientWidth || 800;
      const containerHeight = container.clientHeight || 600;
      
      WebviewLogger.debug(`STATIC LAYOUT - Container dimensions: ${containerWidth} x ${containerHeight}`);
      WebviewLogger.debug(`STATIC LAYOUT - Filtered nodes count: ${filteredNodes.length}`);
      WebviewLogger.debug(`STATIC LAYOUT - Filtered edges count: ${filteredEdges.length}`);
      
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.removeAttribute('viewBox');
      svg.style.overflow = 'visible';
      
      let positions = nodePositions;
      if (positions.size === 0) {
        positions = calculateNodePositions(filteredNodes, filteredEdges, containerWidth * 2, containerHeight * 2);
        setNodePositions(positions);
      }

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const relationTypes = [...new Set(filteredEdges.map(e => e.relationType || e.type || 'unknown'))];
      relationTypes.forEach(type => {
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', `arrow-${type}`);
        marker.setAttribute('viewBox', '0 -5 10 10');
        marker.setAttribute('refX', '25');
        marker.setAttribute('refY', '0');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto');
        const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrowPath.setAttribute('d', 'M0,-5 L10,0 L0,5');
        arrowPath.setAttribute('fill', getEdgeColor({ relationType: type }));
        marker.appendChild(arrowPath);
        defs.appendChild(marker);
      });
      svg.appendChild(defs);

      const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      mainGroup.setAttribute('transform', `translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`);
      svg.appendChild(mainGroup);
      
      filteredEdges.forEach(edge => {
        const sourcePos = positions.get(edge.source);
        const targetPos = positions.get(edge.target);
        
        // DEBUG: Track missing positions for implements edges
        if ((edge.relationType === 'implements' || edge.type === 'implements') && (!sourcePos || !targetPos)) {
          WebviewLogger.warn(`GRAPH TRAVERSAL - DEBUG: IMPLEMENTS edge missing positions - ${edge.source} -> ${edge.target}, sourcePos: ${!!sourcePos}, targetPos: ${!!targetPos}`);
          
          // DEBUG: Check if target node exists in filteredNodes at all
          const targetExists = filteredNodes.find(n => n.id === edge.target);
          WebviewLogger.warn(`GRAPH TRAVERSAL - DEBUG: Target node '${edge.target}' exists in filteredNodes: ${!!targetExists}`);
          if (targetExists) {
            WebviewLogger.warn(`GRAPH TRAVERSAL - DEBUG: Target node details: name='${targetExists.name}', type='${targetExists.type}', fileUri='${targetExists.fileUri}'`);
          }
        }
        
        if (sourcePos && targetPos) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          
          const dx = targetPos.x - sourcePos.x;
          const dy = targetPos.y - sourcePos.y;
          const dr = Math.sqrt(dx * dx + dy * dy);
          
          const pathData = `M${sourcePos.x},${sourcePos.y}A${dr},${dr} 0 0,1 ${targetPos.x},${targetPos.y}`;
          
          path.setAttribute('d', pathData);
          path.setAttribute('stroke', getEdgeColor(edge));
          path.setAttribute('stroke-width', '2');
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke-opacity', '0.8');
          path.setAttribute('marker-end', `url(#arrow-${edge.relationType || edge.type || 'unknown'})`);
          
          mainGroup.appendChild(path);
          
          const midX = (sourcePos.x + targetPos.x) / 2;
          const midY = (sourcePos.y + targetPos.y) / 2;
          
          const length = Math.sqrt(dx * dx + dy * dy);
          const offsetX = length > 0 ? (dy / length) * 15 : 0;
          const offsetY = length > 0 ? (-dx / length) * 15 : 0;
          
          const edgeLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          edgeLabel.setAttribute('x', (midX + offsetX).toString());
          edgeLabel.setAttribute('y', (midY + offsetY).toString());
          edgeLabel.setAttribute('text-anchor', 'middle');
          edgeLabel.setAttribute('dominant-baseline', 'central');
          edgeLabel.setAttribute('font-size', '9px');
          edgeLabel.setAttribute('fill', 'var(--vscode-editor-foreground)');
          edgeLabel.setAttribute('opacity', '0.7');
          edgeLabel.style.pointerEvents = 'none';
          edgeLabel.textContent = edge.relationType || edge.type || 'ref';
          
          mainGroup.appendChild(edgeLabel);
        }
      });
      
      filteredNodes.forEach(node => {
        const pos = positions.get(node.id);
        if (!pos) return;
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x.toString());
        circle.setAttribute('cy', pos.y.toString());
        circle.setAttribute('r', '25');
        try {
          const relatedNodes = getRelatedNodes(selectedNode);
          circle.setAttribute('fill', selectedNode === node.id || relatedNodes.has(node.id) ? '#FF0000' : getNodeColor(node));
        } catch (e) {
          WebviewLogger.error(`Error setting node color for ${node.id}: ${e.message}`);
          circle.setAttribute('fill', getNodeColor(node));
        }
        circle.setAttribute('stroke', '#999');
        circle.setAttribute('stroke-width', '1.5');
        circle.style.cursor = 'move';
        
        circle.addEventListener('click', (event) => {
          event.stopPropagation();
          setSelectedNode(selectedNode === node.id ? null : node.id);
          
          const centerX = containerWidth / 2;
          const centerY = containerHeight / 2;
          
          const newPanX = centerX - pos.x * zoomLevel;
          const newPanY = centerY - pos.y * zoomLevel;
          
          setPanOffset({ x: newPanX, y: newPanY });
          setZoomLevel(1.5);
        });
        
        circle.addEventListener('mousedown', (event) => {
          if (event.button === 0) {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(true);
            setDragNode(node.id);
            setLastMousePos({ x: event.clientX, y: event.clientY });
            WebviewLogger.debug(`DRAG - Started on node: ${node.id}`);
          }
        });
        
        mainGroup.appendChild(circle);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pos.x.toString());
        text.setAttribute('y', pos.y.toString());
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('font-size', '11px');
        text.setAttribute('fill', 'white');
        text.setAttribute('font-weight', 'bold');
        text.style.pointerEvents = 'none';
        text.textContent = node.name;
        
        mainGroup.appendChild(text);
      });
      
      WebviewLogger.info('STATIC LAYOUT - Render complete');
    } catch (e) {
      WebviewLogger.error(`Static Layout render error: ${e.message}`);
    }
  }, [filteredNodes, filteredEdges, nodePositions, selectedNode, panOffset, zoomLevel]);

  // Zoom and pan handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(5, prev * 1.2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(0.1, prev / 1.2));
  }, []);

  const handleReset = useCallback(() => {
    setPanOffset({ x: 0, y: 0 });
    setZoomLevel(1);
    setSelectedNode(null);
    setSearchTerm('');
  }, []);

  const downloadGraph = useCallback(() => {
    if (!svgRef.current) {
      WebviewLogger.warn('GRAPH TRAVERSAL - SVG ref not available for download');
      return;
    }

    try {
      // Clone the SVG to avoid modifying the original
      const svgElement = svgRef.current.cloneNode(true) as SVGSVGElement;
      
      // Get the SVG dimensions
      const bbox = svgRef.current.getBBox();
      const padding = 50;
      const width = bbox.width + (padding * 2);
      const height = bbox.height + (padding * 2);
      
      // Set proper dimensions and viewBox
      svgElement.setAttribute('width', width.toString());
      svgElement.setAttribute('height', height.toString());
      svgElement.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);
      
      // Add white background
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', (bbox.x - padding).toString());
      rect.setAttribute('y', (bbox.y - padding).toString());
      rect.setAttribute('width', width.toString());
      rect.setAttribute('height', height.toString());
      rect.setAttribute('fill', 'white');
      svgElement.insertBefore(rect, svgElement.firstChild);
      
      // Convert SVG to string and send to extension host
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      
      // Send to extension host for download (avoid CSP issues)
      if (window.vscode) {
        window.vscode.postMessage({
          type: 'downloadImage',
          data: {
            svgData,
            width,
            height,
            filename: `graph-traversal-${timestamp}.svg`
          }
        });
        WebviewLogger.info('GRAPH TRAVERSAL - Download request sent to extension host');
      } else {
        WebviewLogger.error('GRAPH TRAVERSAL - VSCode API not available');
      }
      
    } catch (error) {
      WebviewLogger.error('GRAPH TRAVERSAL - Error preparing graph for download:', error);
    }
  }, []);

  const selectedNodeData = selectedNode ? data.nodes.find(n => n.id === selectedNode) : null;

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'var(--vscode-editor-background)',
      color: 'var(--vscode-editor-foreground)',
      fontFamily: 'var(--vscode-font-family)'
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--vscode-panel-border)',
        background: 'var(--vscode-panel-background)'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{
            padding: '4px 8px',
            borderRadius: '4px',
            background: '#44AA44',
            color: 'white',
            fontSize: '11px',
            fontWeight: 'bold',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            ⚡ Static
          </div>
          
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--vscode-input-border)',
              borderRadius: '4px',
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              fontSize: '14px',
              minWidth: '200px'
            }}
          />
          
          {/* Relationship filters */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--vscode-foreground)' }}>
            <input
              type="checkbox"
              checked={showParentOf}
              onChange={(e) => setShowParentOf(e.target.checked)}
            />
            Parent-of
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--vscode-foreground)' }}>
            <input
              type="checkbox"
              checked={showChildOf}
              onChange={(e) => setShowChildOf(e.target.checked)}
            />
            Child-of
          </label>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={handleZoomOut} style={{
            padding: '6px 12px',
            border: '1px solid var(--vscode-button-border)',
            borderRadius: '4px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>-</button>
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            minWidth: '50px',
            textAlign: 'center'
          }}>{Math.round(zoomLevel * 100)}%</span>
          <button onClick={handleZoomIn} style={{
            padding: '6px 12px',
            border: '1px solid var(--vscode-button-border)',
            borderRadius: '4px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>+</button>
          <button onClick={handleReset} style={{
            padding: '6px 12px',
            border: '1px solid var(--vscode-button-border)',
            borderRadius: '4px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            cursor: 'pointer',
            fontSize: '14px'
          }}>Reset</button>
          <button onClick={() => setShowLegend(!showLegend)} style={{
            padding: '6px 12px',
            border: '1px solid var(--vscode-button-border)',
            borderRadius: '4px',
            background: showLegend ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
            color: showLegend ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
            cursor: 'pointer',
            fontSize: '14px'
          }}>{showLegend ? 'Hide Legend' : 'Show Legend'}</button>
          
          <button onClick={downloadGraph} style={{
            padding: '6px 12px',
            border: '1px solid var(--vscode-button-border)',
            borderRadius: '4px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            cursor: 'pointer',
            fontSize: '14px'
          }}>📥 Download SVG</button>
        </div>
      </div>

      {/* Statistics */}
      <div style={{
        display: 'flex',
        gap: '24px',
        padding: '8px 16px',
        background: 'var(--vscode-panel-background)',
        borderBottom: '1px solid var(--vscode-panel-border)'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: 'var(--vscode-descriptionForeground)' }}>Nodes:</span>
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{filteredNodes.length}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: 'var(--vscode-descriptionForeground)' }}>Edges:</span>
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{filteredEdges.length}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: 'var(--vscode-descriptionForeground)' }}>File Types:</span>
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {new Set(filteredNodes.map(n => n.fileUri.split('.').pop())).size}
          </span>
        </div>
        {!containerReady && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#4ECDC4' }}>🔄 Initializing...</span>
          </div>
        )}
      </div>

      {/* Graph Canvas */}
      <div 
        ref={containerRef}
        style={{ 
          flex: 1, 
          position: 'relative', 
          overflow: 'hidden',
          background: 'var(--vscode-editor-background)',
          minHeight: '400px'
        }}
      >
        {!containerReady && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            fontSize: '16px',
            color: '#666'
          }}>
            Loading graph...
          </div>
        )}
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{
            cursor: 'grab',
            display: containerReady ? 'block' : 'none'
          }}
        />
      </div>

      {/* Node Details Panel */}
      {selectedNodeData && (
        <div style={{
          position: 'absolute',
          top: '120px',
          right: '20px',
          width: '280px',
          background: 'var(--vscode-panel-background)',
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: '6px',
          padding: '16px',
          maxHeight: '400px',
          overflow: 'auto',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1000
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--vscode-panel-border)'
          }}>
            <h3 style={{ 
              margin: '0', 
              fontSize: '13px', 
              fontWeight: '400',
              color: 'var(--vscode-editor-foreground)',
              letterSpacing: '0.5px'
            }}>
              Node Details
            </h3>
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--vscode-descriptionForeground)',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '2px',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--vscode-toolbar-hoverBackground)';
                e.currentTarget.style.color = 'var(--vscode-editor-foreground)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--vscode-descriptionForeground)';
              }}
            >
              ×
            </button>
          </div>
          
          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            <div style={{ 
              marginBottom: '10px',
              padding: '8px',
              background: 'var(--vscode-input-background)',
              borderRadius: '4px',
              border: '1px solid var(--vscode-input-border)'
            }}>
              <div style={{ 
                color: 'var(--vscode-descriptionForeground)', 
                fontSize: '11px', 
                fontWeight: '300',
                marginBottom: '2px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                ID
              </div>
              <div style={{ 
                color: 'var(--vscode-editor-foreground)', 
                fontSize: '13px',
                fontWeight: '400',
                fontFamily: 'monospace'
              }}>
                {selectedNodeData.name}
              </div>
            </div>
            
            <div style={{ 
              marginBottom: '10px',
              padding: '8px',
              background: 'var(--vscode-input-background)',
              borderRadius: '4px',
              border: '1px solid var(--vscode-input-border)'
            }}>
              <div style={{ 
                color: 'var(--vscode-descriptionForeground)', 
                fontSize: '11px', 
                fontWeight: '300',
                marginBottom: '2px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Name
              </div>
              <div style={{ 
                color: 'var(--vscode-editor-foreground)', 
                fontSize: '13px',
                fontWeight: '400'
              }}>
                {(() => {
                  const nameProperty = selectedNodeData.properties?.name;
                  let fullName = selectedNodeData.name;
                  
                  if (nameProperty && Array.isArray(nameProperty)) {
                    fullName = nameProperty.join(' ');
                  } else if (nameProperty && typeof nameProperty === 'string') {
                    fullName = nameProperty;
                  }
                  
                  return fullName.replace(/"/g, '').trim();
                })()}
              </div>
            </div>
            
            <div style={{ 
              marginBottom: '10px',
              padding: '8px',
              background: 'var(--vscode-input-background)',
              borderRadius: '4px',
              border: '1px solid var(--vscode-input-border)'
            }}>
              <div style={{ 
                color: 'var(--vscode-descriptionForeground)', 
                fontSize: '11px', 
                fontWeight: '300',
                marginBottom: '2px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Node Type
              </div>
              <div style={{ 
                color: 'var(--vscode-editor-foreground)', 
                fontSize: '13px',
                fontWeight: '400'
              }}>
                {(() => {
                  const rawType = selectedNodeData.type || 'unknown';
                  let displayType = rawType;
                  
                  if (rawType === 'header' || rawType === 'definition') {
                    const nodeSymbolType = getNodeSymbolType(selectedNodeData);
                    displayType = nodeSymbolType;
                    WebviewLogger.debug(`TYPE DEBUG - rawType: ${rawType}, detected: ${nodeSymbolType}, for node: ${selectedNodeData.name}`);
                  }
                  
                  const typeMap: { [key: string]: string } = {
                    'productline': 'Product Line',
                    'featureset': 'Feature Set', 
                    'feature': 'Feature',
                    'functionset': 'Function Set',
                    'function': 'Function',
                    'block': 'Block',
                    'reqset': 'Requirement Set',
                    'requirement': 'Requirement',
                    'testset': 'Test Set',
                    'testcase': 'Test Case',
                    'config': 'Config',
                    'port': 'Port',
                    'variantset': 'Variant Set',
                    'configset': 'Config Set'
                  };
                  
                  return typeMap[displayType] || displayType.charAt(0).toUpperCase() + displayType.slice(1);
                })()}
              </div>
            </div>
            
            <div style={{ 
              marginBottom: '10px',
              padding: '8px',
              background: 'var(--vscode-input-background)',
              borderRadius: '4px',
              border: '1px solid var(--vscode-input-border)'
            }}>
              <div style={{ 
                color: 'var(--vscode-descriptionForeground)', 
                fontSize: '11px', 
                fontWeight: '300',
                marginBottom: '2px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                File
              </div>
              <div style={{ 
                color: 'var(--vscode-editor-foreground)', 
                fontSize: '13px',
                fontFamily: 'monospace',
                fontWeight: '400'
              }}>
                {selectedNodeData.fileUri.split('/').pop()}
              </div>
            </div>
            
            {selectedNodeData.connections.length > 0 && (
              <div style={{ 
                padding: '8px',
                background: 'var(--vscode-input-background)',
                borderRadius: '4px',
                border: '1px solid var(--vscode-input-border)'
              }}>
                <div style={{ 
                  color: 'var(--vscode-descriptionForeground)', 
                  fontSize: '11px', 
                  fontWeight: '300',
                  marginBottom: '2px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Relations
                </div>
                <div style={{ 
                  color: 'var(--vscode-editor-foreground)', 
                  fontSize: '13px',
                  fontWeight: '400'
                }}>
                  {selectedNodeData.connections.length}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend Panel */}
      {showLegend && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          width: '260px',
          background: 'var(--vscode-panel-background)',
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: '6px',
          padding: '12px',
          maxHeight: '400px',
          overflow: 'auto',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 999
        }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '13px', 
            fontWeight: '400',
            color: 'var(--vscode-editor-foreground)',
            letterSpacing: '0.5px',
            borderBottom: '1px solid var(--vscode-panel-border)',
            paddingBottom: '8px'
          }}>
            Legend
          </h3>
          
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '11px', 
              fontWeight: '300',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--vscode-descriptionForeground)'
            }}>
              Node Types
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { type: 'productline', label: 'Product Line' },
                { type: 'featureset', label: 'Feature Set' },
                { type: 'feature', label: 'Feature' },
                { type: 'functionset', label: 'Function Set' },
                { type: 'function', label: 'Function' },
                { type: 'block', label: 'Block' },
                { type: 'requirement', label: 'Requirement' },
                { type: 'testcase', label: 'Test Case' }
              ].map(({ type, label }) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: getNodeColor({ type } as any)
                  }} />
                  <span style={{ fontSize: '11px', color: 'var(--vscode-editor-foreground)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '11px', 
              fontWeight: '300',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--vscode-descriptionForeground)'
            }}>
              Relationships
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { type: 'parentof', label: 'Parent Of' },
                { type: 'listedfor', label: 'Listed For' },
                { type: 'enables', label: 'Enables' },
                { type: 'implements', label: 'Implements' },
                { type: 'satisfies', label: 'Satisfies' },
                { type: 'requires', label: 'Requires' },
                { type: 'allocatedto', label: 'Allocated To' },
                { type: 'composedof', label: 'Composed Of' }
              ].map(({ type, label }) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '16px',
                    height: '2px',
                    backgroundColor: getEdgeColor({ relationType: type } as any)
                  }} />
                  <span style={{ fontSize: '11px', color: 'var(--vscode-editor-foreground)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}