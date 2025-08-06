import { useState } from 'preact/hooks';
import { WebviewLogger } from '../../utils/logger';

interface DiagramToolbarProps {
  diagramType: string;
}

export function DiagramToolbar({ diagramType }: DiagramToolbarProps) {
  const [zoomLevel, setZoomLevel] = useState(1.0);

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel * 1.2, 4.0);
    setZoomLevel(newZoom);
    // TODO: Implement zoom functionality
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel / 1.2, 0.25);
    setZoomLevel(newZoom);
    // TODO: Implement zoom functionality
  };

  const handleRefresh = () => {
    // TODO: Implement refresh functionality
    WebviewLogger.debug('Refresh diagram');
  };

  return (
    <div className="diagram-toolbar">
      <div className="toolbar-group">
        <button 
          className="toolbar-button" 
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          🔍➖
        </button>
        <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
        <button 
          className="toolbar-button" 
          onClick={handleZoomIn}
          title="Zoom In"
        >
          🔍➕
        </button>
      </div>
      
      <div className="toolbar-group">
        <button 
          className="toolbar-button" 
          onClick={handleRefresh}
          title="Refresh"
        >
          🔄
        </button>
      </div>
    </div>
  );
} 