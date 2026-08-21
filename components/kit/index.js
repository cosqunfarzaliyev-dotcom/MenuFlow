// ---------------------------------------------------------------------------
// components/kit — "Quiet Premium", the design system for the four app panels
// (Customer, Staff, Admin, SuperAdmin).
//
// Deliberately SEPARATE from components/mkt (the marketing site) and
// untouched: the marketing site, /login, /reset-password and /onboarding still
// import it. Two kits coexist so redesigning the panels cannot regress those
// nine pages. Tokens are namespaced (--k-* vs --mf-*/--sa-*) for the same
// reason, and are scoped to .kit-dark / .kit-light on each panel root rather
// than to <body>.
// ---------------------------------------------------------------------------
export {
  Button,
  Field, Input, Select, Textarea, Checkbox, Switch,
  Tag,
  Card, CardHeader, CardBody, CardFooter,
  Banner,
  Tabs, TabsTrigger, Pill,
  PageHeader,
  Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell, TableEmptyRow,
  Divider, Skeleton,
} from './primitives';

export { Sheet, SheetHeader, SheetBody, SheetFooter, SheetClose } from './Sheet';
export { ImageUploadField } from './ImageUploadField';
export { Sidebar, SidebarMenuButton } from './Sidebar';
export { LanguageToggle } from './LanguageToggle';
export { EmptyState, LoadingState, ErrorState, PageSkeleton } from './states';
export { ToastProvider, useToast } from './Toast';
export { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';

// Recipes, for the handful of places that need the class string without the
// component — e.g. a next/link that must look like a button.
export {
  buttonVariants, tagVariants, cardVariants, bannerVariants,
  pillVariants, fieldControlVariants, FOCUS,
} from './variants';
