import { DiagramNode, DiagramEdge, LayoutOrientation } from '../types/diagramTypes';
import { WebviewLogger } from '../utils/logger';

export interface HierarchicalLayoutOptions extends LayoutOptions {
  orientation: LayoutOrientation;
  nodeSpacing: number;
  levelSpacing: number;
  constraintIndicators: boolean;
}

interface LayoutOptions {
  orientation: LayoutOrientation;
  nodeSpacing: number;
  levelSpacing: number;
  constraintIndicators: boolean;
}

interface TreeNode {
  id: string;
  name: string;
  children: TreeNode[];
  parent: TreeNode | null;
  level: number;
  width: number;
  height: number;
  constraintType: string;
}

interface LayoutNode {
  id: string;
  name: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  constraintType: string;
}

interface LayoutResult {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  bounds: { x: number; y: number; width: number; height: number };
  performance: {
    layoutTime: number;
    iterationCount: number;
  };
}

export class HierarchicalLayout {
  private options: LayoutOptions;

  constructor(options: LayoutOptions) {
    this.options = options;
    WebviewLogger.info(`🔧 LAYOUT - HierarchicalLayout created with options: ${JSON.stringify(options)}`);
  }

  /**
   * Performs hierarchical tree layout
   */
  layout(nodes: DiagramNode[], edges: DiagramEdge[]): LayoutResult {
    const startTime = performance.now();
    
    WebviewLogger.info(`🔧 LAYOUT - Starting layout with ${nodes.length} nodes and ${edges.length} edges`);

    try {
      // Build tree structure
      WebviewLogger.info('🔧 LAYOUT - Building tree structure');
      const tree = this.buildTree(nodes, edges);
      WebviewLogger.info(`🔧 LAYOUT - Tree structure built successfully. Root: ${tree.id}, children: ${tree.children.length}`);
      
      // Calculate layout
      WebviewLogger.info('🔧 LAYOUT - Calculating layout positions');
      const layoutNodes = this.calculateLayout(tree);
      WebviewLogger.info(`🔧 LAYOUT - Layout positions calculated. Generated ${layoutNodes.length} layout nodes`);
      
      // Calculate bounds
      WebviewLogger.info('🔧 LAYOUT - Calculating bounds');
      const bounds = this.calculateBounds(layoutNodes);
      WebviewLogger.info(`🔧 LAYOUT - Bounds calculated: ${JSON.stringify(bounds)}`);
      
      // Update original nodes with calculated positions
      WebviewLogger.info('🔧 LAYOUT - Updating original nodes with positions');
      const updatedNodes = nodes.map(node => {
        const layoutNode = layoutNodes.find(n => n.id === node.id);
        if (layoutNode) {
          return { ...node, position: layoutNode.position };
        }
        return node;
      });
      WebviewLogger.info(`🔧 LAYOUT - Updated ${updatedNodes.length} nodes with new positions`);

      const layoutTime = performance.now() - startTime;
      WebviewLogger.info(`🔧 LAYOUT - Layout completed successfully in ${layoutTime.toFixed(2)}ms`);

      return {
        nodes: updatedNodes,
        edges,
        bounds,
        performance: {
          layoutTime,
          iterationCount: 1
        }
      };
    } catch (error) {
      WebviewLogger.error(`🔧 LAYOUT - Layout failed: ${error}`);
      WebviewLogger.error(`🔧 LAYOUT - Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      throw error;
    }
  }

  /**
   * Builds tree structure from nodes and edges
   */
  private buildTree(nodes: DiagramNode[], edges: DiagramEdge[]): TreeNode {
    WebviewLogger.info('🔧 LAYOUT - Starting buildTree');
    const nodeMap = new Map<string, TreeNode>();
    
    // Create tree nodes
    WebviewLogger.info(`🔧 LAYOUT - Creating ${nodes.length} tree nodes`);
    nodes.forEach((node, index) => {
      WebviewLogger.debug(`🔧 LAYOUT - Creating tree node ${index + 1}/${nodes.length}: ${node.id}`);
      
      // Handle properties - they come as plain objects from JSON serialization, not Maps
      let constraintType = 'optional'; // default
      if (node.properties) {
        // Properties is a plain object with key-value pairs where values are arrays
        const constraintTypeArray = (node.properties as any).constraintType;
        if (constraintTypeArray && Array.isArray(constraintTypeArray) && constraintTypeArray.length > 0) {
          constraintType = constraintTypeArray[0];
        }
      }
      WebviewLogger.debug(`🔧 LAYOUT - Node ${node.id} constraint type: ${constraintType}`);
      
      nodeMap.set(node.id, {
        id: node.id,
        name: node.name,
        children: [],
        parent: null,
        level: 0,
        width: node.size.width,
        height: node.size.height,
        constraintType
      });
    });
    WebviewLogger.info(`🔧 LAYOUT - Created ${nodeMap.size} tree nodes in map`);

    // Build parent-child relationships
    WebviewLogger.info(`🔧 LAYOUT - Building parent-child relationships from ${edges.length} edges`);
    let hierarchyEdgeCount = 0;
    edges.forEach((edge, index) => {
      if (edge.type === 'hierarchy') {
        hierarchyEdgeCount++;
        WebviewLogger.debug(`🔧 LAYOUT - Processing hierarchy edge ${hierarchyEdgeCount}: ${edge.source} -> ${edge.target}`);
        const parent = nodeMap.get(edge.source);
        const child = nodeMap.get(edge.target);
        if (parent && child) {
          parent.children.push(child);
          child.parent = parent;
          WebviewLogger.debug(`🔧 LAYOUT - Successfully linked ${edge.source} -> ${edge.target}`);
        } else {
          WebviewLogger.warn(`🔧 LAYOUT - Could not find nodes for edge: ${edge.source} -> ${edge.target}. Parent: ${!!parent}, Child: ${!!child}`);
        }
      }
    });
    WebviewLogger.info(`🔧 LAYOUT - Processed ${hierarchyEdgeCount} hierarchy edges`);

    // Find root nodes (nodes without parents)
    const roots = Array.from(nodeMap.values()).filter(node => !node.parent);
    WebviewLogger.info(`🔧 LAYOUT - Found ${roots.length} root nodes: ${roots.map(r => r.id).join(', ')}`);
    
    if (roots.length === 0) {
      WebviewLogger.warn('🔧 LAYOUT - No root nodes found, creating virtual root');
      // If no hierarchy edges, treat all nodes as root level
      const virtualRoot: TreeNode = {
        id: 'virtual-root',
        name: 'Virtual Root',
        children: Array.from(nodeMap.values()),
        parent: null,
        level: -1,
        width: 0,
        height: 0,
        constraintType: 'mandatory'
      };
      WebviewLogger.info(`🔧 LAYOUT - Created virtual root with ${virtualRoot.children.length} children`);
      return virtualRoot;
    }

    // Use the first root as the main root
    const root = roots[0];
    WebviewLogger.info(`🔧 LAYOUT - Using root node: ${root.id}`);
    
    WebviewLogger.info('🔧 LAYOUT - Calculating levels');
    this.calculateLevels(root, 0);
    WebviewLogger.info('🔧 LAYOUT - Levels calculated successfully');
    
    return root;
  }

  /**
   * Calculates levels for all nodes in the tree
   */
  private calculateLevels(node: TreeNode, level: number): void {
    node.level = level;
    node.children.forEach(child => {
      this.calculateLevels(child, level + 1);
    });
  }

  /**
   * Calculates layout positions for all nodes
   */
  private calculateLayout(root: TreeNode): LayoutNode[] {
    const layoutNodes: LayoutNode[] = [];
    
    if (this.options.orientation === LayoutOrientation.TopToBottom) {
      this.layoutTopToBottom(root, 0, 0, layoutNodes);
    } else {
      this.layoutLeftToRight(root, 0, 0, layoutNodes);
    }
    
    return layoutNodes;
  }

  /**
   * Layout algorithm for top-to-bottom orientation
   */
  private layoutTopToBottom(node: TreeNode, x: number, y: number, layoutNodes: LayoutNode[]): { width: number, height: number } {
    const nodeWidth = node.width;
    const nodeHeight = node.height;
    
    // Position current node
    layoutNodes.push({
      id: node.id,
      name: node.name,
      position: { x, y },
      size: { width: nodeWidth, height: nodeHeight },
      constraintType: node.constraintType
    });

    if (node.children.length === 0) {
      return { width: nodeWidth, height: nodeHeight };
    }

    // Calculate children layout
    const childrenLayouts = node.children.map(child => {
      return this.layoutTopToBottom(child, 0, y + nodeHeight + this.options.levelSpacing, layoutNodes);
    });

    // Calculate total width needed for children
    const totalChildrenWidth = childrenLayouts.reduce((sum, layout) => sum + layout.width, 0);
    const spacing = (node.children.length - 1) * this.options.nodeSpacing;
    const totalWidth = Math.max(nodeWidth, totalChildrenWidth + spacing);

    // Position children
    let currentX = x + (totalWidth - totalChildrenWidth - spacing) / 2;
    node.children.forEach((child, index) => {
      const childLayout = childrenLayouts[index];
      const childX = currentX + childLayout.width / 2 - child.width / 2;
      
      // Update child position
      const childLayoutNode = layoutNodes.find(n => n.id === child.id);
      if (childLayoutNode) {
        childLayoutNode.position.x = childX;
      }
      
      currentX += childLayout.width + this.options.nodeSpacing;
    });

    // Center current node over children
    const nodeLayoutNode = layoutNodes.find(n => n.id === node.id);
    if (nodeLayoutNode) {
      nodeLayoutNode.position.x = x + (totalWidth - nodeWidth) / 2;
    }

    return { width: totalWidth, height: nodeHeight + this.options.levelSpacing + Math.max(...childrenLayouts.map(l => l.height)) };
  }

  /**
   * Layout algorithm for left-to-right orientation
   */
  private layoutLeftToRight(node: TreeNode, x: number, y: number, layoutNodes: LayoutNode[]): { width: number, height: number } {
    const nodeWidth = node.width;
    const nodeHeight = node.height;
    
    // Position current node
    layoutNodes.push({
      id: node.id,
      name: node.name,
      position: { x, y },
      size: { width: nodeWidth, height: nodeHeight },
      constraintType: node.constraintType
    });

    if (node.children.length === 0) {
      return { width: nodeWidth, height: nodeHeight };
    }

    // Calculate children layout
    const childrenLayouts = node.children.map(child => {
      return this.layoutLeftToRight(child, x + nodeWidth + this.options.levelSpacing, 0, layoutNodes);
    });

    // Calculate total height needed for children
    const totalChildrenHeight = childrenLayouts.reduce((sum, layout) => sum + layout.height, 0);
    const spacing = (node.children.length - 1) * this.options.nodeSpacing;
    const totalHeight = Math.max(nodeHeight, totalChildrenHeight + spacing);

    // Position children
    let currentY = y + (totalHeight - totalChildrenHeight - spacing) / 2;
    node.children.forEach((child, index) => {
      const childLayout = childrenLayouts[index];
      const childY = currentY + childLayout.height / 2 - child.height / 2;
      
      // Update child position
      const childLayoutNode = layoutNodes.find(n => n.id === child.id);
      if (childLayoutNode) {
        childLayoutNode.position.y = childY;
      }
      
      currentY += childLayout.height + this.options.nodeSpacing;
    });

    // Center current node over children
    const nodeLayoutNode = layoutNodes.find(n => n.id === node.id);
    if (nodeLayoutNode) {
      nodeLayoutNode.position.y = y + (totalHeight - nodeHeight) / 2;
    }

    return { width: nodeWidth + this.options.levelSpacing + Math.max(...childrenLayouts.map(l => l.width)), height: totalHeight };
  }

  /**
   * Calculates bounds for all layout nodes
   */
  private calculateBounds(layoutNodes: LayoutNode[]): { x: number; y: number; width: number; height: number } {
    if (layoutNodes.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const minX = Math.min(...layoutNodes.map(n => n.position.x));
    const maxX = Math.max(...layoutNodes.map(n => n.position.x + n.size.width));
    const minY = Math.min(...layoutNodes.map(n => n.position.y));
    const maxY = Math.max(...layoutNodes.map(n => n.position.y + n.size.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
} 