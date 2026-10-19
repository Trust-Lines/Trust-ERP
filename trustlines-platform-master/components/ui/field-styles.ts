// Shared look for every text-like form control (Figma: DAY 03 › Components › Form Components):
// 32px high, 4px radius, primary-50 fill, primary-700 border + text, 11px Instrument Sans.
// Used by input, textarea, select, combobox, date picker and tag input so they stay identical.
export const fieldBase =
  "w-full min-w-0 rounded-[4px] border border-primary-700 dark:border-[var(--ui-control-border)] dark:rounded-[8px] bg-primary-50 dark:bg-[var(--bg-sunken)] px-2 dark:px-3 text-[11px] leading-[1.5] text-primary-700 dark:text-[var(--ui-heading)] transition-colors outline-none placeholder:text-primary-400 hover:border-primary-950 dark:hover:border-primary-300 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring disabled:cursor-not-allowed disabled:border-grey-200 disabled:bg-grey-50 disabled:text-grey-200 data-disabled:cursor-not-allowed data-disabled:border-grey-200 data-disabled:bg-grey-50 data-disabled:text-grey-200 aria-invalid:border-error-normal aria-invalid:bg-error-light"

/** Same as fieldBase, for a wrapper that holds an inner input (focus ring follows the inner input). */
export const fieldGroupBase =
  "flex w-full min-w-0 items-center rounded-[4px] border border-primary-700 dark:border-[var(--ui-control-border)] dark:rounded-[8px] bg-primary-50 dark:bg-[var(--bg-sunken)] text-[11px] leading-[1.5] text-primary-700 dark:text-[var(--ui-heading)] transition-colors hover:border-primary-950 dark:hover:border-primary-300 focus-within:outline-2 focus-within:outline-solid focus-within:outline-offset-1 focus-within:outline-ui-focus-ring has-[[aria-invalid=true]]:border-error-normal has-[[aria-invalid=true]]:bg-error-light has-disabled:cursor-not-allowed has-disabled:border-grey-200 has-disabled:bg-grey-50 has-disabled:text-grey-200"

/** Popup panel for select / combobox / date picker (Figma "Option 1-3" list). */
export const popupBase =
  "rounded-[4px] border border-primary-700 dark:border-[var(--ui-divider-strong)] bg-primary-50 dark:bg-ui-surface-elevated dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] dark:p-1 text-[11px] leading-[1.5] text-primary-700 dark:text-primary-100 shadow-md outline-none origin-(--transform-origin) transition-[scale,opacity] duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"

/** One option row inside popupBase. */
export const optionBase =
  "flex cursor-default items-center gap-2 rounded-[2px] px-2 py-[3px] outline-none select-none data-highlighted:bg-primary-700 data-highlighted:text-primary-50 data-selected:font-semibold dark:rounded-[4px] dark:data-highlighted:bg-white/10 dark:data-highlighted:text-primary-50 dark:data-selected:bg-[var(--ui-menu-active-bg)] dark:data-selected:text-[var(--ui-menu-active-fg)] data-disabled:text-grey-200"
