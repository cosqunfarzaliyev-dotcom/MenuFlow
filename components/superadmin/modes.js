// Shared by Sidebar.jsx and ModeSwitcher.jsx. Deliberately its OWN file, not
// exported from Sidebar.jsx (where it originally lived): Sidebar.jsx renders
// <ModeSwitcher>, and ModeSwitcher.jsx needs MODES/DEFAULT_MODE — importing
// them back from Sidebar.jsx created a circular module dependency
// (Sidebar -> ModeSwitcher -> Sidebar) that webpack's SSR bundle resolved in
// the wrong order, producing a real "Cannot access '_' before
// initialization" crash on `/superadmin` at build time. This file has no
// imports of its own, so nothing can cycle through it.
export const MODES = { RESTAURANTS: 'restaurants', WEBSITE: 'website' };
export const DEFAULT_MODE = MODES.RESTAURANTS;
