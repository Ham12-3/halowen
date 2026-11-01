/** Inline SVG icons shared by the HUD and the menu screens. All decorative (aria-hidden). */

export const PUMPKIN_ICON = `
  <svg viewBox="0 0 32 30" width="32" height="30" aria-hidden="true">
    <path d="M15 5c0-2 1-4 3-4" stroke="#4a5a20" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="9.5" cy="17" rx="7.5" ry="10" fill="#e06a12"/>
    <ellipse cx="22.5" cy="17" rx="7.5" ry="10" fill="#e06a12"/>
    <ellipse cx="16" cy="17" rx="7" ry="11" fill="#f07c1c"/>
    <path d="M8 13l3.5-4 3.5 4zM17 13l3.5-4 3.5 4z" fill="#ffd36b"/>
    <path d="M7 19c3 5 15 5 18 0l-3 1.5-2-2-2 2-2-2-2 2-2-2-2 2z" fill="#ffd36b"/>
  </svg>`;

/** Three tracks with an arrow hopping from one to the next. */
export const LANES_ICON = `
  <svg viewBox="0 0 36 30" width="36" height="30" aria-hidden="true">
    <path d="M6 29L10 1M18 29V1M30 29L26 1" stroke="#9aa0a8" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M9 18c4-6 10-6 14 0" stroke="#ffc070" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M24 13l-1 6-5-2" stroke="#ffc070" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

/** A hanging signal board with its orange hazard stripe. */
export const SIGNAL_ICON = `
  <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
    <rect x="6" y="1" width="2" height="7" fill="#8a8f98"/><rect x="22" y="1" width="2" height="7" fill="#8a8f98"/>
    <rect x="3" y="7" width="24" height="13" rx="1.5" fill="#2a2c33" stroke="#666"/>
    <rect x="3" y="18" width="24" height="3" fill="#ff8a1a"/>
    <circle cx="15" cy="12.5" r="3" fill="#ff2a1a"/>
    <path d="M4 27h22" stroke="#9aa0a8" stroke-width="2"/>
  </svg>`;

/** A stopwatch, for the run timer. */
export const CLOCK_ICON = `
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <circle cx="12" cy="13" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M12 8.5v4.5l3 2M9 2.5h6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`;

/** Crash: a warning triangle. */
export const CRASH_ICON = `
  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
    <path d="M12 3L2 20h20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M12 10v4.5M12 17.5v.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`;

/** Arrived: an Underground roundel. */
export const ROUNDEL_ICON = `
  <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
    <circle cx="20" cy="20" r="12" fill="none" stroke="#dc241f" stroke-width="6"/>
    <rect x="2" y="16.5" width="36" height="7" fill="#2a4fd0"/>
  </svg>`;

export const SOUND_ON_ICON = `
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>
    <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`;

export const SOUND_OFF_ICON = `
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>
    <path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
