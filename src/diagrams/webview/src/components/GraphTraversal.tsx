import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GraphTraversalData, GraphNode, GraphEdge } from '../../types/diagramTypes';
import { WebviewLogger } from '../utils/logger';

interface GraphTraversalProps {
  data: GraphTraversalData;
}

// PERFORMANCE CONFIG
const RENDERING_CONFIG = {
  DEBUG_PERFORMANCE: true         // Set to true for performance logging
};

export function GraphTraversal({ data }: GraphTraversalProps) {
  WebviewLogger.info(`GRAPH TRAVERSAL - Component rendering: ${data?.nodes?.length || 0} nodes, ${data?.edges?.length || 0} edges, Mode: Static`);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [containerReady, setContainerReady] = useState(false);
  const [showLegend, setShowLegend] = useState(false); // Hidden by default
  // Advanced filtering state
  const [relationFilters, setRelationFilters] = useState<Map<string, boolean>>(new Map([
    ['childof', true],
    ['parentof', false],
    ['implements', true],
    ['satisfies', true],
    ['enables', true],
    ['requires', true],
    ['allocatedto', true],
    ['composedof', true],
    ['listedfor', true],
    ['when', true]
  ]));
  
  const [nodeTypeFilters, setNodeTypeFilters] = useState<Map<string, boolean>>(new Map([
    ['feature', true],
    ['function', true],
    ['requirement', true],
    ['testcase', true],
    ['block', true],
    ['productline', true],
    ['featureset', true],
    ['functionset', true],
    ['reqset', true],
    ['testset', true],
    ['config', true],
    ['configset', true]
  ]));
  
  const [showFilters, setShowFilters] = useState<boolean>(false);
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
    
    // DEBUG: Log all node types and file extensions before filtering
    const fileExtCounts = {};
    const nodeTypeCounts = {};
    data.nodes.forEach(node => {
      const fileExt = node.fileUri ? node.fileUri.split('.').pop() || 'unknown' : 'no-uri';
      fileExtCounts[fileExt] = (fileExtCounts[fileExt] || 0) + 1;
      
      const nodeType = getNodeSymbolType(node);
      nodeTypeCounts[nodeType] = (nodeTypeCounts[nodeType] || 0) + 1;
      
      // DEBUG: Log config/configset nodes specifically
      if (nodeType === 'config' || nodeType === 'configset') {
        WebviewLogger.warn(`🎯 FOUND CONFIG NODE: ${node.name} (${nodeType}) from file: ${node.fileUri}`);
      }
      
      // DEBUG: Log all node names for inspection
      if (node.name.toLowerCase().includes('config')) {
        WebviewLogger.warn(`🎯 CONFIG-RELATED NODE: ${node.name} (${nodeType}) from file: ${node.fileUri}`);
      }
    });
    WebviewLogger.info(`GRAPH TRAVERSAL - DEBUG: Node file extensions: ${JSON.stringify(fileExtCounts)}`);
    WebviewLogger.info(`GRAPH TRAVERSAL - DEBUG: Node types: ${JSON.stringify(nodeTypeCounts)}`);
    
    // Filter out .spr and .agt files - not relevant for traceability
    let nodes = data.nodes.filter(node => {
      const fileExt = node.fileUri ? node.fileUri.split('.').pop() || '' : '';
      return fileExt !== 'spr' && fileExt !== 'agt';
    });
    
    // Apply node type filters
    nodes = nodes.filter(node => {
      const nodeType = getNodeSymbolType(node);
      const isEnabled = nodeTypeFilters.get(nodeType);
      return isEnabled !== false; // Include if not explicitly disabled
    });
    
    // Apply search filter
    if (searchTerm) {
      nodes = nodes.filter(node => 
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.fileUri.toLowerCase().includes(searchTerm.toLowerCase())
    );
    }
    
    WebviewLogger.debug(`GRAPH TRAVERSAL - Filtered nodes: ${nodes.length} (from ${data.nodes.length} total)`);
    return nodes;
  }, [data.nodes, searchTerm, nodeTypeFilters]);

  // Lightweight SpatialGrid for O(n) overlap detection and resolution
  class SpatialGrid {
    private cellSize: number;
    private grid: Map<string, Array<{id: string, x: number, y: number, radius: number}>>;

    constructor(cellSize = 80) {
      this.cellSize = cellSize;
      this.grid = new Map();
    }

    clear() {
      this.grid.clear();
    }

    insert(node: {id: string, x: number, y: number, radius?: number}) {
      const cellX = Math.floor(node.x / this.cellSize);
      const cellY = Math.floor(node.y / this.cellSize);
      const key = `${cellX},${cellY}`;
      
      if (!this.grid.has(key)) {
        this.grid.set(key, []);
      }
      this.grid.get(key)!.push({
        id: node.id,
        x: node.x,
        y: node.y,
        radius: node.radius || 25 // Default node radius
      });
    }

    getNearbyNodes(node: {x: number, y: number}): Array<{id: string, x: number, y: number, radius: number}> {
      const cellX = Math.floor(node.x / this.cellSize);
      const cellY = Math.floor(node.y / this.cellSize);
      const nearby: Array<{id: string, x: number, y: number, radius: number}> = [];

      // Check 3x3 grid around the node's cell
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${cellX + dx},${cellY + dy}`;
          const cellNodes = this.grid.get(key);
          if (cellNodes) {
            nearby.push(...cellNodes);
          }
        }
      }
      return nearby;
    }

    findOverlappingPairs(): Array<[{id: string, x: number, y: number, radius: number}, {id: string, x: number, y: number, radius: number}]> {
      const overlappingPairs: Array<[{id: string, x: number, y: number, radius: number}, {id: string, x: number, y: number, radius: number}]> = [];
      const processedPairs = new Set<string>();

      for (const cellNodes of this.grid.values()) {
        for (let i = 0; i < cellNodes.length; i++) {
          const node1 = cellNodes[i];
          const nearby = this.getNearbyNodes(node1);
          
          for (const node2 of nearby) {
            if (node1.id !== node2.id) {
              const pairKey = [node1.id, node2.id].sort().join('-');
              if (!processedPairs.has(pairKey)) {
                processedPairs.add(pairKey);
                
                const dx = node1.x - node2.x;
                const dy = node1.y - node2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = node1.radius + node2.radius + 10; // 10px padding
                
                if (distance < minDistance) {
                  overlappingPairs.push([node1, node2]);
                }
              }
            }
          }
        }
      }
      return overlappingPairs;
    }
  }

  // Filter edges based on filtered nodes and relationship type filters
  const filteredEdges = useMemo(() => {
    WebviewLogger.debug('GRAPH TRAVERSAL - Filtering edges');
    WebviewLogger.debug(`GRAPH TRAVERSAL - Total edges: ${data.edges.length}`);
    WebviewLogger.debug(`GRAPH TRAVERSAL - Using advanced relation filters`);
    
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filtered = data.edges.filter(edge => {
      // Apply relationship type filters
      const relationType = edge.type || edge.relationType || '';
      const isRelationEnabled = relationFilters.get(relationType);
      if (isRelationEnabled === false) {
        return false; // Explicitly disabled
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
      
      // DEBUG: Log when relations specifically
      if (relType === 'when') {
        WebviewLogger.warn(`🎯 FOUND WHEN RELATION: ${edge.source} → ${edge.target} (${relType})`);
      }
    });
    WebviewLogger.info(`GRAPH TRAVERSAL - Relationship distribution: ${JSON.stringify(relationshipCounts)}`);
    
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
  }, [data.edges, filteredNodes, relationFilters]);

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

  // Enhanced circular cluster layout algorithm
  const calculateNodePositions = useCallback((nodes: GraphNode[], edges: GraphEdge[], containerWidth: number, containerHeight: number) => {
    const positions = new Map<string, {x: number, y: number}>();
    
    WebviewLogger.info('🎯 CIRCULAR LAYOUT - Starting enhanced clustering algorithm');
    
    // Build graph adjacency lists for parent-child relationships
    const adjList = new Map<string, string[]>();
    const parentMap = new Map<string, string>();
    nodes.forEach(node => adjList.set(node.id, []));
    
    edges.forEach(edge => {
      // Process hierarchical relationships (parent-child)
      if (edge.relationType === 'childof' || edge.relationType === 'parentof') {
        const parent = edge.relationType === 'childof' ? edge.target : edge.source;
        const child = edge.relationType === 'childof' ? edge.source : edge.target;
        adjList.get(parent)?.push(child);
        parentMap.set(child, parent);
      }
      // Process other relationships for connectivity (when, requires, etc.)
      else if (edge.relationType && ['when', 'requires', 'enables', 'satisfies'].includes(edge.relationType)) {
        // These create logical connections but not strict hierarchical parent-child
        // Still add to adjacency for potential satellite positioning
      adjList.get(edge.source)?.push(edge.target);
      }
    });

    // Domain classification function
    const classifyNodeDomain = (node: GraphNode): 'config' | 'main' => {
      const symbolType = getNodeSymbolType(node);
      return (symbolType === 'configset' || symbolType === 'config') ? 'config' : 'main';
    };

    // Separate nodes by domain
    const configNodes = nodes.filter(n => classifyNodeDomain(n) === 'config');
    const mainNodes = nodes.filter(n => classifyNodeDomain(n) === 'main');
    
    WebviewLogger.info(`🎯 CIRCULAR LAYOUT - Config domain: ${configNodes.length} nodes, Main domain: ${mainNodes.length} nodes`);

    // Layout configuration - FIXED coordinates
    const leftColumnX = -200;         // Config domain - FAR LEFT (negative coordinates)
    const centerColumnX = 400;        // Main hierarchy - CENTER (reasonable center)
    const maxLayoutWidth = 1200;      // Constrain total width to prevent massive spread
    const clusterRadius = 60;         // Radius for circular arrangement (reduced)
    const verticalSpacing = 150;      // Spacing between hierarchy levels (reduced)
    const configVerticalSpacing = 80; // Tighter spacing for config nodes

    // === CONFIG DOMAIN LAYOUT (Left Column) ===
    let configY = 100;
    
    // Find ConfigSet (header node)
    const configSet = configNodes.find(n => getNodeSymbolType(n) === 'configset');
    if (configSet) {
      positions.set(configSet.id, { x: leftColumnX, y: configY });
      configY += configVerticalSpacing;
      
      // Get config children
      const configChildren = configNodes.filter(n => 
        getNodeSymbolType(n) === 'config' && parentMap.get(n.id) === configSet.id
      );
      
      // Position config children vertically below ConfigSet
      configChildren.forEach((config, index) => {
        positions.set(config.id, { x: leftColumnX, y: configY + (index * configVerticalSpacing) });
      });
      
      WebviewLogger.warn(`🎯 CONFIG LAYOUT SUCCESS - Positioned ConfigSet '${configSet.name}' and ${configChildren.length} config children`);
    } else {
      WebviewLogger.warn(`🎯 CONFIG LAYOUT - NO CONFIGSET FOUND in ${configNodes.length} config domain nodes`);
      if (configNodes.length > 0) {
        WebviewLogger.warn(`🎯 CONFIG LAYOUT - Available config nodes: ${configNodes.map(n => `${n.name}(${getNodeSymbolType(n)})`).join(', ')}`);
      }
      
      // Try to position any config nodes found
      configNodes.forEach((configNode, index) => {
        positions.set(configNode.id, { x: leftColumnX, y: configY + (index * configVerticalSpacing) });
        WebviewLogger.warn(`🎯 CONFIG LAYOUT - Positioned orphan config node: ${configNode.name} (${getNodeSymbolType(configNode)})`);
      });
    }

    // === MAIN HIERARCHY LAYOUT (Center with Circular Clusters) ===
    const hierarchyOrder = [
      'productline',   // Level 0: Top root
      'featureset',    // Level 1: Sets start here
      'feature',       // Level 2: Children in circular clusters
      'functionset',   // Level 3: Sets
      'function',      // Level 4: Children in circular clusters  
      'reqset',        // Level 5: Sets (requirementset)
      'requirement',   // Level 6: Children in circular clusters
      'testset',       // Level 7: Sets
      'testcase',      // Level 8: Children in circular clusters
      'block'          // Level 9: Can have nested hierarchy
    ];

    // Group main nodes by symbol type (exclude config nodes from main processing)
    const nodesByType: Map<string, GraphNode[]> = new Map();
    mainNodes.forEach(node => {
      const symbolType = getNodeSymbolType(node);
      
      // CRITICAL FIX: Skip config nodes in main hierarchy processing
      if (symbolType === 'config' || symbolType === 'configset') {
        WebviewLogger.warn(`🎯 SKIPPING CONFIG NODE in main hierarchy: ${node.name} (${symbolType})`);
        return; // Don't process config nodes in main hierarchy
      }
      
      if (!nodesByType.has(symbolType)) {
        nodesByType.set(symbolType, []);
      }
      nodesByType.get(symbolType)!.push(node);
    });

    // Circular positioning helper function
    const positionChildrenInCircle = (setNode: GraphNode, children: GraphNode[], level: number) => {
      const centerX = centerColumnX;
      const centerY = 100 + (level * verticalSpacing);
      
      // Position the set node at center
      positions.set(setNode.id, { x: centerX, y: centerY });
      
      if (children.length === 0) return;
      
      // Calculate positions for children in circular/arc arrangement
      const radius = Math.max(clusterRadius, children.length * 15); // Dynamic radius
      const angleStep = (Math.PI * 1.2) / Math.max(children.length - 1, 1); // 216° arc
      const startAngle = -Math.PI * 0.6; // Start at -108°
      
      children.forEach((child, index) => {
        const angle = startAngle + (index * angleStep);
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        positions.set(child.id, { x, y });
      });
      
      WebviewLogger.debug(`🎯 CIRCULAR LAYOUT - Positioned ${setNode.name} with ${children.length} children in circular cluster`);
    };

    // ENHANCED: Make ANY node with children a cluster center (not just sets)
    const processedNodes = new Set<string>();
    
    hierarchyOrder.forEach((symbolType, hierarchyLevel) => {
      const nodesOfType = nodesByType.get(symbolType) || [];
      
      nodesOfType.forEach((node, nodeIndex) => {
        if (processedNodes.has(node.id)) return; // Skip if already positioned
        
        // Find children of this node (any node can be a cluster center!)
        const children = adjList.get(node.id)?.map(childId => 
          nodes.find(n => n.id === childId)
        ).filter(n => n && classifyNodeDomain(n) === 'main' && !processedNodes.has(n.id)) || [];
        
        // FIXED: Increase cluster spacing to prevent satellite overlap between clusters
        const clusterSpacing = Math.min(350, Math.max(250, children.length * 40)); // INCREASED spacing significantly
        const maxOffset = maxLayoutWidth / 3; // Allow more spread for spacing
        const rawOffset = (nodeIndex - (nodesOfType.length - 1) / 2) * clusterSpacing;
        const constrainedOffset = Math.max(-maxOffset, Math.min(maxOffset, rawOffset));
        const adjustedCenterX = centerColumnX + constrainedOffset;
        const centerY = 100 + (hierarchyLevel * verticalSpacing);
        
        // CRITICAL FIX: Position cluster center with conflict detection
        let clusterCenterX = adjustedCenterX;
        let clusterCenterY = centerY;
        let centerAttempts = 0;
        
        // Check for cluster center conflicts
        const checkCenterConflict = (x: number, y: number, minDistance = 50) => {
          for (const [existingId, existingPos] of positions.entries()) {
            const distance = Math.sqrt(Math.pow(x - existingPos.x, 2) + Math.pow(y - existingPos.y, 2));
            if (distance < minDistance) {
              return true; // Conflict detected
            }
          }
          return false;
        };
        
        // Resolve cluster center conflicts by small adjustments
        while (checkCenterConflict(clusterCenterX, clusterCenterY) && centerAttempts < 8) {
          const offsetAngle = centerAttempts * Math.PI / 4; // 45° increments  
          const offsetDistance = 30 + (centerAttempts * 15); // Increasing offset
          clusterCenterX = adjustedCenterX + offsetDistance * Math.cos(offsetAngle);
          clusterCenterY = centerY + offsetDistance * Math.sin(offsetAngle);
          centerAttempts++;
        }
        
        positions.set(node.id, { x: clusterCenterX, y: clusterCenterY });
        processedNodes.add(node.id);
        
        if (centerAttempts > 0) {
          WebviewLogger.debug(`🎯 CLUSTER CENTER - Resolved conflict for ${node.name}, moved to (${clusterCenterX.toFixed(1)}, ${clusterCenterY.toFixed(1)}) after ${centerAttempts} attempts`);
        }
        
        if (children.length > 0) {
          // CRITICAL FIX: MUCH smaller satellite radius - children close to parents
          const baseRadius = Math.max(35, Math.min(50, children.length * 8)); // REDUCED: 35-50px radius max
          
          // Check for position conflicts and resolve them (reduced minimum distance for tighter clusters)
          const checkPositionConflict = (x: number, y: number, minDistance = 45) => {
            for (const [existingId, existingPos] of positions.entries()) {
              const distance = Math.sqrt(Math.pow(x - existingPos.x, 2) + Math.pow(y - existingPos.y, 2));
              if (distance < minDistance) {
                return true; // Conflict detected
              }
            }
            return false;
          };
          
          if (children.length === 1) {
            // Single child: position below parent with conflict check (use actual cluster center)
            let x = clusterCenterX;
            let y = clusterCenterY + baseRadius;
            let attempts = 0;
            
            // Resolve conflicts by adjusting position (use actual cluster center)
            while (checkPositionConflict(x, y) && attempts < 8) {
              const offsetAngle = (attempts + 1) * Math.PI / 4; // 45° increments
              x = clusterCenterX + baseRadius * Math.cos(offsetAngle);
              y = clusterCenterY + baseRadius * Math.sin(offsetAngle);
              attempts++;
            }
            
            positions.set(children[0].id, { x, y });
            processedNodes.add(children[0].id);
            WebviewLogger.debug(`🎯 SATELLITE - Single child positioned at (${x.toFixed(1)}, ${y.toFixed(1)}) after ${attempts} conflict resolutions`);
            
          } else if (children.length === 2) {
            // Two children: position with guaranteed separation
            const radius = baseRadius;
            const baseAngles = [-Math.PI * 0.3, Math.PI * 0.3]; // ±54° for better spacing
            
            children.forEach((child, index) => {
              let angle = baseAngles[index];
              let x = clusterCenterX + radius * Math.cos(angle);
              let y = clusterCenterY + radius * Math.sin(angle);
              let attempts = 0;
              
              // Resolve conflicts by adjusting angle (use actual cluster center)
              while (checkPositionConflict(x, y) && attempts < 12) {
                angle += (attempts + 1) * Math.PI / 12; // 15° increments
                x = clusterCenterX + radius * Math.cos(angle);
                y = clusterCenterY + radius * Math.sin(angle);
                attempts++;
              }
              
              positions.set(child.id, { x, y });
              processedNodes.add(child.id);
              WebviewLogger.debug(`🎯 SATELLITE - Child ${index + 1}/2 positioned at (${x.toFixed(1)}, ${y.toFixed(1)}) after ${attempts} conflict resolutions`);
            });
            
          } else {
            // Multiple children: Full circle distribution with conflict resolution
            const radius = baseRadius + Math.min(15, children.length * 3); // REDUCED growth: max +15px
            const fullCircle = Math.PI * 2; // Use full 360° circle for better distribution
            const angleStep = fullCircle / children.length; // Equal spacing around full circle
            
            children.forEach((child, index) => {
              let baseAngle = index * angleStep; // Start with equal distribution
              let radiusVariation = 1 + (index % 3) * 0.1; // 10% radius variation for organic feel
              let actualRadius = radius * radiusVariation;
              
              let x = clusterCenterX + actualRadius * Math.cos(baseAngle);
              let y = clusterCenterY + actualRadius * Math.sin(baseAngle);
              let attempts = 0;
              
              // Resolve conflicts by adjusting angle and radius
              while (checkPositionConflict(x, y) && attempts < 16) {
                if (attempts < 8) {
                  // First, try adjusting angle
                  baseAngle += Math.PI / 8; // 22.5° increments
                } else {
                  // Then try increasing radius
                  actualRadius += 20;
                }
                x = clusterCenterX + actualRadius * Math.cos(baseAngle);
                y = clusterCenterY + actualRadius * Math.sin(baseAngle);
                attempts++;
              }
              
              positions.set(child.id, { x, y });
              processedNodes.add(child.id);
              WebviewLogger.debug(`🎯 SATELLITE - Child ${index + 1}/${children.length} positioned at (${x.toFixed(1)}, ${y.toFixed(1)}) after ${attempts} conflict resolutions`);
            });
          }
          
          WebviewLogger.info(`🎯 SATELLITE LAYOUT - ${node.name} (${symbolType}): positioned with ${children.length} satellite children in arc`);
        } else {
          WebviewLogger.debug(`🎯 SATELLITE LAYOUT - ${node.name} (${symbolType}): standalone node, no satellites`);
        }
      });
    });

    // Handle any orphaned nodes (no clear hierarchy) - FIXED with conflict detection
    const positionedNodeIds = new Set(positions.keys());
    const orphanedNodes = mainNodes.filter(n => !positionedNodeIds.has(n.id));
    
    if (orphanedNodes.length > 0) {
      WebviewLogger.warn(`🎯 CIRCULAR LAYOUT - Found ${orphanedNodes.length} orphaned nodes, positioning with conflict avoidance`);
      
      // Global conflict checker for orphaned nodes
      const checkOrphanConflict = (x: number, y: number, minDistance = 60) => {
        for (const [existingId, existingPos] of positions.entries()) {
          const distance = Math.sqrt(Math.pow(x - existingPos.x, 2) + Math.pow(y - existingPos.y, 2));
          if (distance < minDistance) {
            return true; // Conflict detected
          }
        }
        return false;
      };
      
      orphanedNodes.forEach((node, index) => {
        let x, y;
        let attempts = 0;
        const baseY = 100 + (hierarchyOrder.length * verticalSpacing) + (index * 80);
        
        // Try to position orphan with conflict avoidance
        do {
          const orphanOffset = (index - (orphanedNodes.length - 1) / 2) * 120; // 120px spacing between orphans
          const angleOffset = attempts * Math.PI / 6; // 30° increments for conflict resolution
          const radiusOffset = attempts * 40; // Increase distance if conflicts
          
          x = centerColumnX + Math.max(-200, Math.min(200, orphanOffset)) + radiusOffset * Math.cos(angleOffset);
          y = baseY + radiusOffset * Math.sin(angleOffset);
          attempts++;
        } while (checkOrphanConflict(x, y) && attempts < 12);
        
        positions.set(node.id, { x, y });
        
        if (attempts > 1) {
          WebviewLogger.debug(`🎯 ORPHAN - Resolved conflict for ${node.name}, positioned at (${x.toFixed(1)}, ${y.toFixed(1)}) after ${attempts - 1} attempts`);
        }
      });
    }
    
    WebviewLogger.info(`🎯 CIRCULAR LAYOUT - Layout complete: ${positions.size} nodes positioned`);
    return positions;
  }, []);

  // Hybrid refinement: Apply micro-forces to resolve remaining overlaps
  const applyHybridRefinement = useCallback((
    initialPositions: Map<string, { x: number; y: number }>,
    nodes: GraphNode[]
  ): Map<string, { x: number; y: number }> => {
    const refinedPositions = new Map(initialPositions);
    const spatialGrid = new SpatialGrid(80); // 80px cells for optimal performance
    
    // Step 1: Populate spatial grid with initial positions
    for (const [nodeId, pos] of refinedPositions.entries()) {
      spatialGrid.insert({ id: nodeId, x: pos.x, y: pos.y, radius: 25 });
    }
    
    // Step 2: Find overlapping pairs (O(n) complexity!)
    const overlappingPairs = spatialGrid.findOverlappingPairs();
    
    if (overlappingPairs.length === 0) {
      WebviewLogger.info(`🎯 HYBRID - No overlaps detected, skipping refinement`);
      return refinedPositions;
    }
    
    WebviewLogger.info(`🎯 HYBRID - Resolving ${overlappingPairs.length} overlapping pairs with micro-forces`);
    
    // Step 3: Apply lightweight repulsive forces (max 3 iterations for performance)
    for (let iteration = 0; iteration < 3; iteration++) {
      let adjustmentsMade = 0;
      
      overlappingPairs.forEach(([node1, node2]) => {
        const pos1 = refinedPositions.get(node1.id);
        const pos2 = refinedPositions.get(node2.id);
        
        if (pos1 && pos2) {
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = 60; // Minimum separation
          
          if (distance < minDistance && distance > 0) {
            // Calculate repulsive force (lightweight)
            const overlap = minDistance - distance;
            const forceStrength = overlap * 0.3; // Gentle adjustment
            const forceX = (dx / distance) * forceStrength;
            const forceY = (dy / distance) * forceStrength;
            
            // Apply forces to both nodes (Newton's 3rd law)
            refinedPositions.set(node1.id, {
              x: pos1.x + forceX * 0.5,
              y: pos1.y + forceY * 0.5
            });
            refinedPositions.set(node2.id, {
              x: pos2.x - forceX * 0.5,
              y: pos2.y - forceY * 0.5
            });
            
            adjustmentsMade++;
          }
        }
      });
      
      // Early termination if minimal adjustments
      if (adjustmentsMade < overlappingPairs.length * 0.1) {
        WebviewLogger.debug(`🎯 HYBRID - Converged after ${iteration + 1} iterations with ${adjustmentsMade} adjustments`);
        break;
      }
    }
    
    WebviewLogger.info(`🎯 HYBRID - Refinement complete, overlaps minimized`);
    return refinedPositions;
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
          
          // Calculate initial positions with our semantic/hierarchical algorithm
          const initialPositions = calculateNodePositions(
            filteredNodes, 
            filteredEdges,
            container.clientWidth, 
            container.clientHeight
          );
          
          // Apply hybrid refinement to resolve overlaps (O(n) performance)
          const refinedPositions = applyHybridRefinement(initialPositions, filteredNodes);
          setNodePositions(refinedPositions);
        }
      }, 500); // Reduced timeout for faster startup
      
      return () => clearTimeout(timer);
    }
  }, [filteredNodes, filteredEdges, calculateNodePositions, applyHybridRefinement]);

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
          // CRITICAL FIX: Dynamic offset based on edge length to keep labels closer to edges
          const baseOffset = Math.min(12, Math.max(6, length * 0.08)); // Adaptive offset: 6-12px based on edge length
          const offsetX = length > 0 ? (dy / length) * baseOffset : 0;
          const offsetY = length > 0 ? (-dx / length) * baseOffset : 0;
          
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
          
          {/* Advanced Filters Toggle */}
          <button 
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--vscode-button-border)',
              borderRadius: '4px',
              background: showFilters ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
              color: showFilters ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🔍 Filters {showFilters ? '▲' : '▼'}
          </button>
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

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--vscode-panel-background)',
          borderBottom: '1px solid var(--vscode-panel-border)',
          display: 'flex',
          gap: '24px'
        }}>
          {/* Relation Filters */}
          <div style={{ flex: 1 }}>
            <h4 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '12px', 
              fontWeight: '500',
              color: 'var(--vscode-editor-foreground)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Relationship Types
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
              gap: '8px',
              maxHeight: '100px',
              overflow: 'auto'
            }}>
              {Array.from(relationFilters.entries()).map(([relationType, isEnabled]) => (
                <label key={relationType} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '11px', 
                  color: 'var(--vscode-foreground)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => {
                      const newFilters = new Map(relationFilters);
                      newFilters.set(relationType, e.target.checked);
                      setRelationFilters(newFilters);
                    }}
                    style={{ marginRight: '2px' }}
                  />
                  {relationType}
                </label>
              ))}
            </div>
          </div>
          
          {/* Node Type Filters */}
          <div style={{ flex: 1 }}>
            <h4 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '12px', 
              fontWeight: '500',
              color: 'var(--vscode-editor-foreground)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Node Types
            </h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
              gap: '8px',
              maxHeight: '100px',
              overflow: 'auto'
            }}>
              {Array.from(nodeTypeFilters.entries()).map(([nodeType, isEnabled]) => (
                <label key={nodeType} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '11px', 
                  color: 'var(--vscode-foreground)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => {
                      const newFilters = new Map(nodeTypeFilters);
                      newFilters.set(nodeType, e.target.checked);
                      setNodeTypeFilters(newFilters);
                    }}
                    style={{ marginRight: '2px' }}
                  />
                  {nodeType}
                </label>
              ))}
            </div>
          </div>
          
          {/* Filter Actions */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px',
            minWidth: '100px'
          }}>
            <button
              onClick={() => {
                const allEnabled = new Map();
                relationFilters.forEach((_, key) => allEnabled.set(key, true));
                setRelationFilters(allEnabled);
                
                const allNodeEnabled = new Map();
                nodeTypeFilters.forEach((_, key) => allNodeEnabled.set(key, true));
                setNodeTypeFilters(allNodeEnabled);
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid var(--vscode-button-border)',
                borderRadius: '3px',
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              Select All
            </button>
            <button
              onClick={() => {
                const allDisabled = new Map();
                relationFilters.forEach((_, key) => allDisabled.set(key, false));
                setRelationFilters(allDisabled);
                
                const allNodeDisabled = new Map();
                nodeTypeFilters.forEach((_, key) => allNodeDisabled.set(key, false));
                setNodeTypeFilters(allNodeDisabled);
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid var(--vscode-button-border)',
                borderRadius: '3px',
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              Clear All
            </button>
          </div>
        </div>
      )}

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