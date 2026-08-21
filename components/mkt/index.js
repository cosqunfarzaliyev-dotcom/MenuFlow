// ---------------------------------------------------------------------------
// components/mkt — "Süfrə", the design system for the public marketing site
// ONLY (app/[locale]/**, components/marketing/**). Deliberately SEPARATE
// from components/kit (the four app panels) and .customer-theme (the
// customer-facing QR menu, still --mf-*): three systems, three token
// namespaces (--mkt-* / --k-* / --mf-*), none reusable across the boundary.
// See components/mkt/tokens.css's header for the full reasoning.
// ---------------------------------------------------------------------------
export { Card, CardBody, Badge, Tabs, TabsTrigger, EmptyState } from './primitives';
export { buttonVariants, cardVariants, badgeVariants, BADGE_TONE_CLASSES, FOCUS } from './variants';
