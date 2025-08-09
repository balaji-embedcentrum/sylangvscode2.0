import { useRef, useEffect, useState, useCallback, useMemo } from 'preact/hooks';
import { memo } from 'preact/compat';
import type { FunctionalComponent } from 'preact';
import type { InternalBlockDiagramData, SylangBlock, SylangPort, SylangConnection } from '../types/diagramTypes';
import { WebviewLogger } from '../utils/logger';

interface InternalBlockDiagramProps {
  data: InternalBlockDiagramData;
}

// Component for rendering individual blocks
const Block: FunctionalComponent<{
  block: SylangBlock;
  onMouseDown: (e: MouseEvent, block: SylangBlock) => void;
}> = memo(({ block, onMouseDown }) => {
  const handleMouseDown = useCallback((e: MouseEvent) => {
    onMouseDown(e, block);
  }, [onMouseDown, block]);

  const inputPorts = block.ports.filter((p: SylangPort) => p.direction === 'in');
  const outputPorts = block.ports.filter((p: SylangPort) => p.direction === 'out');

  // Block colors based on level (light mode)
  const getBlockColor = (level?: string) => {
    switch (level) {
      case 'system': return { fill: '#e3f2fd', stroke: '#1976d2' };
      case 'subsystem': return { fill: '#f3e5f5', stroke: '#7b1fa2' };
      case 'component': return { fill: '#fff3e0', stroke: '#f57c00' };
      case 'module': return { fill: '#e8f5e8', stroke: '#388e3c' };
      default: return { fill: '#f5f5f5', stroke: '#424242' };
    }
  };

  const colors = getBlockColor(block.level);
  const titleY = block.y + 18;
  const subtitleY = titleY + 14;

  return (
    <g
      style={{ 
        cursor: 'grab',
        willChange: 'transform',
        transform: 'translateZ(0)' 
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Main block rectangle */}
      <rect
        x={block.x}
        y={block.y}
        width={block.width}
        height={block.height}
        rx={8}
        ry={8}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={2}
        style={{ 
          willChange: 'transform',
          transform: 'translateZ(0)'
        }}
      />
      
      {/* Block title at top */}
      <text
        x={block.x + block.width / 2}
        y={titleY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14px"
        fill="#000000"
        fontWeight="bold"
        style={{ willChange: 'transform', transform: 'translateZ(0)', userSelect: 'none' }}
      >
        {block.name}
      </text>

      {block.level && (
        <text
          x={block.x + block.width / 2}
          y={subtitleY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10px"
          fill="#666666"
          style={{ willChange: 'transform', transform: 'translateZ(0)', userSelect: 'none' }}
        >
          [{block.level}]
        </text>
      )}
      
      {/* Render input ports on the left */}
      {inputPorts.map((port: SylangPort) => (
        <Port 
          key={`${block.id}-${port.id}`} 
          port={port} 
        />
      ))}
      
      {/* Render output ports on the right */}
      {outputPorts.map((port: SylangPort) => (
        <Port 
          key={`${block.id}-${port.id}`} 
          port={port} 
        />
      ))}
    </g>
  );
});

// Component for rendering individual ports
const Port: FunctionalComponent<{
  port: SylangPort;
}> = memo(({ port }) => {
  // Port colors based on direction and type
  const getPortColor = (direction: string, porttype?: string) => {
    if (direction === 'in') {
      switch (porttype) {
        case 'data': return '#e76f51';
        case 'communication': return '#2a9d8f';
        case 'control': return '#e9c46a';
        case 'power': return '#f4a261';
        default: return '#DC2626';
      }
    } else {
      switch (porttype) {
        case 'data': return '#457b9d';
        case 'communication': return '#16A34A';
        case 'control': return '#ca8a04';
        case 'power': return '#dc2626';
        default: return '#16A34A';
      }
    }
  };

  const portColor = getPortColor(port.direction, port.porttype);
  const isInput = port.direction === 'in';
  
  return (
    <g>
      {/* Port rectangle ON block edge */}
      <rect
        x={port.x}
        y={port.y}
        width={port.width || 4}
        height={port.height || 12}
        fill={portColor}
        stroke="#000"
        strokeWidth={1}
      />
      
      {/* Port name INSIDE block near edge */}
      <text
        x={isInput ? port.x + 8 : port.x - 8}
        y={port.y + (port.height || 12) / 2}
        textAnchor={isInput ? 'start' : 'end'}
        dominantBaseline="middle"
        fill="#000000"
        fontSize="9"
        style={{ userSelect: 'none' }}
      >
        {port.name}
      </text>
    </g>
  );
});

// Component for rendering connections between ports
const Connection: FunctionalComponent<{
  connection: SylangConnection;
  blocks: SylangBlock[];
  index: number;
}> = memo(({ connection, blocks, index }) => {
  // Find source and target ports
  const findPortAndBlock = (portId: string): { port: SylangPort; block: SylangBlock } | null => {
    for (const block of blocks) {
      const port = block.ports.find((p: SylangPort) => p.id === portId);
      if (port) return { port, block };
    }
    return null;
  };

  const fromResult = findPortAndBlock(connection.from);
  const toResult = findPortAndBlock(connection.to);

  if (!fromResult || !toResult) {
    WebviewLogger.warn(`Could not find ports for connection: ${connection.from} -> ${connection.to}`);
    return null;
  }

  // Generate curved path for connection
  const generateConnectionPath = (
    fromPort: SylangPort,
    toPort: SylangPort,
    _fromBlock: SylangBlock,
    _toBlock: SylangBlock,
    _connectionIndex: number
  ): string => {
    const startX = fromPort.x;
    const startY = fromPort.y;
    const endX = toPort.x;
    const endY = toPort.y;

    // Add slight offset for multiple connections (reserved for future use)
    // const offset = connectionIndex * 8;

    // Create smoother curved path with professional control points
    const distance = Math.abs(endX - startX);
    const curvature = Math.min(distance * 0.3, 80); // Adaptive curvature
    const controlPoint1X = startX + curvature;
    const controlPoint1Y = startY;
    const controlPoint2X = endX - curvature;
    const controlPoint2Y = endY;

    return `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${endX} ${endY}`;
  };

  const pathData = generateConnectionPath(
    fromResult.port,
    toResult.port,
    fromResult.block,
    toResult.block,
    index
  );

  return (
    <g>
      {/* Main connection path */}
      <path
        d={pathData}
        stroke="#4f46e5"
        strokeWidth={1.5}
        markerEnd="url(#connection-arrow)"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="none"
        opacity="0.8"
      />
    </g>
  );
});

export function InternalBlockDiagram({ data }: InternalBlockDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState<SylangBlock | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [blocks, setBlocks] = useState<SylangBlock[]>([]);

  // Initialize blocks from data
  useEffect(() => {
    if (data?.blocks) {
      WebviewLogger.info(`INTERNAL INTERNAL BLOCK DIAGRAM - Loading ${data.blocks.length} blocks`);
      setBlocks([...data.blocks]);
    }
  }, [data]);

  // Memoized SVG dimensions
  const { svgWidth, svgHeight } = useMemo(() => {
    return {
      svgWidth: containerRef.current?.clientWidth || 1200,
      svgHeight: containerRef.current?.clientHeight || 800
    };
  }, []);

  // Transform string for pan/zoom
  const transform = useMemo(() => {
    return `translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`;
  }, [panOffset.x, panOffset.y, zoomLevel]);

  // Handle block mouse down (start drag)
  const handleBlockMouseDown = useCallback((e: any, block: SylangBlock) => {
    e.preventDefault();
    e.stopPropagation();
    
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoomLevel;
    const y = (e.clientY - rect.top - panOffset.y) / zoomLevel;

    setIsDragging(true);
    setDragNode(block);
    setDragOffset({
      x: x - block.x,
      y: y - block.y
    });

    WebviewLogger.debug(`INTERNAL BLOCK DIAGRAM - Started dragging block: ${block.name}`);
  }, [panOffset, zoomLevel]);

  // Handle mouse move (dragging)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragNode || !svgRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoomLevel;
    const y = (e.clientY - rect.top - panOffset.y) / zoomLevel;

    const newX = x - dragOffset.x;
    const newY = y - dragOffset.y;

    // Recalculate port positions to stay attached to block edges
    const titleOffset = 48; // Reserve larger space at top for title (match transformer)
    const portWidth = 4;
    const portHeight = 12;

    // Check if we're moving the container block (first block)
    let isContainerBlock = false;
    
    setBlocks((prevBlocks: SylangBlock[]) => {
      isContainerBlock = dragNode.id === prevBlocks[0]?.id;
      
      return prevBlocks.map((block: SylangBlock, index: number) => {
        let blockNewX: number;
        let blockNewY: number;
        
        if (isContainerBlock) {
          // Moving container: all blocks move together
          if (index === 0) {
            // Container block itself
            blockNewX = newX;
            blockNewY = newY;
          } else {
            // Internal blocks: maintain relative position to container
            const containerDeltaX = newX - prevBlocks[0].x;
            const containerDeltaY = newY - prevBlocks[0].y;
            blockNewX = block.x + containerDeltaX;
            blockNewY = block.y + containerDeltaY;
          }
        } else if (block.id === dragNode.id) {
          // Moving individual block
          blockNewX = newX;
          blockNewY = newY;
        } else {
          // Not moving this block
          return block;
        }

        let inputIndex = 0;
        let outputIndex = 0;
        const inputPorts = block.ports.filter(p => p.direction === 'in');
        const outputPorts = block.ports.filter(p => p.direction === 'out');
        
        const updatedPorts = block.ports.map((p: SylangPort) => {
          if (p.direction === 'in') {
            const total = inputPorts.length;
            const usableHeight = Math.max(0, block.height - titleOffset - 12);
            let yPos;
            if (total <= 1) {
              yPos = blockNewY + titleOffset + usableHeight / 2 - portHeight / 2;
            } else {
              const step = usableHeight / (total - 1);
              yPos = blockNewY + titleOffset + inputIndex * step - portHeight / 2;
            }
            
            const updated = {
              ...p,
              x: blockNewX,
              y: yPos,
              width: p.width ?? portWidth,
              height: p.height ?? portHeight
            };
            inputIndex++;
            return updated;
          } else {
            const total = outputPorts.length;
            const usableHeight = Math.max(0, block.height - titleOffset - 12);
            let yPos;
            if (total <= 1) {
              yPos = blockNewY + titleOffset + usableHeight / 2 - portHeight / 2;
            } else {
              const step = usableHeight / (total - 1);
              yPos = blockNewY + titleOffset + outputIndex * step - portHeight / 2;
            }
            
            const updated = {
              ...p,
              x: blockNewX + block.width - portWidth,
              y: yPos,
              width: p.width ?? portWidth,
              height: p.height ?? portHeight
            };
            outputIndex++;
            return updated;
          }
        });

        return { ...block, x: blockNewX, y: blockNewY, ports: updatedPorts };
      });
    });

    // Auto-resize container after moving internal blocks
    if (!isContainerBlock && blocks.length > 1) {
      setBlocks((prevBlocks: SylangBlock[]) => {
        const containerBlock = prevBlocks[0];
        const internalBlocks = prevBlocks.slice(1);
        
        if (internalBlocks.length === 0) return prevBlocks;
        
        // Calculate bounding box of all internal blocks
        const minX = Math.min(...internalBlocks.map(b => b.x));
        const minY = Math.min(...internalBlocks.map(b => b.y));
        const maxX = Math.max(...internalBlocks.map(b => b.x + b.width));
        const maxY = Math.max(...internalBlocks.map(b => b.y + b.height));
        
        // Add margins around internal blocks
        const margin = 60;
        const titleSpace = 40;
        
        const newContainerX = minX - margin;
        const newContainerY = minY - margin - titleSpace;
        const newContainerWidth = (maxX - minX) + (margin * 2);
        const newContainerHeight = (maxY - minY) + (margin * 2) + titleSpace;
        
        // Update container size and position with port repositioning
        const finalWidth = Math.max(newContainerWidth, 400); // Minimum width
        const finalHeight = Math.max(newContainerHeight, 300); // Minimum height
        
        // Reposition container ports to stay attached to edges
        let inputIndex = 0;
        let outputIndex = 0;
        const containerInputPorts = containerBlock.ports.filter(p => p.direction === 'in');
        const containerOutputPorts = containerBlock.ports.filter(p => p.direction === 'out');
        
        const updatedPorts = containerBlock.ports.map((p: SylangPort) => {
          if (p.direction === 'in') {
            const total = containerInputPorts.length;
            const usableHeight = Math.max(0, finalHeight - titleOffset - 12);
            let yPos;
            if (total <= 1) {
              yPos = newContainerY + titleOffset + usableHeight / 2 - portHeight / 2;
            } else {
              const step = usableHeight / (total - 1);
              yPos = newContainerY + titleOffset + inputIndex * step - portHeight / 2;
            }
            
            const updated = {
              ...p,
              x: newContainerX,
              y: yPos,
              width: p.width ?? portWidth,
              height: p.height ?? portHeight
            };
            inputIndex++;
            return updated;
          } else {
            const total = containerOutputPorts.length;
            const usableHeight = Math.max(0, finalHeight - titleOffset - 12);
            let yPos;
            if (total <= 1) {
              yPos = newContainerY + titleOffset + usableHeight / 2 - portHeight / 2;
            } else {
              const step = usableHeight / (total - 1);
              yPos = newContainerY + titleOffset + outputIndex * step - portHeight / 2;
            }
            
            const updated = {
              ...p,
              x: newContainerX + finalWidth - portWidth,
              y: yPos,
              width: p.width ?? portWidth,
              height: p.height ?? portHeight
            };
            outputIndex++;
            return updated;
          }
        });
        
        const updatedContainer = {
          ...containerBlock,
          x: newContainerX,
          y: newContainerY,
          width: finalWidth,
          height: finalHeight,
          ports: updatedPorts
        };
        
        return [updatedContainer, ...internalBlocks];
      });
    }
  }, [isDragging, dragNode, dragOffset, panOffset, zoomLevel]);

  // Handle mouse up (end drag)
  const handleMouseUp = useCallback(() => {
    if (isDragging && dragNode) {
      WebviewLogger.debug(`INTERNAL BLOCK DIAGRAM - Finished dragging block: ${dragNode.name}`);
    }
    setIsDragging(false);
    setDragNode(null);
    setDragOffset({ x: 0, y: 0 });
  }, [isDragging, dragNode]);

  // Handle wheel (zoom)
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, zoomLevel * delta));

    // Zoom towards mouse position
    const zoomChange = newZoom / zoomLevel;
    const newPanX = panOffset.x - (mouseX - panOffset.x) * (zoomChange - 1);
    const newPanY = panOffset.y - (mouseY - panOffset.y) * (zoomChange - 1);

    setZoomLevel(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  }, [zoomLevel, panOffset]);

  // Handle pan (right mouse button drag)
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const handlePanStart = useCallback((e: any) => {
    if (e.button === 2) { // Right mouse button
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [panOffset]);

  const handlePanMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;
    
    const newPanX = e.clientX - panStart.x;
    const newPanY = e.clientY - panStart.y;
    setPanOffset({ x: newPanX, y: newPanY });
  }, [isPanning, panStart]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Event listeners
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Mouse events
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handlePanMove);
    document.addEventListener('mouseup', handlePanEnd);
    
    // Wheel event
    svg.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handlePanMove);
      document.removeEventListener('mouseup', handlePanEnd);
      svg.removeEventListener('wheel', handleWheel);
    };
  }, [handleMouseMove, handleMouseUp, handlePanMove, handlePanEnd, handleWheel]);

  // Early return if no data
  if (!data || !data.blocks || data.blocks.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#ffffff',
        color: '#333333',
        fontSize: '16px'
      }}>
        <div>
          <h3>Internal Block Diagram View</h3>
          <p>No block data available</p>
        </div>
      </div>
    );
  }

  WebviewLogger.info(`INTERNAL BLOCK DIAGRAM - Rendering ${blocks.length} blocks and ${data.connections?.length || 0} connections`);

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100vh', 
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        position: 'relative'
      }}
    >


      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        style={{ 
          display: 'block',
          overflow: 'visible'
        }}
        onMouseDown={handlePanStart}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          {/* Arrow marker for connections */}
          <marker
            id="connection-arrow"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polyline 
              points="0,0 7,3 0,6" 
              fill="#4f46e5"
              stroke="#4f46e5"
              strokeWidth="1"
              opacity="0.8"
            />
          </marker>
        </defs>
        
        <g transform={transform}>
          {/* Render container block first (as background) */}
          {blocks.length > 0 && (
            <Block
              key={`${blocks[0].id}-container`}
              block={blocks[0]}
              onMouseDown={handleBlockMouseDown}
            />
          )}
          
          {/* Render connections (above container, below internal blocks) */}
          {data.connections?.map((connection: SylangConnection, index: number) => (
            <Connection
              key={`${connection.from}-${connection.to}-${index}`}
              connection={connection}
              blocks={blocks}
              index={index}
            />
          ))}
          
          {/* Render internal blocks on top */}
          {blocks.slice(1).map((block: SylangBlock) => (
            <Block
              key={block.id}
              block={block}
              onMouseDown={handleBlockMouseDown}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}