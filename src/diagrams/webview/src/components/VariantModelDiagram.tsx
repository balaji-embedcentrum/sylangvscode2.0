interface VariantModelDiagramProps {
  data: any;
}

export function VariantModelDiagram({ data }: VariantModelDiagramProps) {
  return (
    <div className="variant-model-diagram">
      <div className="diagram-placeholder">
        <h3>Variant Model Diagram</h3>
        <p>This diagram will be implemented in Phase 3</p>
        <p>Nodes: {data.nodes?.length || 0}</p>
        <p>Edges: {data.edges?.length || 0}</p>
      </div>
    </div>
  );
} 