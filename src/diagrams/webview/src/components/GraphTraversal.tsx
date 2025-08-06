import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GraphTraversalData, GraphNode, GraphEdge } from '../../types/diagramTypes';
import { WebviewLogger } from '../utils/logger';

// Conditional D3 import for force simulation mode
let d3: any = null;
if (typeof window !== 'undefined') {
  try {
    d3 = require('d3');
  } catch (e) {
    WebviewLogger.warn('D3.js not available - using static layout only');
  }
}

interface GraphTraversalProps {
  data: GraphTraversalData;
}

// PERFORMANCE CONFIG - Choose rendering mode
const RENDERING_CONFIG = {
  USE_D3_FORCE_SIMULATION: false, // Set to false for lightweight static layout
  USE_STATIC_LAYOUT: true,        // Set to true for stable performance
  ENABLE_PHYSICS: false,          // Set to true for connected node movement
  DEBUG_PERFORMANCE: true         // Set to true for performance logging
};

export function GraphTraversal({ data }: GraphTraversalProps) {
  WebviewLogger.info(`GRAPH TRAVERSAL - Component rendering: ${data?.nodes?.length || 0} nodes, ${data?.edges?.length || 0} edges, Mode: ${RENDERING_CONFIG.USE_D3_FORCE_SIMULATION ? 'D3 Force' : 'Static'}`);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [containerReady, setContainerReady] = useState(false);
  const [showLegend, setShowLegend] = useState(false); // Hidden by default
  const [nodePositions, setNodePositions] = useState<Map<string, {x: number, y: number}>>(new Map());
  
  // Unified pan/zoom state (removed duplicates)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<any>(null); // Conditional D3 simulation

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

  // Helper function to get node symbol type for hierarchy
  const getNodeSymbolType = (node: GraphNode): string => {
    // Use the same logic as getNodeColor but return just the symbol type
    let symbolKind = node.type || 'unknown';
    const fileExt = node.fileUri ? node.fileUri.split('.').pop() || '' : '';
    const nodeName = node.name ? node.name.toLowerCase() : '';
    
    // If the type doesn't match our hierarchy, try inferring from file extension and name
    const hierarchyTypes = ['productline', 'featureset', 'feature', 'functionset', 'function', 'block', 'reqset', 'requirement', 'testset', 'testcase', 'config'];
    
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

  // Filter nodes based on search and exclude .spr/.agt files
  const filteredNodes = useMemo(() => {
    WebviewLogger.debug('GRAPH TRAVERSAL - Filtering nodes');
    WebviewLogger.debug(`GRAPH TRAVERSAL - Total nodes: ${data.nodes.length}`);
    
    // Filter out .spr and .agt files from traceability
    let nodes = data.nodes.filter(node => {
      const fileExt = node.fileUri ? node.fileUri.split('.').pop() || '' : '';
      return fileExt !== 'spr' && fileExt !== 'agt';
    });
    
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

  // Filter edges based on filtered nodes
  const filteredEdges = useMemo(() => {
    WebviewLogger.debug('GRAPH TRAVERSAL - Filtering edges');
    WebviewLogger.debug(`GRAPH TRAVERSAL - Total edges: ${data.edges.length}`);
    
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filtered = data.edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
    
    WebviewLogger.debug(`GRAPH TRAVERSAL - Filtered edges: ${filtered.length}`);
    return filtered;
  }, [data.edges, filteredNodes]);

  // Helper function to get related nodes - MOVED AFTER filteredEdges to fix hoisting
  const getRelatedNodes = useCallback((nodeId: string | null): Set<string> => {
    try {
      const relatedNodes = new Set<string>();
      if (!nodeId || !filteredEdges) {
        WebviewLogger.debug(`getRelatedNodes: No nodeId or edges, returning empty set`);
        return relatedNodes;
      }

      filteredEdges.forEach(edge => {
        try {
          if (typeof edge.source === 'string' && typeof edge.target === 'string') {
            if (edge.source === nodeId) {
              relatedNodes.add(edge.target);
            } else if (edge.target === nodeId) {
              relatedNodes.add(edge.source);
            }
          } else {
            WebviewLogger.warn(`Invalid edge format: source=${edge.source}, target=${edge.target}`);
          }
        } catch (e) {
          WebviewLogger.error(`Error processing edge: ${JSON.stringify(edge)}, ${e.message}`);
        }
      });

      WebviewLogger.debug(`getRelatedNodes: Found ${relatedNodes.size} related nodes for ${nodeId}`);
      return relatedNodes;
    } catch (e) {
      WebviewLogger.error(`getRelatedNodes error: ${e.message}`);
      return new Set<string>();
    }
  }, [filteredEdges]);

  // Calculate static node positions based on hierarchy
  const calculateNodePositions = useCallback((nodes: GraphNode[], containerWidth: number, containerHeight: number) => {
    const positions = new Map<string, {x: number, y: number}>();
    
    // Define hierarchical levels for Sylang traceability
    const hierarchyLevels = {
      'productline': 0,      // Root level
      'featureset': 1,       // Feature organization
      'feature': 2,          // Features
      'functionset': 3,      // Function organization  
      'function': 4,         // Functions
      'block': 5,            // System blocks
      'reqset': 6,           // Requirement organization
      'requirement': 7,      // Requirements
      'testset': 8,          // Test organization
      'testcase': 9,         // Tests (deepest level)
      'config': -1,          // Config nodes float separate
      'unknown': 10          // Unknown types at the end
    };
    
    const levelWidth = Math.max(150, containerWidth / (Object.keys(hierarchyLevels).length + 1));
    
    // Group nodes by hierarchy level
    const nodesByLevel: { [level: number]: GraphNode[] } = {};
    nodes.forEach(node => {
      const symbolType = getNodeSymbolType(node);
      const level = hierarchyLevels[symbolType] ?? hierarchyLevels['unknown'];
      
      if (!nodesByLevel[level]) {
        nodesByLevel[level] = [];
      }
      nodesByLevel[level].push(node);
    });
    
    // Position nodes in static layout
    Object.entries(nodesByLevel).forEach(([levelStr, levelNodes]) => {
      const level = parseInt(levelStr);
      const x = (level + 1) * levelWidth;
      const verticalSpacing = Math.max(80, containerHeight / (levelNodes.length + 1));
      
      levelNodes.forEach((node, index) => {
        positions.set(node.id, {
          x: x,
          y: (index + 1) * verticalSpacing
        });
      });
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
            container.clientWidth, 
            container.clientHeight
          );
          setNodePositions(positions);
        }
      }, 500); // Reduced timeout for faster startup
      
      return () => clearTimeout(timer);
    }
  }, [filteredNodes, calculateNodePositions]);

  // DUAL RENDERING SYSTEM - D3 Force Simulation OR Static Layout
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || filteredNodes.length === 0) {
      WebviewLogger.debug(`GRAPH TRAVERSAL - Waiting for container or data: svg=${!!svgRef.current}, container=${!!containerRef.current}, ready=${containerReady}, nodes=${filteredNodes.length}`);
      return;
    }

    // Choose rendering mode based on configuration
    if (RENDERING_CONFIG.USE_D3_FORCE_SIMULATION && d3) {
      WebviewLogger.info('RENDERING WITH D3 FORCE SIMULATION');
      renderWithD3ForceSimulation();
    } else {
      WebviewLogger.info('RENDERING WITH STATIC LAYOUT');
      renderWithStaticLayout();
    }
  }, [filteredNodes, filteredEdges, selectedNode, searchTerm, containerReady, nodePositions]);

  // Update transform for static layout when pan or zoom changes
  useEffect(() => {
    if (RENDERING_CONFIG.USE_D3_FORCE_SIMULATION || !svgRef.current) return;
    
    const group = svgRef.current.querySelector('g');
    if (group) {
      group.setAttribute('transform', `translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`);
      WebviewLogger.debug(`TRANSFORM - Updated: translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`);
    }
  }, [panOffset, zoomLevel]);

  // D3 Force Simulation Rendering
  const renderWithD3ForceSimulation = useCallback(() => {
    if (!d3 || !svgRef.current || !containerRef.current) return;
    
    try {
      // If container is not ready but we have the ref, force it
      if (!containerReady && containerRef.current) {
        const container = containerRef.current;
        if (container.clientWidth === 0 || container.clientHeight === 0) {
          WebviewLogger.warn('GRAPH TRAVERSAL - Container has zero dimensions, forcing size');
          container.style.width = '800px';
          container.style.height = '600px';
        }
      }

      WebviewLogger.info('GRAPH TRAVERSAL - Setting up D3 force simulation');
      
      // Stop previous simulation
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
      
      const svg = d3.select(svgRef.current);
      const container = d3.select(containerRef.current);
      
      // Clear previous content
      svg.selectAll("*").remove();
      
      // Get container dimensions
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      
      WebviewLogger.debug(`GRAPH TRAVERSAL - Container dimensions: ${containerWidth} x ${containerHeight}`);
      
      // Create zoom behavior
      const zoomBehavior = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          const { transform } = event;
          setZoomLevel(transform.k);
          setPanOffset({ x: transform.x, y: transform.y });
          
          // Apply transform to the graph group
          svg.select('.graph-group')
            .attr('transform', `translate(${transform.x},${transform.y}) scale(${transform.k})`);
        });
      
      svg.call(zoomBehavior);
      
      // Create graph group
      const graphGroup = svg.append('g').attr('class', 'graph-group');
      
      // Create arrow markers for different edge types
      const relationTypes = [...new Set(filteredEdges.map(e => e.relationType || e.type || 'unknown'))];
      
      graphGroup.append('defs').selectAll('marker')
        .data(relationTypes)
        .enter().append('marker')
        .attr('id', d => `arrow-${d}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', d => getEdgeColor({ relationType: d }));
      
      // The layout algorithm mutates links and nodes, so create a copy
      const links = filteredEdges.map(d => ({...d}));
      const nodes = filteredNodes.map(d => ({...d}));
      
      // Define hierarchical levels for Sylang traceability
      const hierarchyLevels = {
        'productline': 0,      // Root level
        'featureset': 1,       // Feature organization
        'feature': 2,          // Features
        'functionset': 3,      // Function organization  
        'function': 4,         // Functions
        'block': 5,            // System blocks
        'reqset': 6,           // Requirement organization
        'requirement': 7,      // Requirements
        'testset': 8,          // Test organization
        'testcase': 9,         // Tests (deepest level)
        'config': -1,          // Config nodes float separate
        'unknown': 10          // Unknown types at the end
      };
      
      // Apply hierarchical layout
      const levelWidth = containerWidth / (Object.keys(hierarchyLevels).length + 1);
      const levelHeight = containerHeight;
      
      // Group nodes by hierarchy level
      const nodesByLevel: { [level: number]: any[] } = {};
      nodes.forEach(node => {
        // Get the node's symbol type for hierarchy
        const symbolType = getNodeSymbolType(node);
        const level = hierarchyLevels[symbolType] ?? hierarchyLevels['unknown'];
        
        if (!nodesByLevel[level]) {
          nodesByLevel[level] = [];
        }
        nodesByLevel[level].push(node);
      });
      
      WebviewLogger.debug(`GRAPH TRAVERSAL - Nodes by hierarchy level: ${JSON.stringify(nodesByLevel)}`);
      
      // Position nodes in hierarchical layout with initial positions
      Object.entries(nodesByLevel).forEach(([levelStr, levelNodes]) => {
        const level = parseInt(levelStr);
        const x = (level + 1) * levelWidth;
        const verticalSpacing = levelHeight / (levelNodes.length + 1);
        
        levelNodes.forEach((node, index) => {
          // Set initial position
          node.x = x;
          node.y = (index + 1) * verticalSpacing;
          // Don't fix positions - let D3 handle them with constraints
        });
      });
      
      // Create a simulation with better spacing and hierarchical constraints
      const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id((d: any) => d.id).distance(200).strength(0.2))
        .force("charge", d3.forceManyBody().strength(-500))
        .force("collision", d3.forceCollide().radius(45))
        .force("x", d3.forceX((d: any) => {
          const symbolType = getNodeSymbolType(d);
          const level = hierarchyLevels[symbolType] ?? hierarchyLevels['unknown'];
          return (level + 1) * levelWidth;
        }).strength(0.9))
        .force("y", d3.forceY(containerHeight / 2).strength(0.05));
      
      simulationRef.current = simulation;
      
      // Group edges by source-target pairs to handle multiple connections
      const linkGroups = new Map();
      links.forEach((link: any) => {
        const key = `${link.source.id || link.source}-${link.target.id || link.target}`;
        if (!linkGroups.has(key)) {
          linkGroups.set(key, []);
        }
        linkGroups.get(key).push(link);
      });

      // Create curved edges
      const link = graphGroup.append("g")
        .attr("stroke-opacity", 0.8)
        .selectAll("path")
        .data(links)
        .join("path")
        .attr("stroke-width", 2)
        .attr("stroke", (d: any) => getEdgeColor(d))
        .attr("fill", "none")
        .attr("marker-end", (d: any) => `url(#arrow-${d.relationType || d.type || 'unknown'})`);
      
      // Add edge labels
      const edgeLabels = graphGroup.append("g")
        .selectAll("text")
        .data(links)
        .join("text")
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("fill", "var(--vscode-editor-foreground)")
        .style("pointer-events", "none")
        .text((d: any) => d.relationType || 'ref');
      
      // Add nodes
      const node = graphGroup.append("g")
        .attr("stroke", "#999")
        .attr("stroke-width", 1.5)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 25)
        .attr("fill", (d: any) => {
          try {
            const relatedNodes = getRelatedNodes(selectedNode);
            return selectedNode === d.id || relatedNodes.has(d.id) ? '#FF0000' : getNodeColor(d);
          } catch (e) {
            WebviewLogger.error(`Error setting node color for ${d.id}: ${e.message}`);
            return getNodeColor(d);
          }
        })
        .style("cursor", "pointer");
      
      // Add node labels
      const nodeLabels = graphGroup.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("text-anchor", "middle")
        .attr("dy", ".35em")
        .attr("font-size", "11px")
        .attr("fill", "white")
        .attr("font-weight", "bold")
        .style("pointer-events", "none")
        .text((d: any) => {
          const fullName = d.name || 'Unknown';
          return fullName.toString().trim();
        })
        .style("font-size", "11px")
        .style("text-anchor", "middle")
        .style("dominant-baseline", "central")
        .style("white-space", "nowrap")
        .style("overflow", "visible");
      
      // Focus function to center view on a node
      const focusOnNode = (nodeData: any) => {
        const svg = d3.select(svgRef.current);
        const containerRect = containerRef.current.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        
        const scale = 1.5;
        const translateX = centerX - nodeData.x * scale;
        const translateY = centerY - nodeData.y * scale;
        
        svg.transition()
          .duration(750)
          .call(
            zoomBehavior.transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale)
          );
      };
      
      // Improved click behavior - delay to avoid drag interference
      let clickTimeout: any;
      node.on("mousedown", (event, d) => {
        clickTimeout = setTimeout(() => {
          setSelectedNode(selectedNode === d.id ? null : d.id);
          focusOnNode(d);
        }, 150);
      }).on("mouseup", () => {
      }).on("mousemove", () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
        }
      });
      
      // Add drag behavior
      node.call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));
      
      // Set the position attributes of links and nodes each time the simulation ticks
      simulation.on("tick", () => {
        link.attr("d", (d: any) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dr = Math.sqrt(dx * dx + dy * dy);
          
          const key = `${d.source.id}-${d.target.id}`;
          const group = linkGroups.get(key) || [];
          const index = group.indexOf(d);
          const total = group.length;
          
          let sweep = 0;
          if (total > 1) {
            sweep = (index - (total - 1) / 2) * 30;
          }
          
          return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
        });
        
        edgeLabels
          .attr("x", (d: any) => {
            const midX = (d.source.x + d.target.x) / 2;
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            return midX + (dy / length) * 15;
          })
          .attr("y", (d: any) => {
            const midY = (d.source.y + d.target.y) / 2;
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            return midY - (dx / length) * 15;
          });

        node
          .attr("cx", (d: any) => d.x)
          .attr("cy", (d: any) => d.y)
          .attr("fill", (d: any) => {
            try {
              const relatedNodes = getRelatedNodes(selectedNode);
              return selectedNode === d.id || relatedNodes.has(d.id) ? '#FF0000' : getNodeColor(d);
            } catch (e) {
              WebviewLogger.error(`Error updating node color for ${d.id}: ${e.message}`);
              return getNodeColor(d);
            }
          });

        nodeLabels
          .attr("x", (d: any) => d.x)
          .attr("y", (d: any) => d.y);
      });
      
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.1).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
      }
      
      return () => {
        if (simulationRef.current) {
          simulationRef.current.stop();
        }
      };
    } catch (e) {
      WebviewLogger.error(`D3 Force Simulation render error: ${e.message}`);
    }
  }, [filteredNodes, filteredEdges, selectedNode]);

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
    if (!RENDERING_CONFIG.USE_D3_FORCE_SIMULATION && containerRef.current && svgRef.current) {
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
        positions = calculateNodePositions(filteredNodes, containerWidth * 2, containerHeight * 2);
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
    if (RENDERING_CONFIG.USE_D3_FORCE_SIMULATION && d3 && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom().scaleBy as any, 1.2
      );
    } else {
      setZoomLevel(prev => Math.min(5, prev * 1.2));
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (RENDERING_CONFIG.USE_D3_FORCE_SIMULATION && d3 && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom().scaleBy as any, 1 / 1.2
      );
    } else {
      setZoomLevel(prev => Math.max(0.1, prev / 1.2));
    }
  }, []);

  const handleReset = useCallback(() => {
    if (RENDERING_CONFIG.USE_D3_FORCE_SIMULATION && d3 && svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom().transform as any,
        d3.zoomIdentity
      );
    } else {
      setPanOffset({ x: 0, y: 0 });
      setZoomLevel(1);
    }
    setSelectedNode(null);
    setSearchTerm('');
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
            background: RENDERING_CONFIG.USE_D3_FORCE_SIMULATION ? '#FF4444' : '#44AA44',
            color: 'white',
            fontSize: '11px',
            fontWeight: 'bold',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            {RENDERING_CONFIG.USE_D3_FORCE_SIMULATION ? '🔥 D3 Force' : '⚡ Static'}
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