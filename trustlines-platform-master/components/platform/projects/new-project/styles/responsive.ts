// Breakpoints. Keep after the base sections so they win.
export const RESPONSIVE_STYLES = `
      /* Side summary needs ~760px for the form beside it (304px app sidebar + 365px panel). */
      @media (max-width: 1400px) {
        .np-quick-grid,
        .np-main-grid { grid-template-columns: minmax(0, 1fr); }
      }
`;
