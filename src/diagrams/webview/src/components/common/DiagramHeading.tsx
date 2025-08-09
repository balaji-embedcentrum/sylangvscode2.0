interface DiagramHeadingProps {
  title?: string;
  description?: string;
  sourceFile?: string;
}

export function DiagramHeading({ title, description, sourceFile }: DiagramHeadingProps) {
  const fileName = sourceFile ? sourceFile.split('/').pop() || sourceFile : '';
  
  return (
    <div style={{
      padding: '16px 20px',
      backgroundColor: 'var(--vscode-editor-background)',
      borderBottom: '1px solid var(--vscode-panel-border)',
      color: 'var(--vscode-editor-foreground)'
    }}>
      {title && (
        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: 'var(--vscode-editor-foreground)'
        }}>
          {title}
        </h2>
      )}
      {description && (
        <p style={{
          margin: '0 0 8px 0',
          fontSize: '14px',
          color: 'var(--vscode-descriptionForeground)',
          lineHeight: '1.4'
        }}>
          {description}
        </p>
      )}
      {fileName && (
        <div style={{
          fontSize: '12px',
          color: 'var(--vscode-descriptionForeground)',
          fontFamily: 'var(--vscode-editor-font-family)'
        }}>
          Source: {fileName}
        </div>
      )}
    </div>
  );
} 