import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { InternalBlockDiagramData, SylangBlock, SylangPort, SylangConnection } from '../types/diagramTypes';
import { WebviewLogger } from '../utils/logger';

interface InternalBlockDiagramProps {
  data: InternalBlockDiagramData;
}

// Component for rendering individual blocks
const Block: React.FC<{
  block: SylangBlock;
  onMouseDown: (e: React.MouseEvent, block: SylangBlock) => void;
}> = React.memo(({ block, onMouseDown }) => {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    onMouseDown(e, block);
  }, [onMouseDown, block]);

  const inputPorts = block.ports.filter(p => p.direction === 'in');
  const outputPorts = block.ports.filter(p => p.direction === 'out');

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
      
      {/* Block name */}
      <text
        x={block.x + block.width / 2}
        y={block.y + block.height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14px"
        fill="#000000"
        fontWeight="bold"
        style={{ 
          willChange: 'transform',
          transform: 'translateZ(0)',
          userSelect: 'none'
        }}
      >
        {block.name}
      </text>
      
      {/* Level indicator */}
      {block.level && (
        <text
          x={block.x + block.width / 2}
          y={block.y + block.height / 2 + 16}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10px"
          fill="#666666"
          style={{ 
            willChange: 'transform',
            transform: 'translateZ(0)',
            userSelect: 'none'
          }}
        >
          [{block.level}]
        </text>
      )}
      
      {/* Render input ports on the left */}
      {inputPorts.map((port) => (
        <Port 
          key={`${block.id}-${port.id}`} 
          port={port} 
          block={block}
        />
      ))}
      
      {/* Render output ports on the right */}
      {outputPorts.map((port) => (
        <Port 
          key={`${block.id}-${port.id}`} 
          port={port} 
          block={block}
        />
      ))}
    </g>
  );
});

// Component for rendering individual ports
const Port: React.FC<{
  port: SylangPort;
  block: SylangBlock;
}> = React.memo(({ port, block }) => {
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
const Connection: React.FC<{
  connection: SylangConnection;
  blocks: SylangBlock[];
  index: number;
}> = React.memo(({ connection, blocks, index }) => {
  // Find source and target ports
  const findPortAndBlock = (portId: string) => {
    for (const block of blocks) {
      const port = block.ports.find(p => p.id === portId);
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
    fromBlock: SylangBlock,
    toBlock: SylangBlock,
    connectionIndex: number
  ): string => {
    const startX = fromPort.x;
    const startY = fromPort.y;
    const endX = toPort.x;
    const endY = toPort.y;

    // Add slight offset for multiple connections
    const offset = connectionIndex * 10;
    const midY = (startY + endY) / 2 + offset;

    // Create curved path
    const controlPoint1X = startX + 50;
    const controlPoint1Y = midY;
    const controlPoint2X = endX - 50;
    const controlPoint2Y = midY;

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
        stroke="#6b7280"
        strokeWidth={2}
        markerEnd="url(#connection-arrow)"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
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
  const handleBlockMouseDown = useCallback((e: React.MouseEvent, block: SylangBlock) => {
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

    setBlocks(prevBlocks => 
      prevBlocks.map(block => 
        block.id === dragNode.id 
          ? { ...block, x: newX, y: newY }
          : block
      )
    );
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

  const handlePanStart = useCallback((e: React.MouseEvent) => {
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
      {/* Toolbar */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        zIndex: 1000,
        backgroundColor: '#f8f9fa',
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #dee2e6',
        color: '#495057',
        fontSize: '12px'
      }}>
        <span>Blocks: {blocks.length} | </span>
        <span>Connections: {data.connections?.length || 0} | </span>
        <span>Zoom: {Math.round(zoomLevel * 100)}% | </span>
        <span>Pan: {Math.round(panOffset.x)}, {Math.round(panOffset.y)}</span>
      </div>

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        backgroundColor: '#f8f9fa',
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #dee2e6',
        color: '#6c757d',
        fontSize: '11px'
      }}>
        <div>Drag blocks to move • Right-click + drag to pan • Scroll to zoom</div>
      </div>

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
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polyline 
              points="0,0 10,3.5 0,7" 
              fill="#6b7280"
              stroke="#6b7280"
              strokeWidth="1"
            />
          </marker>
        </defs>
        
        <g transform={transform}>
          {/* Render connections first (behind blocks) */}
          {data.connections?.map((connection, index) => (
            <Connection
              key={`${connection.from}-${connection.to}-${index}`}
              connection={connection}
              blocks={blocks}
              index={index}
            />
          ))}
          
          {/* Render blocks */}
          {blocks.map((block) => (
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