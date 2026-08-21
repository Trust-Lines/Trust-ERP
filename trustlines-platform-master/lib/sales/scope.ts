
const SCOPE_TO_CATEGORY: Record<string, string> = {
  shelving: 'Shelving', millwork: 'Millwork', image: 'Image', ceiling: 'Ceiling',
};

export function scopeToCategories(scope: Record<string, unknown> | null | undefined): string[] {
  if (!scope) return [];
  return Object.entries(SCOPE_TO_CATEGORY)
    .filter(([k]) => scope[k] === true)
    .map(([, label]) => label);
}
