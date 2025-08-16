import { useState, useEffect, useRef } from 'preact/hooks';
import { UCDActor, UCDFunction, UCDRelationship, UseCaseDiagramData } from '../types/diagramTypes';
import { usePerformance } from '../hooks/usePerformance';

interface UseCaseDiagramProps {
  data: any;
}

// Diagram layout constants
const DIAGRAM_WIDTH = 2000; // Increased for longer chains
const DIAGRAM_HEIGHT = 1200;
const ACTOR_WIDTH = 60;
const ACTOR_HEIGHT = 90;
const FUNCTION_WIDTH = 200; // Increased for longer names
const FUNCTION_HEIGHT = 60;
const MARGIN = 100;
const HIERARCHICAL_H_SPACING = 250; // Increased horizontal spacing for chains
const HIERARCHICAL_V_SPACING = 40;  // Vertical spacing between subtrees/siblings
// Cleaned up - using simple layout now

// Logger function that sends logs back to extension host
const logToExtension = (level: string, message: string, data?: any) => {
  if (typeof window !== 'undefined' && (window as any).vscode) {
    (window as any).vscode.postMessage({
      type: 'log',
      level: level,
      message: `[UCD-WEBVIEW] ${message}`,
      data: data
    });
  }
};

export function UseCaseDiagram({ data }: UseCaseDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [diagramData, setDiagramData] = useState<UseCaseDiagramData | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const { startTimer, endTimer, reportMetrics, reportError } = usePerformance();

  useEffect(() => {
    startTimer();
    logToExtension('info', '🎭 UCD DIAGRAM - Initializing Use Case Diagram');
    
    try {
      if (!data) {
        logToExtension('warn', '🎭 UCD DIAGRAM - No data provided');
        return;
      }

      const ucdData = data as UseCaseDiagramData;
      
      if (!ucdData.actors || !ucdData.functions || !ucdData.relationships) {
        logToExtension('warn', '🎭 UCD DIAGRAM - Invalid UCD data structure');
        return;
      }

      logToExtension('info', `🎭 UCD DIAGRAM - Parsed UCD data: ${ucdData.actors.length} actors, ${ucdData.functions.length} functions, ${ucdData.relationships.length} relationships`);
      logToExtension('info', '🎭 UCD DEBUG - Relationships:', ucdData.relationships.map(r => `${r.source} -> ${r.target} (${r.type}) actorId:${r.actorId || 'NONE'}`));
      logToExtension('info', '🎭 UCD DEBUG - Actors:', ucdData.actors.map(a => `${a.id} (${a.actortype})`));
      logToExtension('info', '🎭 UCD DEBUG - Functions:', ucdData.functions.map(f => `${f.id}`));
      
      setDiagramData(ucdData);
      
      const renderTime = endTimer();
      reportMetrics({
        renderTime,
        nodeCount: ucdData.actors.length + ucdData.functions.length,
        edgeCount: ucdData.relationships.length
      });
      
    } catch (error) {
      logToExtension('error', `🎭 UCD DIAGRAM - Error parsing data: ${error}`);
      reportError(error);
      endTimer();
    }
  }, [data, startTimer, endTimer, reportMetrics, reportError]);

  // Mouse event handlers for pan/zoom
  const handleMouseDown = (e: MouseEvent) => {
    if (e.target === containerRef.current || (e.target as Element)?.tagName === 'svg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      e.preventDefault();
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, zoom * delta));
    
    // Zoom towards mouse position
    const zoomPoint = {
      x: (mouseX - pan.x) / zoom,
      y: (mouseY - pan.y) / zoom
    };
    
    setPan({
      x: mouseX - zoomPoint.x * newZoom,
      y: mouseY - zoomPoint.y * newZoom
    });
    
    setZoom(newZoom);
  };

  const downloadSVG = () => {
    if (!svgRef.current || !diagramData) return;
    
    try {
      // Clone the SVG to avoid modifying the original
      const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
      
      // Remove transform to get the full diagram
      svgClone.style.transform = '';
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);
      
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${diagramData.useCaseName.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      logToExtension('info', '🎭 UCD DIAGRAM - SVG downloaded successfully');
    } catch (error) {
      logToExtension('error', `🎭 UCD DIAGRAM - Download failed: ${error}`);
    }
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Add event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('wheel', handleWheel);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, pan, zoom]);

  // Layout calculation functions
    const calculateFunctionPositions = (functions: UCDFunction[]) => {
    logToExtension('info', `🎭 UCD LAYOUT - SIMPLE layout like user's perfect diagram`);
    
    // SIMPLE horizontal rows just like your diagram
    const positions: Array<{func: UCDFunction, x: number, y: number}> = [];
    
    // Build hierarchy map to understand indentation
    const hierarchyMap = new Map<string, number>();
    functions.forEach(func => {
      hierarchyMap.set(func.id, func.indentLevel || 0);
    });
    
    // Sort functions by original order to preserve DSL sequence
    const sortedFunctions = [...functions].sort((a, b) => {
      const aOrder = functions.indexOf(a);
      const bOrder = functions.indexOf(b);
      return aOrder - bOrder;
    });
    
    // Place functions in simple horizontal rows - exactly like your diagram
    const startX = 250; // Start inside boundary  
    const startY = 150; // Start below title
    const rowHeight = 80; // Space between rows
    const indentWidth = 60; // Indentation per level
    
    sortedFunctions.forEach((func, index) => {
      const indentLevel = func.indentLevel || 0;
      const x = startX + (indentLevel * indentWidth); // Indent based on hierarchy
      const y = startY + (index * rowHeight); // Simple vertical layout
      
      positions.push({ func, x, y });
      logToExtension('info', `🎭 UCD LAYOUT - ${func.functionName} at (${x}, ${y}) indent:${indentLevel}`);
    });
    
    return positions;
  };

  const placeSubtree = (
    func: UCDFunction,
    x: number,
    startY: number,
    positions: Array<{func: UCDFunction, x: number, y: number}>,
    childrenMap: Map<string, UCDFunction[]>
  ): { minY: number, maxY: number } => {
    const children = childrenMap.get(func.id) || [];
    let childMinY = Infinity;
    let childMaxY = -Infinity;
    let currentChildY = startY;

    // Recursively place children subtrees with better distribution for deeper levels
    children.forEach((child, index) => {
      // Add vertical variation for deeper levels (level 2, 3, etc.)
      const childYOffset = index * HIERARCHICAL_V_SPACING * 1.5; // More spacing for children
      const childY = currentChildY + childYOffset;
      const { minY, maxY } = placeSubtree(child, x + HIERARCHICAL_H_SPACING, childY, positions, childrenMap);
      childMinY = Math.min(childMinY, minY);
      childMaxY = Math.max(childMaxY, maxY);
      currentChildY = Math.max(currentChildY, maxY + HIERARCHICAL_V_SPACING);
    });

    // Calculate y for this function (center on children if any)
    let y: number;
    if (children.length > 0) {
      y = (childMinY + childMaxY) / 2;
    } else {
      y = startY;
    }

    positions.push({ func, x, y });

    // Calculate subtree bounds
    const halfHeight = FUNCTION_HEIGHT / 2;
    const minY = children.length > 0 ? Math.min(childMinY, y - halfHeight) : y - halfHeight;
    const maxY = children.length > 0 ? Math.max(childMaxY, y + halfHeight) : y + halfHeight;

    return { minY, maxY };
  };

  // Render functions
  const renderActor = (actor: UCDActor, x: number, y: number) => {
    const strokeColor = actor.actortype === 'primary' ? '#0369a1' : '#ea580c';
    
    return (
      <g key={actor.id} id={`actor-${actor.id}`}>
        {/* Head */}
        <circle
          cx={x + 30}
          cy={y + 15}
          r="8"
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
        />
        
        {/* Body */}
        <line
          x1={x + 30}
          y1={y + 23}
          x2={x + 30}
          y2={y + 45}
          stroke={strokeColor}
          strokeWidth="2"
        />
        
        {/* Arms */}
        <line
          x1={x + 15}
          y1={y + 32}
          x2={x + 45}
          y2={y + 32}
          stroke={strokeColor}
          strokeWidth="2"
        />
        
        {/* Legs */}
        <line
          x1={x + 30}
          y1={y + 45}
          x2={x + 20}
          y2={y + 65}
          stroke={strokeColor}
          strokeWidth="2"
        />
        <line
          x1={x + 30}
          y1={y + 45}
          x2={x + 40}
          y2={y + 65}
          stroke={strokeColor}
          strokeWidth="2"
        />
        
        {/* Actor name */}
        <text
          x={x + 30}
          y={y + 80}
          textAnchor="middle"
          fontSize="12"
          fill={strokeColor}
          fontWeight="500"
        >
          {actor.name}
        </text>
        
        {/* Actor type */}
        <text
          x={x + 30}
          y={y + 95}
          textAnchor="middle"
          fontSize="10"
          fill="#666"
        >
          ({actor.actortype})
        </text>
      </g>
    );
  };

  const renderFunction = (func: UCDFunction, x: number, y: number) => {
    return (
      <g key={func.id} id={`function-${func.id}`}>
        {/* Function ellipse */}
        <ellipse
          cx={x + FUNCTION_WIDTH / 2}
          cy={y + FUNCTION_HEIGHT / 2}
          rx={FUNCTION_WIDTH / 2}
          ry={FUNCTION_HEIGHT / 2}
          fill="#f0f9ff"
          stroke="#0369a1"
          strokeWidth="2"
        />
        
        {/* Function name */}
        <text
          x={x + FUNCTION_WIDTH / 2}
          y={y + FUNCTION_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fill="#0369a1"
          fontWeight="500"
        >
          {func.functionName.length > 25 ? 
            func.functionName.substring(0, 23) + '...' : 
            func.functionName
          }
        </text>
      </g>
    );
  };

  const renderSystemBoundary = (x: number, y: number, width: number, height: number, title: string) => {
    return (
      <g key="system-boundary">
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="none"
          stroke="#374151"
          strokeWidth="2"
          strokeDasharray="10,5"
          rx="8"
        />
        
        <text
          x={x + 15}
          y={y + 25}
          fill="#374151"
          fontSize="14"
          fontWeight="600"
        >
          {title}
        </text>
      </g>
    );
  };

  const renderConnection = (
    startX: number, startY: number, 
    endX: number, endY: number, 
    relationshipType: string,
    isPrimaryToFunction: boolean,
    isSecondaryToFunction: boolean
  ) => {
    // CLEAN SIMPLE COLORS - like your perfect diagram
    const strokeColor = '#333';
    const strokeDashArray = relationshipType === 'includes' ? '6,4' : 'none';
    
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    return (
      <g key={`connection-${startX}-${startY}-${endX}-${endY}`}>
        {/* SIMPLE straight line - exactly like your diagram */}
        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeDasharray={strokeDashArray}
        />
        
        {/* Simple arrow - like your diagram */}
        {(isPrimaryToFunction || isSecondaryToFunction) && (
          <polygon
            points={`${endX-6},${endY-3} ${endX},${endY} ${endX-6},${endY+3}`}
            fill={strokeColor}
          />
        )}
        
        {/* Include label - clean and simple */}
        {relationshipType === 'includes' && (
          <text
            x={midX}
            y={midY - 8}
            textAnchor="middle"
            fontSize="9"
            fill="#666"
            fontStyle="italic"
          >
            «include»
          </text>
        )}
      </g>
    );
  };

  const renderDiagram = () => {
    if (!diagramData) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '400px',
          fontSize: '16px',
          color: '#666'
        }}>
          Loading Use Case Diagram...
        </div>
      );
    }

    try {
      logToExtension('info', `🎭 UCD RENDER - Starting diagram rendering with ${diagramData.actors.length} actors, ${diagramData.functions.length} functions`);

    const primaryActors = diagramData.actors.filter(a => a.actortype === 'primary');
    const secondaryActors = diagramData.actors.filter(a => a.actortype === 'secondary');
    
    // Position actors vertically spaced on left/right
    const primaryActorPositions = primaryActors.map((actor, index) => ({
      actor,
      x: MARGIN,
      y: MARGIN + 100 + index * (ACTOR_HEIGHT + 50)
    }));
    
    const secondaryActorPositions = secondaryActors.map((actor, index) => ({
      actor,
      x: DIAGRAM_WIDTH - MARGIN - ACTOR_WIDTH,
      y: MARGIN + 100 + index * (ACTOR_HEIGHT + 50)
    }));
    
    // Calculate all function positions globally
    const allFunctionPositions = calculateFunctionPositions(diagramData.functions);

    // CLEAN SIMPLE BOUNDARY - exactly like your perfect diagram
    const boundaryX = 200; // After primary actors
    const boundaryY = 80;  // Top margin
    const boundaryWidth = DIAGRAM_WIDTH - 400; // Leave space for secondary actors
    const boundaryHeight = DIAGRAM_HEIGHT - 160; // Leave margins
    
    logToExtension('info', `🎭 UCD RENDER - CLEAN boundary: ${boundaryWidth}x${boundaryHeight} at (${boundaryX}, ${boundaryY})`);

    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden',
        background: '#fafafa',
        position: 'relative'
      }}>
        {/* Controls */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: '#fff',
          borderRadius: '6px',
          padding: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000,
          display: 'flex',
          gap: '8px'
        }}>
          <button 
            onClick={() => setZoom(prev => Math.min(3, prev * 1.2))} 
            style={{ 
              padding: '6px 10px', 
              fontSize: '12px', 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            🔍+
          </button>
          <span style={{ fontSize: '12px', alignSelf: 'center', color: '#666' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button 
            onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))} 
            style={{ 
              padding: '6px 10px', 
              fontSize: '12px', 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            🔍-
          </button>
          <button 
            onClick={resetView} 
            style={{ 
              padding: '6px 10px', 
              fontSize: '12px', 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            ↺
          </button>
          <button 
            onClick={downloadSVG} 
            style={{ 
              padding: '6px 10px', 
              fontSize: '12px', 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            💾
          </button>
        </div>
        
        <div style={{ marginBottom: '10px', textAlign: 'center', padding: '15px' }}>
          <h2 style={{ color: '#1f2937', margin: '0 0 5px 0', fontSize: '20px', fontWeight: '600' }}>
            {diagramData.useCaseName}
          </h2>
          <p style={{ color: '#6b7280', margin: '0', fontSize: '13px' }}>
            Use Case Diagram - {diagramData.actors.length} actors, {diagramData.functions.length} functions
          </p>
        </div>
        
        <div 
          ref={containerRef}
          style={{ 
            width: '100%', 
            height: 'calc(100% - 90px)', 
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab',
            background: '#ffffff',
            border: '1px solid #e5e7eb'
          }}
        >
          <svg 
            ref={svgRef}
            width={DIAGRAM_WIDTH} 
            height={DIAGRAM_HEIGHT}
            style={{ 
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              transition: isDragging ? 'none' : 'transform 0.1s ease'
            }}
          >
            {/* System boundary */}
            {renderSystemBoundary(boundaryX, boundaryY, boundaryWidth, boundaryHeight, diagramData.useCaseName)}
            
            {/* Render actors */}
            {primaryActorPositions.map(({ actor, x, y }) => renderActor(actor, x, y))}
            {secondaryActorPositions.map(({ actor, x, y }) => renderActor(actor, x, y))}
            
            {/* Render functions */}
            {allFunctionPositions.map(({ func, x, y }) => renderFunction(func, x, y))}
            
            {/* Render all connections */}
            {(() => {
              logToExtension('info', `🎭 UCD RENDER - Rendering ${diagramData.relationships.length} relationships`);
              return diagramData.relationships.map((rel, index) => {
              // Actor-to-function relationships
              if (rel.actorId) {
                const actorPos = [...primaryActorPositions, ...secondaryActorPositions]
                  .find(p => p.actor.id === rel.actorId);
                const funcPos = allFunctionPositions.find(p => p.func.id === rel.functionId || p.func.id === rel.target);
                
                if (actorPos && funcPos) {
                  const actor = actorPos.actor;
                  const isPrimary = actor.actortype === 'primary';
                  const isSecondary = actor.actortype === 'secondary';
                  
                  const actorCenterX = actorPos.x + ACTOR_WIDTH / 2;
                  const actorCenterY = actorPos.y + ACTOR_HEIGHT / 2;
                  const funcCenterX = funcPos.x + FUNCTION_WIDTH / 2;
                  const funcCenterY = funcPos.y + FUNCTION_HEIGHT / 2;
                  
                  // Primary: Actor -> Function, Secondary: Function -> Actor
                  const startX = isPrimary ? actorCenterX : funcCenterX;
                  const startY = isPrimary ? actorCenterY : funcCenterY;
                  const endX = isPrimary ? funcCenterX : actorCenterX;
                  const endY = isPrimary ? funcCenterY : actorCenterY;
                  
                  return (
                    <g key={`actor-connection-${index}`}>
                      {renderConnection(
                        startX, startY,
                        endX, endY,
                        rel.type,
                        isPrimary,   // isPrimaryToFunction
                        isSecondary  // isFunctionToSecondary
                      )}
                    </g>
                  );
                } else {
                  logToExtension('warn', `🎭 UCD DEBUG - Missing positions for actor-function connection: actorId=${rel.actorId}, functionId=${rel.functionId}, target=${rel.target}`);
                }
              }
              // Function-to-function relationships  
              else {
                const parentFunc = allFunctionPositions.find(p => p.func.id === rel.source);
                const childFunc = allFunctionPositions.find(p => p.func.id === rel.target);
                
                if (parentFunc && childFunc) {
                  const parentCenterX = parentFunc.x + FUNCTION_WIDTH / 2;
                  const parentCenterY = parentFunc.y + FUNCTION_HEIGHT / 2;
                  const childCenterX = childFunc.x + FUNCTION_WIDTH / 2;
                  const childCenterY = childFunc.y + FUNCTION_HEIGHT / 2;
                  
                  return (
                    <g key={`function-connection-${index}`}>
                      {renderConnection(
                        parentCenterX, parentCenterY,
                        childCenterX, childCenterY,
                        rel.type,
                        false,
                        false
                      )}
                    </g>
                  );
                } else {
                  logToExtension('warn', `🎭 UCD DEBUG - Missing positions for function-function connection: source=${rel.source}, target=${rel.target}`);
                }
              }
              return null;
            });
            })()}
          </svg>
        </div>
      </div>
    );
    
    } catch (error) {
      logToExtension('error', `🎭 UCD RENDER - Error rendering diagram: ${error}`);
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '400px',
          fontSize: '16px',
          color: '#ef4444'
        }}>
          Error rendering diagram: {String(error)}
        </div>
      );
    }
  };

  return renderDiagram();
}