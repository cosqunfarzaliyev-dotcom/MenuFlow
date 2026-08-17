// Re-exported from components/kit/Toast.jsx (the Quiet Premium kit) so the
// existing `from '@/components/superadmin/Toast'` import in SuperAdminApp.jsx,
// PlansTab.jsx and RestaurantsTab.jsx keeps working unchanged. Was
// components/ui/Toast.jsx before the SuperAdmin panel's redesign pass —
// same notify(message, type) contract either way, so this swap needed no
// call-site changes.
export { ToastProvider, useToast } from '@/components/kit/Toast';
