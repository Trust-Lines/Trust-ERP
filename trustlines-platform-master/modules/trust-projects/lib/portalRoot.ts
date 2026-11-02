// T-ERP ADAPTATION: the board's modals and dropdowns used to portal into document.body, where
// the page's scoped stylesheet (.trust-projects …) can't reach them. They now portal into one
// body-level <div class="trust-projects trust-projects-portal"> instead (see isolation.css).
export function portalRoot(): HTMLElement {
  let el = document.getElementById('trust-projects-portal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'trust-projects-portal';
    el.className = 'trust-projects trust-projects-portal';
    document.body.appendChild(el);
  }
  return el;
}
