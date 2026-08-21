interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface CardHeadProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface CardBodyProps {
  children: React.ReactNode;
  flush?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ children, className, style }: CardProps) {
  return (
    <div className={`card${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  );
}

export function CardHead({ children, className, style }: CardHeadProps) {
  return (
    <div className={`card-head${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  );
}

export function CardBody({ children, flush, className, style }: CardBodyProps) {
  return (
    <div
      className={`card-body${flush ? ' flush' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </div>
  );
}
