import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { TraceTreeData, GraphNode, GraphEdge } from '../../types/diagramTypes';

interface TraceTreeProps {
  data: TraceTreeData;
}

export function TraceTree({ data }: TraceTreeProps) {
  console.log('🔧 TRACE TREE - Component rendering with data:', {
    hasData: !!data,
    nodeCount: data?.nodes?.length || 0,
    edgeCount: data?.edges?.length || 0,
    hasHierarchy: !!data?.hierarchy
  });

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [containerReady, setContainerReady] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null);

  // Early return if no data
  if (!data || !data.nodes || data.nodes.length === 0) {
    console.log('🔧 TRACE TREE - No data available, showing fallback');
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
          <h3>Trace Tree View</h3>
          <p>No tree data available</p>
          <p>Data received: {JSON.stringify({
            hasData: !!data,
            nodeCount: data?.nodes?.length || 0,
            edgeCount: data?.edges?.length || 0,
            hasHierarchy: !!data?.hierarchy
          })}</p>
        </div>
      </div>
    );
  }

  console.log('🔧 TRACE TREE - Data available, proceeding with render');

  // Helper functions
  const getNodeColor = (node: any): string => {
    // Bold, vibrant colors for dark mode - inspired by Luminar's palette
    const colors = [
      '#FF6B35', // Vibrant Orange (Luminar-style)
      '#8B5CF6', // Bold Purple
      '#06B6D4', // Electric Cyan
      '#F59E0B', // Golden Amber
      '#EF4444', // Bright Red
      '#10B981', // Emerald Green
      '#8B5CF6', // Deep Purple
      '#F97316', // Orange
      '#EC4899', // Hot Pink
      '#3B82F6', // Electric Blue
      '#84CC16', // Lime Green
      '#F43F5E', // Rose Red
      '#06B6D4', // Sky Blue
      '#A855F7', // Violet
      '#F59E0B'  // Amber
    ];
    const nodeType = node.type || 'unknown';
    const index = nodeType.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Filter nodes based on search
  const filteredNodes = useMemo(() => {
    console.log('🔧 TRACE TREE - Filtering nodes');
    console.log('🔧 TRACE TREE - Total nodes:', data.nodes.length);
    
    if (!searchTerm) {
      console.log('🔧 TRACE TREE - No search term, showing all nodes');
      return data.nodes;
    }
    
    const filtered = data.nodes.filter(node => 
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.fileUri.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    console.log('🔧 TRACE TREE - Filtered nodes:', filtered.length);
    return filtered;
  }, [data.nodes, searchTerm]);

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
          console.log('🔧 TRACE TREE - Container ready:', container.clientWidth, 'x', container.clientHeight);
          setContainerReady(true);
        }
      }, 1000); // Wait 1 second for container to render
      
      return () => clearTimeout(timer);
    }
  }, []);

  // D3 Tree Layout Setup
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.hierarchy || filteredNodes.length === 0) {
      console.log('🔧 TRACE TREE - Waiting for container or data:', {
        hasSvg: !!svgRef.current,
        hasContainer: !!containerRef.current,
        hasHierarchy: !!data.hierarchy,
        nodeCount: filteredNodes.length
      });
      return;
    }
    
    // If container is not ready but we have the ref, force it
    if (!containerReady && containerRef.current) {
      const container = containerRef.current;
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        console.log('🔧 TRACE TREE - Container has zero dimensions, forcing size');
        container.style.width = '800px';
        container.style.height = '600px';
      }
    }

    console.log('🔧 TRACE TREE - Setting up D3 tree layout');
    
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
    
    console.log('🔧 TRACE TREE - Container dimensions:', containerWidth, 'x', containerHeight);
    
    // Create zoom behavior
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        const { transform } = event;
        setZoom(transform.k);
        setPan({ x: transform.x, y: transform.y });
        
        // Apply transform to the tree group
        svg.select('.tree-group')
          .attr('transform', `translate(${transform.x},${transform.y}) scale(${transform.k})`);
      });
    
    svg.call(zoomBehavior);
    
    // Create tree group
    const treeGroup = svg.append('g').attr('class', 'tree-group');
    
    // Compute the tree height
    const root = d3.hierarchy(data.hierarchy);
    const dx = 30;
    const dy = containerWidth / (root.height + 1);

    // Create a tree layout
    const treeLayout = d3.tree().nodeSize([dx, dy]);

    // Sort the tree and apply the layout
    root.sort((a, b) => d3.ascending(a.data.name, b.data.name));
    treeLayout(root);

    // Compute the extent of the tree
    let x0 = Infinity;
    let x1 = -x0;
    root.each(d => {
      if (d.x > x1) x1 = d.x;
      if (d.x < x0) x0 = d.x;
    });

    // Compute the adjusted height of the tree
    const height = x1 - x0 + dx * 2;

    // Create links
    const link = treeGroup.append("g")
      .attr("fill", "none")
      .attr("stroke", "#555")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5)
      .selectAll()
      .data(root.links())
      .join("path")
      .attr("d", d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x));
    
    // Create nodes
    const node = treeGroup.append("g")
      .attr("stroke-linejoin", "round")
      .attr("stroke-width", 3)
      .selectAll()
      .data(root.descendants())
      .join("g")
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        setSelectedNode(selectedNode === d.data.name ? null : d.data.name);
      });

    // Add node circles
    node.append("circle")
      .attr("fill", d => getNodeColor(d.data))
      .attr("r", d => d.children ? 6 : 4)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Add node labels
    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.children ? -8 : 8)
      .attr("text-anchor", d => d.children ? "end" : "start")
      .text(d => d.data.name)
      .attr("fill", "white")
      .attr("font-size", "12px")
      .attr("font-weight", "400")
      .attr("stroke", "rgba(0,0,0,0.3)")
      .attr("stroke-width", "0.5px")
      .attr("paint-order", "stroke");

    // Cleanup function
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [filteredNodes, selectedNode, searchTerm, containerReady, data.hierarchy]);

  // Zoom and pan handlers
  const handleZoomIn = useCallback(() => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom().scaleBy as any, 1.2
      );
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom().scaleBy as any, 1 / 1.2
      );
    }
  }, []);

  const handleReset = useCallback(() => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom().transform as any,
        d3.zoomIdentity
      );
      setSelectedNode(null);
      setSearchTerm('');
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
          }}>{Math.round(zoom * 100)}%</span>
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
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{data.edges.length}</span>
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

      {/* Tree Canvas */}
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
            Loading D3.js tree layout...
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
          {/* Header with close button */}
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
          
          {/* Content */}
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
                Name
              </div>
              <div style={{ 
                color: 'var(--vscode-editor-foreground)', 
                fontSize: '13px',
                fontWeight: '400'
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
                Type
              </div>
              <div style={{ 
                color: 'var(--vscode-editor-foreground)', 
                fontSize: '13px',
                fontWeight: '400'
              }}>
                {selectedNodeData.symbolType}
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
                  Connections
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
    </div>
  );
} 