import React, { useMemo } from 'react';
import type { GraphTraversalData, GraphNode } from '../types/diagramTypes';
import { WebviewLogger } from '../utils/logger';

interface TracetableProps {
  data: GraphTraversalData;
}

export function Tracetable({ data }: TracetableProps) {
  // Log the actual data structure we receive
  WebviewLogger.info('TRACETABLE - Received data');
  WebviewLogger.debug(`TRACETABLE - Data structure: ${JSON.stringify({
    hasData: !!data,
    dataKeys: data ? Object.keys(data) : [],
    hasNodes: !!data?.nodes,
    hasEdges: !!data?.edges,
    nodeCount: data?.nodes?.length || 0,
    edgeCount: data?.edges?.length || 0
  })}`);

  if (!data || !data.nodes || data.nodes.length === 0) {
    WebviewLogger.warn('TRACETABLE - No valid data, showing fallback');
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
          <h3>Traceability Table View</h3>
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

  WebviewLogger.info('TRACETABLE - Data available, proceeding with render');
  WebviewLogger.debug(`TRACETABLE - Total nodes: ${data.nodes.length}, Total edges: ${data.edges.length}`);
  WebviewLogger.debug(`TRACETABLE - Sample edges: ${JSON.stringify(data.edges.slice(0, 3).map(e => ({source: e.source, target: e.target, type: e.relationType || e.type})))}`);
  WebviewLogger.debug(`TRACETABLE - Sample nodes: ${JSON.stringify(data.nodes.slice(0, 3).map(n => ({id: n.id, name: n.name, type: n.type})))}`);

  // Helper to get node symbol type
  const getNodeSymbolType = (node: GraphNode): string => {
    let symbolKind = node.type || 'unknown';
    const fileExt = node.fileUri ? node.fileUri.split('.').pop() || '' : '';
    
    // Handle specific cases
    if (symbolKind === 'header' || symbolKind === 'definition') {
      if (fileExt === 'ple') return 'productline';
      if (fileExt === 'fml') return 'featureset';
      if (fileExt === 'vml') return 'variantset';
      if (fileExt === 'vcf') return 'configset';
      if (fileExt === 'fun') return 'function';
      if (fileExt === 'req') return 'requirement';
      if (fileExt === 'tst') return 'testcase';
      if (fileExt === 'blk') return 'block';
    }
    
    return symbolKind;
  };

  // Filter out .spr and .agt files
  const filteredNodes = useMemo(() => {
    return data.nodes.filter(node => {
      const fileExt = node.fileUri ? node.fileUri.split('.').pop() || '' : '';
      return !['spr', 'agt'].includes(fileExt);
    });
  }, [data.nodes]);

  // Create a map for quick node lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    filteredNodes.forEach(node => {
      map.set(node.id, node);
    });
    return map;
  }, [filteredNodes]);

  // Build parent-child relationships from edges
  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    data.edges.forEach(edge => {
      // Accept ALL relationship types for now to see the full hierarchy
      const relationType = edge.relationType || edge.type || 'unknown';
      if (!map.has(edge.source)) {
        map.set(edge.source, []);
      }
      map.get(edge.source)!.push(edge.target);
      WebviewLogger.debug(`TRACETABLE - Adding relationship: ${edge.source} -> ${edge.target} (${relationType})`);
    });
    
    WebviewLogger.debug(`TRACETABLE - Built children map with ${map.size} parents`);
    map.forEach((children, parent) => {
      WebviewLogger.debug(`TRACETABLE - Parent ${parent} has ${children.length} children: ${children.join(', ')}`);
    });
    
    return map;
  }, [data.edges]);

  // Define hierarchy levels for sorting
  const hierarchyLevels: Record<string, number> = {
    'productline': 1,
    'featureset': 2,
    'feature': 3,
    'variantset': 4,
    'configset': 5,
    'config': 6,
    'functionset': 7,
    'function': 8,
    'block': 9,
    'port': 10,
    'requirementset': 11,
    'requirement': 12,
    'testset': 13,
    'testcase': 14
  };

  // Find root nodes (productlines)
  const roots = useMemo(() => {
    const rootNodes = filteredNodes.filter(node => getNodeSymbolType(node) === 'productline').map(node => node.id);
    WebviewLogger.debug(`TRACETABLE - Found ${rootNodes.length} root nodes (productlines): ${rootNodes.join(', ')}`);
    return rootNodes;
  }, [filteredNodes]);

  // Build table rows recursively
  const rows = useMemo(() => {
    const tableRows: { indent: number, name: string, type: string, file: string, connections: number }[] = [];

    function addRows(nodeId: string, indent = 0) {
      const node = nodeMap.get(nodeId);
      if (!node) {
        WebviewLogger.warn(`TRACETABLE - Node not found: ${nodeId}`);
        return;
      }

      WebviewLogger.debug(`TRACETABLE - Adding row: ${node.name} (indent: ${indent})`);
      
      tableRows.push({
        indent,
        name: node.name,
        type: getNodeSymbolType(node),
        file: node.fileUri.split('/').pop() || '',
        connections: node.connections.length
      });

      let children = childrenMap.get(nodeId) || [];
      WebviewLogger.debug(`TRACETABLE - Node ${node.name} has ${children.length} children: ${children.join(', ')}`);

      // Sort children by hierarchy level then name
      children.sort((a, b) => {
        const nodeA = nodeMap.get(a);
        const nodeB = nodeMap.get(b);
        if (!nodeA || !nodeB) return 0;
        
        const typeA = getNodeSymbolType(nodeA);
        const typeB = getNodeSymbolType(nodeB);
        const levelA = hierarchyLevels[typeA] ?? 99;
        const levelB = hierarchyLevels[typeB] ?? 99;
        if (levelA === levelB) {
          return nodeA.name.localeCompare(nodeB.name);
        }
        return levelA - levelB;
      });

      children.forEach(child => addRows(child, indent + 1));
    }

    WebviewLogger.debug(`TRACETABLE - Starting to build rows from ${roots.length} roots`);
    roots.forEach(root => addRows(root));

    WebviewLogger.debug(`TRACETABLE - Built ${tableRows.length} total rows`);
    return tableRows;
  }, [nodeMap, childrenMap, roots]);

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      minHeight: '100vh'
    }}>
      <h2 style={{ 
        marginBottom: '20px',
        color: '#ffffff',
        borderBottom: '2px solid #007acc',
        paddingBottom: '10px'
      }}>
        Traceability Table
      </h2>
      
      <div style={{
        backgroundColor: '#2d2d30',
        border: '1px solid #3c3c3c',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '14px'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#094771' }}>
              <th style={{ 
                padding: '12px', 
                textAlign: 'left', 
                borderBottom: '1px solid #3c3c3c',
                color: '#ffffff',
                fontWeight: 'bold'
              }}>
                Name
              </th>
              <th style={{ 
                padding: '12px', 
                textAlign: 'left', 
                borderBottom: '1px solid #3c3c3c',
                color: '#ffffff',
                fontWeight: 'bold'
              }}>
                Type
              </th>
              <th style={{ 
                padding: '12px', 
                textAlign: 'left', 
                borderBottom: '1px solid #3c3c3c',
                color: '#ffffff',
                fontWeight: 'bold'
              }}>
                File
              </th>
              <th style={{ 
                padding: '12px', 
                textAlign: 'left', 
                borderBottom: '1px solid #3c3c3c',
                color: '#ffffff',
                fontWeight: 'bold'
              }}>
                Connections
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} style={{ 
                backgroundColor: index % 2 === 0 ? '#2d2d30' : '#252526',
                ':hover': { backgroundColor: '#37373d' }
              }}>
                <td style={{ 
                  padding: '8px 12px', 
                  borderBottom: '1px solid #3c3c3c',
                  paddingLeft: `${12 + row.indent * 20}px`
                }}>
                  {row.indent > 0 && '└ '}{row.name}
                </td>
                <td style={{ 
                  padding: '8px 12px', 
                  borderBottom: '1px solid #3c3c3c',
                  color: '#569cd6'
                }}>
                  {row.type}
                </td>
                <td style={{ 
                  padding: '8px 12px', 
                  borderBottom: '1px solid #3c3c3c',
                  color: '#ce9178'
                }}>
                  {row.file}
                </td>
                <td style={{ 
                  padding: '8px 12px', 
                  borderBottom: '1px solid #3c3c3c',
                  color: '#b5cea8'
                }}>
                  {row.connections}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{ 
        marginTop: '20px', 
        fontSize: '12px', 
        color: '#808080',
        borderTop: '1px solid #3c3c3c',
        paddingTop: '10px'
      }}>
        Total: {rows.length} items | Nodes: {data.nodes.length} | Edges: {data.edges.length}
      </div>
    </div>
  );
}