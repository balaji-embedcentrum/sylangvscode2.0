import { useState, useEffect, useRef } from 'preact/hooks';
import { DiagramNode, DiagramEdge } from '../types/diagramTypes';
import { WebviewLogger } from '../utils/logger.js';
import { usePerformance } from '../hooks/usePerformance';

interface VariantModelDiagramProps { data: any; }

// Keep EXACT same rendering as FeatureModelDiagram
type FeatureType = "Mandatory" | "Optional" | "OR" | "Alternative" | "Root";
type FeatureNode = { id: string; name: string; type: FeatureType; children: FeatureNode[]; parent?: FeatureNode | null; x?: number; y?: number; renderMode?: 'normal' | 'grayed' | 'hidden'; configInfo?: string; isVisible?: boolean; actualType?: string; };
type Constraint = { type: 'requires' | 'excludes'; from: string; to: string };

function measureTextBox(text: string, maxWidth: number = 120): { width: number; height: number; lines: string[] } {
  const avgCharWidth = 7, lineHeight = 16, padding = 20;
  if (text.length * avgCharWidth <= maxWidth - padding) return { width: Math.max(80, text.length * avgCharWidth + padding), height: 30, lines: [text] };
  const words = text.split(' '); const lines: string[] = []; let currentLine = '';
  for (const word of words) { const testLine = currentLine ? `${currentLine} ${word}` : word; if (testLine.length * avgCharWidth <= maxWidth - padding) currentLine = testLine; else { if (currentLine) { lines.push(currentLine); currentLine = word; } else { lines.push(word); } } }
  if (currentLine) lines.push(currentLine);
  const textWidth = Math.max(...lines.map(l => l.length * avgCharWidth));
  return { width: Math.max(80, textWidth + padding), height: lines.length * lineHeight + 10, lines };
}

function convertSylangToFeatureNodes(nodes: DiagramNode[], edges: DiagramEdge[]): { root: FeatureNode | null, constraintEdges: Constraint[] } {
  const nodeMap = new Map<string, FeatureNode>();
  const constraintEdges: Constraint[] = [];

  // Map nodes – use constraintType from properties, default Mandatory; keep actualType
  nodes.forEach(node => {
    let featureType: FeatureType = 'Mandatory';
    const props: any = node.properties || {};
    const ctArr = Array.isArray(props.constraintType) ? props.constraintType : [];
    const ct = ctArr[0];
    if (ct === 'optional') featureType = 'Optional';
    else if (ct === 'or') featureType = 'OR';
    else if (ct === 'alternative') featureType = 'Alternative';
    else if (ct === 'mandatory') featureType = 'Mandatory';

    let renderMode: 'normal' | 'grayed' | 'hidden' = 'normal';
    if (Array.isArray(props.renderMode) && props.renderMode[0] === 'grayed') renderMode = 'grayed';
    if (Array.isArray(props.renderMode) && props.renderMode[0] === 'hidden') renderMode = 'hidden';
    const configInfo = Array.isArray(props.selected) && props.selected[0] === 'false' ? 'unselected' : 'selected';

    const featureNode: FeatureNode = { id: node.id, name: node.name, type: featureType, children: [], parent: null, renderMode, configInfo, isVisible: true, actualType: node.type };
    nodeMap.set(node.id, featureNode);
  });

  // Build hierarchy from edges
  edges.filter(e => e.type === 'hierarchy').forEach(e => { const p = nodeMap.get(e.source); const c = nodeMap.get(e.target); if (p && c) { p.children.push(c); c.parent = p; } });

  // Determine root
  const roots = Array.from(nodeMap.values()).filter(n => !n.parent);
  let root = roots.length > 0 ? roots[0] : null;
  if (root) root.type = 'Root';
  return { root, constraintEdges };
}

function layoutAndGetBounds(rootNode: FeatureNode) {
  const xGap = 140, yGap = 80, padding = 50; let nextX = padding;
  const nodeDimensions = new Map<string, { width: number; height: number; lines: string[] }>();
  (function measureAll(n: FeatureNode){ const d = measureTextBox(n.name); nodeDimensions.set(n.id, d); n.children.forEach(measureAll); })(rootNode);
  (function postOrder(n: FeatureNode, depth: number){ n.children.forEach(c => postOrder(c, depth + 1)); const d = nodeDimensions.get(n.id)!; n.y = padding + depth * yGap; if (n.children.length === 0) { n.x = nextX; nextX += Math.max(xGap, d.width + 20); } else { const f = n.children[0], l = n.children[n.children.length - 1]; if (f.x && l.x) n.x = (f.x + l.x) / 2; else if (f.x) n.x = f.x; } })(rootNode, 0);
  const all: FeatureNode[] = []; (function collect(n: FeatureNode){ all.push(n); n.children.forEach(collect); })(rootNode);
  const maxX = Math.max(0, ...all.map(n => (n.x || 0) + nodeDimensions.get(n.id)!.width / 2));
  const maxY = Math.max(0, ...all.map(n => (n.y || 0) + nodeDimensions.get(n.id)!.height / 2));
  return { nodesById: Object.fromEntries(all.map(n => [n.id, n])), width: maxX + padding, height: maxY + padding, nodeDimensions };
}

function downloadPNG(svgElement: SVGElement, filename: string = 'variant-model.png') { try { const svgClone = svgElement.cloneNode(true) as SVGElement; const r = svgElement.getBoundingClientRect(); svgClone.setAttribute('width', r.width.toString()); svgClone.setAttribute('height', r.height.toString()); const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); rect.setAttribute('width', '100%'); rect.setAttribute('height', '100%'); rect.setAttribute('fill', 'white'); svgClone.insertBefore(rect, svgClone.firstChild); const svgData = new XMLSerializer().serializeToString(svgClone); const url = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })); const img = new Image(); img.onload = function(){ const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) return; canvas.width = img.width; canvas.height = img.height; ctx.fillStyle = 'white'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0); canvas.toBlob(b => { if (b){ const link = document.createElement('a'); link.download = filename; link.href = URL.createObjectURL(b); link.click(); } }, 'image/png'); URL.revokeObjectURL(url); }; img.src = url; } catch (e) { WebviewLogger.error(`PNG export failed: ${e}`);} }

export function VariantModelDiagram({ data }: VariantModelDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef(1.0); const panRef = useRef({ x: 0, y: 0 }); const isPanningRef = useRef(false); const lastPanPointRef = useRef({ x: 0, y: 0 });
  const { reportMetrics } = usePerformance();

  useEffect(() => {
    if (!data?.nodes || !data?.edges) return;
    const start = performance.now();
    try {
      const { root, constraintEdges } = convertSylangToFeatureNodes(data.nodes, data.edges);
      if (!root){ if (containerRef.current) containerRef.current.innerHTML = '<div style="padding:20px;text-align:center;">No root feature found in the model</div>'; return; }
      const { nodesById, width, height, nodeDimensions } = layoutAndGetBounds(root);
      const actualNodeCount = Object.keys(nodesById).length;
      const sylangEdges = data.edges.filter((e: any) => e.type === 'requires' || e.type === 'excludes');
      const actualConstraintCount = sylangEdges.length;

      const svgContent = `
        <div style="width:100%;height:100%;display:flex;flex-direction:column;background:#fafafa;">
          <div style="padding:10px;background:#f5f5f5;border-bottom:1px solid #ddd;display:flex;gap:10px;align-items:center;justify-content:space-between;">
            <div style="display:flex;gap:10px;align-items:center;"><span style="color:#666;">Nodes: ${actualNodeCount} | Constraints: ${actualConstraintCount}</span></div>
            <div style="display:flex;gap:10px;align-items:center;"><span style="font-size:12px;color:#666;" id="zoomDisplay">Zoom: 100%</span><button id="refreshBtn" style="padding:6px 12px;border:1px solid #ccc;background:white;cursor:pointer;border-radius:4px;font-size:12px;">🔄 Refresh</button><button id="downloadBtn" title="Download PNG" style="padding:6px 12px;border:1px solid #ccc;background:white;cursor:pointer;border-radius:4px;font-size:12px;">⬇️ Download</button></div>
          </div>
          <div style="flex:1;overflow:hidden;position:relative;cursor:grab;" id="svgContainer">
            <svg id="mainSvg" width="${width}" height="${height}" style="transform: scale(1) translate(0px, 0px); transform-origin: 0 0;">
              <defs>
                <marker id="solidCircle" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth"><circle cx="5" cy="5" r="4" fill="#333" /></marker>
                <marker id="emptyCircle" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth"><circle cx="5" cy="5" r="3.25" fill="white" stroke="#333" stroke-width="1.5" /></marker>
                <marker id="solidTriangle" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth"><polygon points="2,2 8,5 2,8" fill="#333" /></marker>
                <marker id="emptyTriangle" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth"><polygon points="2,2 8,5 2,8" fill="white" stroke="#333" stroke-width="1.5" /></marker>
                <marker id="constraintArrowGreen" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 2,1 L 8,4 L 2,7" fill="none" stroke="#10B981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></marker>
                <marker id="constraintArrowRed" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 2,1 L 8,4 L 2,7" fill="none" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></marker>
              </defs>
              ${(() => { const edges: string[] = []; function walk(node: FeatureNode){ node.children.forEach(child => { if (!node.x || !node.y || !child.x || !child.y) return; const fromDims = nodeDimensions.get(node.id)!; const toDims = nodeDimensions.get(child.id)!; let marker = "url(#emptyCircle)"; if (child.type === 'Mandatory') marker = 'url(#solidCircle)'; else if (child.type === 'Optional') marker = 'url(#emptyCircle)'; else if (child.type === 'OR') marker = 'url(#solidTriangle)'; else if (child.type === 'Alternative') marker = 'url(#emptyTriangle)'; edges.push(`<line x1="${node.x}" y1="${node.y + fromDims.height / 2}" x2="${child.x}" y2="${child.y - toDims.height / 2}" stroke="#555" stroke-width="2" marker-end="${marker}" />`); walk(child); }); } walk(root); return edges.join(''); })()}
              ${constraintEdges.map((c, i) => { return ''; }).join('')}
              ${Object.values(nodesById).map((n: any) => { if (!n.x || !n.y) return ''; const dimensions = nodeDimensions.get(n.id)!; let boxColor = '#D6D6FF'; let strokeColor = '#888'; let strokeWidth = 1; let textColor = '#333'; let opacity = '1.0'; const actualType = n.actualType || n.type || 'feature'; const sylangType = actualType === 'featureset' ? 'Feature Set' : actualType === 'feature' ? (n.type === 'Mandatory' ? 'Mandatory' : n.type === 'Optional' ? 'Optional' : n.type === 'OR' ? 'OR' : n.type === 'Alternative' ? 'Alternative' : 'Feature') : 'Feature'; if (n.actualType === 'feature' || ['Mandatory','Optional','OR','Alternative'].includes(n.type)) { if (n.type === 'Mandatory'){ boxColor = '#1E88E5'; strokeColor = '#0D47A1'; } else if (n.type === 'Optional'){ boxColor = '#34D399'; strokeColor = '#047857'; } else if (n.type === 'OR'){ boxColor = '#F59E0B'; strokeColor = '#B45309'; } else if (n.type === 'Alternative'){ boxColor = '#EF4444'; strokeColor = '#991B1B'; } strokeWidth = 2; } else if (n.type === 'Root') { boxColor = '#FFD700'; strokeColor = '#B8860B'; strokeWidth = 3; } if (n.renderMode === 'grayed'){ boxColor = '#F5F5F5'; strokeColor = '#D1D5DB'; textColor = '#9CA3AF'; opacity = '0.6'; } return `<g opacity=\"${opacity}\"><rect x=\"${n.x - dimensions.width / 2}\" y=\"${n.y - dimensions.height / 2}\" width=\"${dimensions.width}\" height=\"${dimensions.height}\" rx=\"8\" ry=\"8\" fill=\"${boxColor}\" stroke=\"${strokeColor}\" stroke-width=\"${strokeWidth}\" /><text x=\"${n.x}\" y=\"${n.y - (dimensions.lines.length - 1) * 8}\" text-anchor=\"middle\" font-size=\"11px\" fill=\"${textColor}\" font-weight=\"600\">${n.name}</text><text x=\"${n.x}\" y=\"${n.y + 8}\" text-anchor=\"middle\" font-size=\"9px\" fill=\"${n.renderMode==='grayed'?'#9CA3AF':'#666'}\" font-style=\"italic\">${sylangType}</text></g>`; }).join('')}
            </svg>
          </div>
        </div>`;

      if (containerRef.current){ containerRef.current.innerHTML = svgContent; const svgContainer = containerRef.current.querySelector('#svgContainer') as HTMLElement; const svg = containerRef.current.querySelector('#mainSvg') as SVGElement; const refreshBtn = containerRef.current.querySelector('#refreshBtn') as HTMLButtonElement; const downloadBtn = containerRef.current.querySelector('#downloadBtn') as HTMLButtonElement; const zoomDisplay = containerRef.current.querySelector('#zoomDisplay') as HTMLElement; svgRef.current = svg; function updateTransform(){ const z = zoomRef.current; const p = panRef.current; svg.style.transform = `scale(${z}) translate(${p.x}px, ${p.y}px)`; if (zoomDisplay) zoomDisplay.textContent = `Zoom: ${Math.round(z * 100)}%`; } if (svgContainer && svg){ svgContainer.addEventListener('wheel', (e: WheelEvent) => { e.preventDefault(); const delta = e.deltaY > 0 ? 0.9 : 1.1; zoomRef.current = Math.max(0.1, Math.min(3.0, zoomRef.current * delta)); updateTransform(); }); svgContainer.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 0){ isPanningRef.current = true; lastPanPointRef.current = { x: e.clientX, y: e.clientY }; svgContainer.style.cursor = 'grabbing'; } }); document.addEventListener('mousemove', (e: MouseEvent) => { if (isPanningRef.current){ panRef.current = { x: panRef.current.x + (e.clientX - lastPanPointRef.current.x) / zoomRef.current, y: panRef.current.y + (e.clientY - lastPanPointRef.current.y) / zoomRef.current }; lastPanPointRef.current = { x: e.clientX, y: e.clientY }; updateTransform(); } }); document.addEventListener('mouseup', () => { if (isPanningRef.current){ isPanningRef.current = false; svgContainer.style.cursor = 'grab'; } }); }
        if (refreshBtn){ refreshBtn.addEventListener('click', () => { if ((window as any).vscode){ (window as any).vscode.postMessage({ type: 'refreshDiagram' }); } }); }
        if (downloadBtn && svg){ downloadBtn.addEventListener('click', () => { if ((window as any).vscode){ (window as any).vscode.postMessage({ type: 'export', payload: { format: 'png' } }); } else { downloadPNG(svg, `${root.name}-variant-model.png`); } }); }
      }

      const renderTime = performance.now() - start; reportMetrics({ layoutTime: renderTime });
    } catch (e) { WebviewLogger.error(`VariantModel render error: ${e}`); if (containerRef.current) containerRef.current.innerHTML = `<div style="padding:20px;text-align:center;color:red;">Error rendering diagram: ${e}</div>`; }
  }, [data]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }}><div style={{ padding: '20px', textAlign: 'center' }}>Loading diagram...</div></div>;
}