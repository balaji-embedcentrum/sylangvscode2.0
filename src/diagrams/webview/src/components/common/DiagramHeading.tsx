interface DiagramHeadingProps {
  title?: string;
  description?: string;
}

export function DiagramHeading({ title, description }: DiagramHeadingProps) {
  return (
    <div className="diagram-heading">
      {title && (
        <h1 className="diagram-title">{title}</h1>
      )}
      {description && (
        <p className="diagram-description">{description}</p>
      )}
    </div>
  );
} 