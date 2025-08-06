import { useState, useEffect, useRef } from 'preact/hooks';
import { DiagramNode, DiagramEdge, LayoutOrientation } from '../types/diagramTypes';
import { WebviewLogger } from '../utils/logger.js';
import { usePerformance } from '../hooks/usePerformance';

interface FeatureModelDiagramProps {
  data: any;
}

// Adapted from user's working implementation
type FeatureType = "Mandatory" | "Optional" | "OR" | "Alternative" | "Root";

type FeatureNode = {
  id: string;
  name: string;
  type: FeatureType;
  children: FeatureNode[];
  parent?: FeatureNode | null;
  x?: number;
  y?: number;
  // Config-aware properties
  renderMode?: 'normal' | 'grayed' | 'hidden';
  configInfo?: string;
  isVisible?: boolean;
  // Actual Sylang type
  actualType?: string;
};

type Constraint = {
  type: "requires" | "excludes";
  from: string;
  to: string;
};

// Helper function to measure text and determine box dimensions (from user's code)
function measureTextBox(text: string, maxWidth: number = 120): { width: number; height: number; lines: string[] } {
  const avgCharWidth = 7; // Approximate character width for 12px font
  const lineHeight = 16;
  const padding = 20; // 10px padding on each side
  
  if (text.length * avgCharWidth <= maxWidth - padding) {
    // Single line
    return {
      width: Math.max(80, text.length * avgCharWidth + padding),
      height: 30,
      lines: [text]
    };
  }
  
  // Multi-line wrapping
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length * avgCharWidth <= maxWidth - padding) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is too long, force it on its own line
        lines.push(word);
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  const textWidth = Math.max(...lines.map(line => line.length * avgCharWidth));
  
  return {
    width: Math.max(80, textWidth + padding),
    height: lines.length * lineHeight + 10, // 5px padding top/bottom
    lines
  };
}

// Convert Sylang data to user's FeatureNode format
function convertSylangToFeatureNodes(nodes: DiagramNode[], edges: DiagramEdge[]): { root: FeatureNode | null, constraintEdges: Constraint[] } {
  WebviewLogger.info(`🔧 DIAGRAM - Converting ${nodes.length} Sylang nodes to FeatureNode format`);
  
  // Debug: Log all received nodes and their properties - FIXED ITERATION
  nodes.forEach((node, index) => {
    try {
      // Handle properties safely - they come as plain objects from JSON serialization
      const props = node.properties || {};
      const propsString = typeof props === 'object' ? JSON.stringify(props) : String(props);
      WebviewLogger.info(`🔧 DIAGRAM - Node ${index}: ${node.name}, type: ${node.type}, properties: ${propsString}`);
    } catch (error) {
      WebviewLogger.error(`🔧 DIAGRAM - Error logging node ${index}: ${error}`);
    }
  });
  
  // Debug: Log all received edges
  edges.forEach((edge, index) => {
    WebviewLogger.info(`🔧 DIAGRAM - Edge ${index}: ${edge.source} -> ${edge.target}, type: ${edge.type}`);
  });
  
  // Create node map
  const nodeMap = new Map<string, FeatureNode>();
  const constraintEdges: Constraint[] = [];
  
  // Convert nodes
  nodes.forEach(node => {
    // CRITICAL DEBUG: Check node type and properties
    try {
      const propsType = typeof node.properties;
      const propsString = node.properties ? JSON.stringify(node.properties) : 'null';
      WebviewLogger.info(`🔧 DIAGRAM - Processing node ${node.name}, NODE TYPE: ${node.type}, properties type: ${propsType}, content: ${propsString}`);
    } catch (error) {
      WebviewLogger.error(`🔧 DIAGRAM - Error processing node ${node.name}: ${error}`);
    }
    
    // Determine feature type from constraint type
    let featureType: FeatureType = "Mandatory"; // Changed default to Mandatory
    
    if (node.properties && typeof node.properties === 'object') {
      // Handle plain object (from JSON serialization) - FIXED ITERATION
      const props = node.properties as any;
      let constraintTypeArray: string[] = [];
      
      if (props.constraintType && Array.isArray(props.constraintType)) {
        constraintTypeArray = props.constraintType;
      }
      
      WebviewLogger.info(`🔧 DIAGRAM - Node ${node.name} constraintType: ${JSON.stringify(constraintTypeArray)}`);
      
      if (Array.isArray(constraintTypeArray) && constraintTypeArray.length > 0) {
        const constraintType = constraintTypeArray[0];
        WebviewLogger.info(`🔧 DIAGRAM - Node ${node.name} using constraintType: ${constraintType}`);
        
        switch (constraintType) {
          case 'mandatory': featureType = "Mandatory"; break;
          case 'optional': featureType = "Optional"; break;
          case 'or': featureType = "OR"; break;
          case 'alternative': featureType = "Alternative"; break;
          default: 
            WebviewLogger.warn(`🔧 DIAGRAM - Unknown constraint type: ${constraintType}, defaulting to Mandatory`);
            featureType = "Mandatory";
        }
      } else {
        WebviewLogger.warn(`🔧 DIAGRAM - Node ${node.name} has no constraintType, defaulting to Mandatory`);
      }
    } else {
      WebviewLogger.warn(`🔧 DIAGRAM - Node ${node.name} has no properties, defaulting to Mandatory`);
    }
    
    // Extract config-aware properties
    let renderMode: 'normal' | 'grayed' | 'hidden' = 'normal';
    let configInfo = 'enabled';
    let isVisible = true;
    
    if (node.properties && typeof node.properties === 'object') {
      const props = node.properties as any;
      
      if (props.renderMode && Array.isArray(props.renderMode)) {
        renderMode = props.renderMode[0] as 'normal' | 'grayed' | 'hidden';
      }
      if (props.configInfo && Array.isArray(props.configInfo)) {
        configInfo = props.configInfo[0];
      }
      if (props.isVisible && Array.isArray(props.isVisible)) {
        isVisible = props.isVisible[0] === 'true';
      }
    }
    
    WebviewLogger.info(`🎨 FEATURE MODEL - Node ${node.name}: type=${featureType}, renderMode=${renderMode}, configInfo=${configInfo}, isVisible=${isVisible}`);
    
    const featureNode: FeatureNode = {
      id: node.id,
      name: node.name,
      type: featureType,
      children: [],
      parent: null,
      renderMode,
      configInfo,
      isVisible,
      actualType: node.type // Store the actual Sylang node type
    };
    
    nodeMap.set(node.id, featureNode);
    
    // Parse requires/excludes from node properties - FIXED ITERATION
    if (node.properties && typeof node.properties === 'object') {
      const props = node.properties as any;
      
      // Check for requires - handle as plain object
      const requiresArray = props.requires || [];
      if (Array.isArray(requiresArray)) {
        requiresArray.forEach((requiresValue: string) => {
          WebviewLogger.info(`🔧 DIAGRAM - Processing requires: ${requiresValue}`);
          // Handle "ref feature FeatureName" format or just "FeatureName"
          let targetFeature = '';
          if (requiresValue.includes('ref feature')) {
            const match = requiresValue.match(/ref\s+feature\s+(\w+)/);
            if (match) {
              targetFeature = match[1];
            }
          } else {
            // Direct feature name
            targetFeature = requiresValue.trim();
          }
          
          if (targetFeature) {
            constraintEdges.push({
              type: "requires",
              from: node.id,
              to: targetFeature
            });
            WebviewLogger.info(`🔧 DIAGRAM - Added requires constraint: ${node.id} -> ${targetFeature}`);
          }
        });
      }
      
      // Check for excludes - handle as plain object
      const excludesArray = props.excludes || [];
      if (Array.isArray(excludesArray)) {
        excludesArray.forEach((excludesValue: string) => {
          WebviewLogger.info(`🔧 DIAGRAM - Processing excludes: ${excludesValue}`);
          let targetFeature = '';
          if (excludesValue.includes('ref feature')) {
            const match = excludesValue.match(/ref\s+feature\s+(\w+)/);
            if (match) {
              targetFeature = match[1];
            }
          } else {
            targetFeature = excludesValue.trim();
          }
          
          if (targetFeature) {
            constraintEdges.push({
              type: "excludes",
              from: node.id,
              to: targetFeature
            });
            WebviewLogger.info(`🔧 DIAGRAM - Added excludes constraint: ${node.id} -> ${targetFeature}`);
          }
        });
      }
    }
  });
  
  // Build hierarchy
  edges.forEach(edge => {
    if (edge.type === 'hierarchy') {
      const parent = nodeMap.get(edge.source);
      const child = nodeMap.get(edge.target);
      if (parent && child) {
        parent.children.push(child);
        child.parent = parent;
        WebviewLogger.info(`🔧 DIAGRAM - Built hierarchy: ${edge.source} -> ${edge.target}`);
      }
    }
  });
  
  // Find root - should be the featureset (node without parent)
  const roots = Array.from(nodeMap.values()).filter(node => !node.parent);
  let root = roots.length > 0 ? roots[0] : null;
  
  WebviewLogger.info(`🔧 DIAGRAM - Found ${roots.length} root candidates: ${roots.map(r => r.name).join(', ')}`);
  
  // CRITICAL FIX: If multiple roots, we need to create a virtual root to connect them all
  if (roots.length > 1) {
    WebviewLogger.info(`🔧 DIAGRAM - Multiple roots found, creating virtual root to connect: ${roots.map(r => r.name).join(', ')}`);
    
    // Create a virtual root node that connects all top-level features
    const virtualRoot: FeatureNode = {
      id: 'VIRTUAL_ROOT',
      name: 'SylangALMFeatures', // Use the featureset name
      type: "Root",
      children: roots,
      parent: null
    };
    
    // Set all existing roots to have the virtual root as parent
    roots.forEach(r => {
      r.parent = virtualRoot;
    });
    
    root = virtualRoot;
    nodeMap.set('VIRTUAL_ROOT', virtualRoot);
    
    WebviewLogger.info(`🔧 DIAGRAM - Created virtual root: ${virtualRoot.name} with ${roots.length} children`);
  } else if (roots.length === 1) {
    // Single root - just mark it as Root type
    root = roots[0];
    root.type = "Root";
    WebviewLogger.info(`🔧 DIAGRAM - Single root found: ${root.name}`);
  } else {
    // No roots found - this is a problem
    WebviewLogger.error(`🔧 DIAGRAM - No root nodes found! All nodes: ${Array.from(nodeMap.values()).map(n => `${n.name}(parent:${n.parent || 'none'})`).join(', ')}`);
    
    // Try to find nodes without parents as fallback
    const nodesWithoutParent = Array.from(nodeMap.values()).filter(node => !node.parent);
    if (nodesWithoutParent.length > 0) {
      root = nodesWithoutParent[0];
      root.type = "Root";
      WebviewLogger.info(`🔧 DIAGRAM - Fallback: Using first node without parent as root: ${root.name}`);
    } else {
      WebviewLogger.error(`🔧 DIAGRAM - No nodes without parents found! This is a critical error.`);
    }
  }
  
  // Count actual constraints (requires/excludes edges)
  const actualConstraintCount = edges.filter(edge => edge.type === 'requires' || edge.type === 'excludes').length;
  
  WebviewLogger.info(`🔧 DIAGRAM - Conversion complete. Root: ${root.name}, Constraints: ${actualConstraintCount}`);
  
  return { root, constraintEdges };
}

// Layout function adapted from user's code
function layoutAndGetBounds(rootNode: FeatureNode) {
  const xGap = 140;
  const yGap = 80;
  const padding = 50;
  let nextX = padding;

  // First pass: measure all text boxes and store dimensions
  const nodeDimensions = new Map<string, { width: number; height: number; lines: string[] }>();
  
  function measureAllNodes(node: FeatureNode) {
    const dimensions = measureTextBox(node.name);
    nodeDimensions.set(node.id, dimensions);
    node.children.forEach(measureAllNodes);
  }
  measureAllNodes(rootNode);

  function postOrderTraversal(node: FeatureNode, depth: number) {
    node.children.forEach(child => postOrderTraversal(child, depth + 1));
    
    const dimensions = nodeDimensions.get(node.id)!;
    node.y = padding + depth * yGap;

    if (node.children.length === 0) {
      node.x = nextX;
      nextX += Math.max(xGap, dimensions.width + 20);
    } else {
      const firstChild = node.children[0];
      const lastChild = node.children[node.children.length - 1];
      if (firstChild.x && lastChild.x) {
        node.x = (firstChild.x + lastChild.x) / 2;
      } else if (firstChild.x) {
        node.x = firstChild.x;
      }
    }
  }

  postOrderTraversal(rootNode, 0);

  const allNodes: FeatureNode[] = [];
  const nodesById: Record<string, FeatureNode> = {};
  function collectNodes(node: FeatureNode) {
    allNodes.push(node);
    nodesById[node.id] = node;
    node.children.forEach(collectNodes);
  }
  collectNodes(rootNode);

  // Calculate bounds considering dynamic box sizes
  const xs = allNodes.map(n => {
    const dims = nodeDimensions.get(n.id)!;
    return (n.x || 0) + dims.width / 2;
  });
  const ys = allNodes.map(n => {
    const dims = nodeDimensions.get(n.id)!;
    return (n.y || 0) + dims.height / 2;
  });

  const maxX = Math.max(0, ...xs);
  const maxY = Math.max(0, ...ys);

  const width = maxX + padding;
  const height = maxY + padding;

  return { nodesById, width, height, nodeDimensions };
}

// PNG Download function - FIXED VERSION
function downloadPNG(svgElement: SVGElement, filename: string = 'feature-model.png') {
  WebviewLogger.info(`🔧 DIAGRAM - Starting PNG download: ${filename}`);
  
  try {
    // Create a new SVG with white background
    const svgClone = svgElement.cloneNode(true) as SVGElement;
    const svgRect = svgElement.getBoundingClientRect();
    
    // Set explicit dimensions
    svgClone.setAttribute('width', svgRect.width.toString());
    svgClone.setAttribute('height', svgRect.height.toString());
    
    // Add white background
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'white');
    svgClone.insertBefore(rect, svgClone.firstChild);
    
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        WebviewLogger.error('🔧 DIAGRAM - Could not get canvas context');
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.drawImage(img, 0, 0);
      
      // Download
      canvas.toBlob((blob) => {
        if (blob) {
          const link = document.createElement('a');
          link.download = filename;
          link.href = URL.createObjectURL(blob);
          link.click();
          WebviewLogger.info('🔧 DIAGRAM - PNG download completed');
        }
      }, 'image/png');
      
      URL.revokeObjectURL(url);
    };
    
    img.onerror = function() {
      WebviewLogger.error('🔧 DIAGRAM - Failed to load SVG as image');
    };
    
    img.src = url;
  } catch (error) {
    WebviewLogger.error(`🔧 DIAGRAM - PNG download error: ${error}`);
  }
}

export function FeatureModelDiagram({ data }: FeatureModelDiagramProps) {
  // State management for pan/zoom - using refs for immediate updates
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { reportMetrics } = usePerformance();

  // Auto-refresh on data changes (real-time updates)
  useEffect(() => {
    WebviewLogger.info('🔧 DIAGRAM - Real-time update: FeatureModelDiagram rendering with user\'s proven approach');
    
    if (!data?.nodes || !data?.edges) {
      WebviewLogger.warn('🔧 DIAGRAM - No valid data for rendering');
      return;
    }

    const startTime = performance.now();
    
    try {
      // Convert Sylang data to user's format
      const { root, constraintEdges } = convertSylangToFeatureNodes(data.nodes, data.edges);
      
      if (!root) {
        WebviewLogger.warn('🔧 DIAGRAM - No root node found');
        if (containerRef.current) {
          containerRef.current.innerHTML = '<div style="padding: 20px; text-align: center;">No root feature found in the model</div>';
        }
        return;
      }

      // Use user's layout algorithm
      const { nodesById, width, height, nodeDimensions } = layoutAndGetBounds(root);
      
      const actualNodeCount = Object.keys(nodesById).length;
      // Count actual constraints (requires/excludes edges)
      const sylangEdges = data.edges.filter(edge => edge.type === 'requires' || edge.type === 'excludes');
      const actualConstraintCount = sylangEdges.length;
      
      WebviewLogger.info(`🔧 DIAGRAM - Layout complete: ${actualNodeCount} nodes, ${actualConstraintCount} constraints, ${width}x${height} canvas`);

      // Render using user's SVG approach with pan/zoom
      const svgContent = `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #fafafa;">
          <!-- Clean Header without title -->
          <div style="padding: 10px; background: #f5f5f5; border-bottom: 1px solid #ddd; display: flex; gap: 10px; align-items: center; justify-content: space-between;">
            <div style="display: flex; gap: 10px; align-items: center;">
              <span style="color: #666;">Nodes: ${actualNodeCount} | Constraints: ${actualConstraintCount}</span>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
              <span style="font-size: 12px; color: #666;" id="zoomDisplay">Zoom: 100%</span>
              <button id="refreshBtn" style="padding: 6px 12px; border: 1px solid #ccc; background: white; cursor: pointer; border-radius: 4px; font-size: 12px;">🔄 Refresh</button>
              <button id="downloadBtn" style="padding: 6px 12px; border: 1px solid #ccc; background: white; cursor: pointer; border-radius: 4px; font-size: 12px;">📁 PNG</button>
            </div>
          </div>
          
          <!-- SVG Container with pan/zoom -->
          <div style="flex: 1; overflow: hidden; position: relative; cursor: grab;" id="svgContainer">
            <svg id="mainSvg" width="${width}" height="${height}" style="transform: scale(1) translate(0px, 0px); transform-origin: 0 0;">
              <!-- Markers for different feature types -->
              <defs>
                <marker id="solidCircle" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
                  <circle cx="5" cy="5" r="4" fill="#333" />
                </marker>
                <marker id="emptyCircle" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
                  <circle cx="5" cy="5" r="3.25" fill="white" stroke="#333" stroke-width="1.5" />
                </marker>
                <marker id="solidTriangle" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
                  <polygon points="2,2 8,5 2,8" fill="#333" />
                </marker>
                <marker id="emptyTriangle" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
                  <polygon points="2,2 8,5 2,8" fill="white" stroke="#333" stroke-width="1.5" />
                </marker>
                <marker id="constraintArrowGreen" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M 2,1 L 8,4 L 2,7" fill="none" stroke="#10B981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </marker>
                <marker id="constraintArrowRed" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M 2,1 L 8,4 L 2,7" fill="none" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </marker>
              </defs>

              <!-- Tree edges -->
              ${(() => {
                const edges: string[] = [];
                
                function walk(node: FeatureNode) {
                  node.children.forEach(child => {
                    if (!node.x || !node.y || !child.x || !child.y) return;
                    
                    const fromDims = nodeDimensions.get(node.id)!;
                    const toDims = nodeDimensions.get(child.id)!;
                    
                    // Determine marker based on DESTINATION feature type (not source)
                    let marker = "url(#emptyCircle)"; // Default for Optional
                    WebviewLogger.info(`🔧 DIAGRAM - Edge ${node.name} -> ${child.name}: child type = ${child.type}`);
                    
                    if (child.type === "Mandatory") marker = "url(#solidCircle)";
                    else if (child.type === "Optional") marker = "url(#emptyCircle)";
                    else if (child.type === "OR") marker = "url(#solidTriangle)";
                    else if (child.type === "Alternative") marker = "url(#emptyTriangle)";
                    
                    edges.push(`
                      <line
                        x1="${node.x}"
                        y1="${node.y + fromDims.height / 2}"
                        x2="${child.x}"
                        y2="${child.y - toDims.height / 2}"
                        stroke="#555"
                        stroke-width="2"
                        marker-end="${marker}"
                      />
                    `);
                    walk(child);
                  });
                }
                walk(root);
                return edges.join('');
              })()}

              <!-- Constraint edges -->
              ${constraintEdges.map((c, i) => {
                const from = nodesById[c.from];
                const to = nodesById[c.to];
                if (!from || !to || !from.x || !from.y || !to.x || !to.y) return '';
                
                const fromDims = nodeDimensions.get(from.id)!;
                const toDims = nodeDimensions.get(to.id)!;
                
                // Calculate connection points (from user's code)
                const fromCenterX = from.x;
                const fromCenterY = from.y;
                const toCenterX = to.x;
                const toCenterY = to.y;
                
                const dx = toCenterX - fromCenterX;
                const dy = toCenterY - fromCenterY;
                
                // From box connection point
                let fromX, fromY;
                if (Math.abs(dx) > Math.abs(dy)) {
                  fromX = fromCenterX + (dx > 0 ? fromDims.width / 2 : -fromDims.width / 2);
                  fromY = fromCenterY;
                } else {
                  fromX = fromCenterX;
                  fromY = fromCenterY + (dy > 0 ? fromDims.height / 2 : -fromDims.height / 2);
                }
                
                // To box connection point
                let toX, toY;
                if (Math.abs(dx) > Math.abs(dy)) {
                  toX = toCenterX + (dx > 0 ? -toDims.width / 2 : toDims.width / 2);
                  toY = toCenterY;
                } else {
                  toX = toCenterX;
                  toY = toCenterY + (dy > 0 ? -toDims.height / 2 : toDims.height / 2);
                }
                
                // Create curved path
                const midX = (fromX + toX) / 2;
                const midY = (fromY + toY) / 2;
                const curveOffset = 60;
                const controlX = midX + (dy > 0 ? curveOffset : -curveOffset);
                const controlY = midY + (dx > 0 ? -curveOffset : curveOffset);
                
                const pathD = `M ${fromX} ${fromY} Q ${controlX} ${controlY} ${toX} ${toY}`;
                
                const color = c.type === "requires" ? "#10B981" : "#EF4444";
                const label = c.type === "requires" ? "&lt;requires&gt;" : "&lt;excludes&gt;";
                const arrowMarker = c.type === "requires" ? "url(#constraintArrowGreen)" : "url(#constraintArrowRed)";
                
                return `
                  <g>
                    <path
                      d="${pathD}"
                      stroke="${color}"
                      stroke-width="1"
                      fill="none"
                      marker-end="${arrowMarker}"
                      stroke-dasharray="5 5"
                    />
                    <text
                      x="${controlX}"
                      y="${controlY - 5}"
                      text-anchor="middle"
                      font-size="10px"
                      fill="${color}"
                      stroke="white"
                      stroke-width="2"
                      paint-order="stroke fill"
                    >
                      ${label}
                    </text>
                  </g>
                `;
              }).join('')}

              <!-- Feature nodes -->
              ${Object.values(nodesById).map(n => {
                if (!n.x || !n.y) return '';
                
                const dimensions = nodeDimensions.get(n.id)!;
                
                // Determine colors based on feature type and config state
                let boxColor = "#D6D6FF"; // Default
                let strokeColor = "#888";
                let strokeWidth = 1;
                let textColor = "#333";
                let opacity = "1.0";
                
                // DISTINCT COLORS FOR SYLANG NODE TYPES - Use actual node type
                const actualType = n.actualType || n.type || 'feature'; // Get actual type from FeatureNode
                WebviewLogger.info(`🎨 COLOR DEBUG - Node ${n.name}: actualType='${actualType}', n.type='${n.type}', n.actualType='${n.actualType}'`);
                const sylangType = actualType === 'productline' ? 'Product Line' :
                                 actualType === 'featureset' ? 'Feature Set' :
                                 actualType === 'feature' ? 'Feature' :
                                 actualType === 'functionset' ? 'Function Set' :
                                 actualType === 'function' ? 'Function' :
                                 actualType === 'block' ? 'Block' :
                                 actualType === 'requirement' ? 'Requirement' :
                                 actualType === 'testcase' ? 'Test Case' : 
                                 actualType === 'test' ? 'Test Case' :
                                 actualType === 'config' ? 'Config' : 'Unknown';
                
                // DISTINCT COLOR SCHEME - Much more different colors
                if (sylangType === 'Product Line') {
                  boxColor = "#FF6B35"; // Bright Orange
                  strokeColor = "#D84315";
                  strokeWidth = 3;
                } else if (sylangType === 'Feature Set') {
                  boxColor = "#FFD700"; // Gold
                  strokeColor = "#B8860B";
                  strokeWidth = 2;
                } else if (sylangType === 'Feature') {
                  boxColor = "#1E88E5"; // Blue
                  strokeColor = "#0D47A1";
                  strokeWidth = 2;
                } else if (sylangType === 'Function Set') {
                  boxColor = "#FFB300"; // Amber
                  strokeColor = "#F57C00";
                  strokeWidth = 2;
                } else if (sylangType === 'Function') {
                  boxColor = "#00B894"; // Teal
                  strokeColor = "#00695C";
                  strokeWidth = 2;
                } else if (sylangType === 'Block') {
                  boxColor = "#E91E63"; // Pink
                  strokeColor = "#880E4F";
                  strokeWidth = 2;
                } else if (sylangType === 'Requirement') {
                  boxColor = "#7CB342"; // Light Green
                  strokeColor = "#33691E";
                  strokeWidth = 2;
                } else if (sylangType === 'Test Case') {
                  boxColor = "#5E35B1"; // Deep Purple
                  strokeColor = "#311B92";
                  strokeWidth = 2;
                } else if (sylangType === 'Config') {
                  boxColor = "#822659"; // Ruby
                  strokeColor = "#5D1A3E";
                  strokeWidth = 2;
                } else {
                  // Fallback - use old feature type logic for unknown types
                  if (n.type === "Root") {
                    boxColor = "#FF6B35"; // Same as Product Line
                    strokeWidth = 3;
                  } else {
                    boxColor = "#D6D6FF"; // Default light blue
                    strokeColor = "#888";
                  }
                }
                
                // Apply config-aware styling
                if (n.renderMode === 'grayed') {
                  // Gray out disabled nodes (not Ruby - that's for config symbols)
                  boxColor = "#F5F5F5"; // Light Gray
                  strokeColor = "#D1D5DB";
                  textColor = "#9CA3AF";
                  opacity = "0.6";
                  WebviewLogger.debug(`🎨 FEATURE MODEL - Applying grayed styling to node ${n.name} (${n.configInfo})`);
                } else if (n.renderMode === 'hidden') {
                  // Skip hidden nodes completely
                  WebviewLogger.debug(`🎨 FEATURE MODEL - Skipping hidden node ${n.name} (${n.configInfo})`);
                  return '';
                } else {
                  WebviewLogger.debug(`🎨 FEATURE MODEL - Applying ${sylangType} styling to node ${n.name} (${n.configInfo})`);
                }
                
                return `
                  <g opacity="${opacity}">
                    <rect
                      x="${n.x - dimensions.width / 2}"
                      y="${n.y - dimensions.height / 2}"
                      width="${dimensions.width}"
                      height="${dimensions.height}"
                      rx="8"
                      ry="8"
                      fill="${boxColor}"
                      stroke="${strokeColor}"
                      stroke-width="${strokeWidth}"
                    />
                    <!-- Node Name -->
                    ${dimensions.lines.map((line, i) => `
                      <text
                        x="${n.x}"
                        y="${n.y - (dimensions.lines.length - 1) * 8 + i * 16 - 2}"
                        text-anchor="middle"
                        font-size="11px"
                        fill="${textColor}"
                        font-weight="${n.type === "Root" ? "bold" : "600"}"
                      >
                        ${line.replace(/"/g, '')}
                      </text>
                    `).join('')}
                    <!-- Node Type -->
                    <text
                      x="${n.x}"
                      y="${n.y + 8}"
                      text-anchor="middle"
                      font-size="9px"
                      fill="${textColor === '#9CA3AF' ? '#9CA3AF' : '#666'}"
                      font-style="italic"
                    >
                      ${sylangType}
                    </text>
                    ${n.renderMode === 'grayed' ? `
                      <!-- Config disabled indicator -->
                      <text
                        x="${n.x}"
                        y="${n.y + dimensions.height / 2 + 12}"
                        text-anchor="middle"
                        font-size="8px"
                        fill="#9CA3AF"
                        font-style="italic"
                      >
                        config disabled
                      </text>
                    ` : ''}
                  </g>
                `;
              }).join('')}
            </svg>
          </div>
        </div>
      `;

      if (containerRef.current) {
        containerRef.current.innerHTML = svgContent;
        
        // Add event listeners for pan/zoom - FIXED VERSION
        const svgContainer = containerRef.current.querySelector('#svgContainer') as HTMLElement;
        const svg = containerRef.current.querySelector('#mainSvg') as SVGElement;
        const refreshBtn = containerRef.current.querySelector('#refreshBtn') as HTMLButtonElement;
        const downloadBtn = containerRef.current.querySelector('#downloadBtn') as HTMLButtonElement;
        const zoomDisplay = containerRef.current.querySelector('#zoomDisplay') as HTMLElement;
        
        svgRef.current = svg;
        
        if (svgContainer && svg) {
          function updateTransform() {
            const zoom = zoomRef.current;
            const pan = panRef.current;
            svg.style.transform = `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`;
            if (zoomDisplay) {
              zoomDisplay.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
            }
          }
          
          // Mouse wheel zoom
          svgContainer.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.max(0.1, Math.min(3.0, zoomRef.current * delta));
            zoomRef.current = newZoom;
            updateTransform();
            WebviewLogger.info(`🔧 DIAGRAM - Zoom: ${Math.round(newZoom * 100)}%`);
          });
          
          // Mouse pan
          svgContainer.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button === 0) {
              isPanningRef.current = true;
              lastPanPointRef.current = { x: e.clientX, y: e.clientY };
              svgContainer.style.cursor = 'grabbing';
              WebviewLogger.info('🔧 DIAGRAM - Started panning');
            }
          });
          
          document.addEventListener('mousemove', (e: MouseEvent) => {
            if (isPanningRef.current) {
              const newPan = {
                x: panRef.current.x + (e.clientX - lastPanPointRef.current.x) / zoomRef.current,
                y: panRef.current.y + (e.clientY - lastPanPointRef.current.y) / zoomRef.current
              };
              panRef.current = newPan;
              lastPanPointRef.current = { x: e.clientX, y: e.clientY };
              updateTransform();
            }
          });
          
          document.addEventListener('mouseup', () => {
            if (isPanningRef.current) {
              isPanningRef.current = false;
              svgContainer.style.cursor = 'grab';
              WebviewLogger.info('🔧 DIAGRAM - Stopped panning');
            }
          });
        }
        
        // Refresh button
        if (refreshBtn) {
          refreshBtn.addEventListener('click', () => {
            WebviewLogger.info('🔧 DIAGRAM - Refresh button clicked');
            WebviewLogger.info(`🔧 DIAGRAM - VSCode API available: ${!!window.vscode}`);
            
            // Send message to extension to refresh diagram data
            if (window.vscode) {
              WebviewLogger.info('🔧 DIAGRAM - Sending refreshDiagram message to extension');
              window.vscode.postMessage({
                type: 'refreshDiagram'
              });
              WebviewLogger.info('🔧 DIAGRAM - refreshDiagram message sent successfully');
            } else {
              WebviewLogger.warn('🔧 DIAGRAM - VSCode API not available for refresh');
            }
          });
        } else {
          WebviewLogger.warn('🔧 DIAGRAM - Refresh button not found in DOM');
        }
        
        // Download button - FIXED VERSION
        if (downloadBtn && svg) {
          downloadBtn.addEventListener('click', () => {
            downloadPNG(svg, `${root.name}-feature-model.png`);
          });
        }
        
        WebviewLogger.info('🔧 DIAGRAM - Rendering completed successfully with pan/zoom/download');
      }
      
      const renderTime = performance.now() - startTime;
      WebviewLogger.info(`🔧 DIAGRAM - Total rendering time: ${renderTime.toFixed(2)}ms`);
      reportMetrics({ layoutTime: renderTime });
      
    } catch (error) {
      WebviewLogger.error(`🔧 DIAGRAM - Rendering failed: ${error}`);
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div style="padding: 20px; text-align: center; color: red;">Error rendering diagram: ${error}</div>`;
      }
    }
  }, [data]); // Real-time updates on data changes

  // Return simple container - content will be populated by direct DOM manipulation
  return <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
    <div style={{ padding: '20px', textAlign: 'center' }}>Loading diagram...</div>
  </div>;
} 