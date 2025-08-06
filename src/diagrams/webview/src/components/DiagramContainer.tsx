import { useState, useEffect } from 'preact/hooks';
import { DiagramType } from '../types/diagramTypes';
import { FeatureModelDiagram } from './FeatureModelDiagram';
import { VariantModelDiagram } from './VariantModelDiagram';
import { InternalBlockDiagram } from './InternalBlockDiagram';
import { GraphTraversal } from './GraphTraversal';
import { TraceTree } from './TraceTree';
import { Tracetable } from './TraceTable';
import { DiagramHeading } from './common/DiagramHeading';
import { DiagramToolbar } from './common/DiagramToolbar';
import { WebviewLogger } from '../utils/logger';

interface DiagramContainerProps {
  diagramData: any;
  diagramType: string;
}

export function DiagramContainer({ diagramData, diagramType }: DiagramContainerProps) {
  WebviewLogger.info('🔧 DIAGRAM CONTAINER - Component rendering');
  WebviewLogger.info(`🔧 DIAGRAM CONTAINER - Props: diagramData=${!!diagramData}, diagramType=${diagramType}`);
  
  if (!diagramData) {
    WebviewLogger.warn('🔧 DIAGRAM CONTAINER - No diagram data provided');
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '16px',
        color: '#666'
      }}>
        No diagram data available
      </div>
    );
  }

  if (!diagramType) {
    WebviewLogger.warn('🔧 DIAGRAM CONTAINER - No diagram type provided');
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '16px',
        color: '#666'
      }}>
        No diagram type specified
      </div>
    );
  }

  WebviewLogger.info(`🔧 DIAGRAM CONTAINER - Rendering diagram type: ${diagramType}`);
  WebviewLogger.info(`🔧 DIAGRAM CONTAINER - Diagram data structure: ${JSON.stringify({
    hasNodes: !!diagramData.nodes,
    nodeCount: diagramData.nodes?.length || 0,
    hasEdges: !!diagramData.edges,
    edgeCount: diagramData.edges?.length || 0,
    hasMetadata: !!diagramData.metadata,
    title: diagramData.metadata?.title || 'unknown'
  })}`);

  const renderDiagram = () => {
    WebviewLogger.info(`🔧 DIAGRAM CONTAINER - Rendering specific diagram component for type: ${diagramType}`);
    
    try {
      switch (diagramType) {
        case DiagramType.FeatureModel:
        case 'feature-model':
          WebviewLogger.info('🔧 DIAGRAM CONTAINER - Rendering FeatureModelDiagram');
          return <FeatureModelDiagram data={diagramData} />;
          
        case DiagramType.VariantModel:
        case 'variant-model':
          WebviewLogger.info('🔧 DIAGRAM CONTAINER - Rendering VariantModelDiagram');
          return <VariantModelDiagram data={diagramData} />;
          
        case DiagramType.InternalBlockDiagram:
        case 'internal-block-diagram':
          WebviewLogger.info('🔧 DIAGRAM CONTAINER - Rendering InternalBlockDiagram');
          WebviewLogger.debug('🔧 DIAGRAM CONTAINER - InternalBlockDiagram data structure:', diagramData);
          // Extract the actual block diagram data from the wrapper
          const blockDiagramData = (diagramData as any).internalBlockDiagramData || diagramData;
          WebviewLogger.debug('🔧 DIAGRAM CONTAINER - Extracted block data:', blockDiagramData);
          return <InternalBlockDiagram data={blockDiagramData} />;
          
        case DiagramType.GraphTraversal:
        case 'graph-traversal':
          WebviewLogger.info('🔧 DIAGRAM CONTAINER - Rendering GraphTraversal');
          return <GraphTraversal data={diagramData} />;
          
        case DiagramType.TraceTree:
        case 'trace-tree':
          WebviewLogger.info('🔧 DIAGRAM CONTAINER - Rendering TraceTree');
          return <TraceTree data={diagramData} />;
          
        case DiagramType.TraceTable:
        case 'trace-table':
          WebviewLogger.info('🔧 DIAGRAM CONTAINER - Rendering TraceTable');
          WebviewLogger.debug(`🔧 DIAGRAM CONTAINER - TraceTable data structure: ${JSON.stringify({
            hasData: !!diagramData,
            hasNodes: !!diagramData?.nodes,
            hasEdges: !!diagramData?.edges,
            nodeCount: diagramData?.nodes?.length || 0,
            edgeCount: diagramData?.edges?.length || 0,
            dataKeys: diagramData ? Object.keys(diagramData) : []
          })}`);
          return <Tracetable data={diagramData} />;
          
        default:
          WebviewLogger.error(`🔧 DIAGRAM CONTAINER - Unknown diagram type: ${diagramType}`);
          return (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100vh',
              fontSize: '16px',
              color: 'red'
            }}>
              Unknown diagram type: {diagramType}
            </div>
          );
      }
    } catch (error) {
      WebviewLogger.error(`🔧 DIAGRAM CONTAINER - Error rendering diagram: ${error}`);
      WebviewLogger.error(`🔧 DIAGRAM CONTAINER - Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontSize: '16px',
          color: 'red'
        }}>
          Error rendering diagram: {error instanceof Error ? error.message : String(error)}
        </div>
      );
    }
  };

  const title = diagramData.metadata?.title || 'Diagram';
  WebviewLogger.info(`🔧 DIAGRAM CONTAINER - Rendering with title: ${title}`);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <DiagramHeading title={title} />
      <DiagramToolbar />
      {renderDiagram()}
    </div>
  );
} 