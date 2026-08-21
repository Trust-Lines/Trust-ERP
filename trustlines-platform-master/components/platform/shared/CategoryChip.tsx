import type { ProjectCategory } from '@/types/database';

const MS_CATEGORIES = new Set<ProjectCategory>(['M1','M2','M3','S1','S2','S3']);
const CI_CATEGORIES = new Set<ProjectCategory>(['C1','C2','C3','I1','I2','I3']);

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  M1: 'Millwork 1', M2: 'Millwork 2', M3: 'Millwork 3',
  S1: 'Shelving 1', S2: 'Shelving 2', S3: 'Shelving 3',
  C1: 'Ceiling 1',  C2: 'Ceiling 2',  C3: 'Ceiling 3',
  I1: 'Image 1',    I2: 'Image 2',    I3: 'Image 3',
};

interface CategoryChipProps {
  category: ProjectCategory;
  short?: boolean;
}

export function CategoryChip({ category, short = false }: CategoryChipProps) {
  const isMS = MS_CATEGORIES.has(category);

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 7px',
    borderRadius: 'var(--radius-pill)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    background: isMS ? 'var(--brand-teal-100)' : 'var(--brand-orange-100)',
    color:      isMS ? 'var(--brand-teal-600)' : 'var(--brand-orange-600)',
    border:     `1px solid ${isMS ? '#b2d8d8' : '#f3c4b0'}`,
  };

  return <span style={style}>{short ? category : CATEGORY_LABELS[category]}</span>;
}

interface CategoryListProps {
  categories: ProjectCategory[];
  short?: boolean;
  max?: number;
}

export function CategoryList({ categories, short = true, max = 4 }: CategoryListProps) {
  const visible  = categories.slice(0, max);
  const overflow = categories.length - max;

  return (
    <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
      {visible.map(c => (
        <CategoryChip key={c} category={c} short={short} />
      ))}
      {overflow > 0 && (
        <span
          style={{
            fontSize: '11px',
            color: 'var(--fg-subtle)',
            fontWeight: 600,
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
