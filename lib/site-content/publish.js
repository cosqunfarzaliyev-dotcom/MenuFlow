'use server';

import { revalidatePath } from 'next/cache';

// ---------------------------------------------------------------------------
// The one deliberate, narrow exception to CLAUDE.md's "There is (almost) no
// backend" — read that section before touching this file.
//
// app/[locale]/layout.jsx sets `revalidate = 900`, so a SuperAdmin edit to
// site_content/site_faq_items (supabase/migrations/0032_site_content_cms.sql)
// would otherwise take up to 15 minutes to appear on the live marketing
// site. This Server Action lets the three website-mode tabs
// (SitePagesTab/SiteContactTab/SiteFaqTab) force it immediately after a
// successful Supabase write.
//
// Why this is acceptable despite the "no backend" rule:
//   - It is NOT a Route Handler and does not add an app/api/ surface.
//   - Its body has ZERO authorization logic and ZERO data access — it
//     cannot read, write, or leak anything. It literally only calls
//     revalidatePath.
//   - RLS remains the entire auth layer: the CMS write itself already
//     happened client-side against Supabase under
//     site_content_super_admin_write / site_faq_items_super_admin_write —
//     this action runs strictly AFTER that write succeeded.
//   - Worst case for an anonymous caller who somehow invokes this directly:
//     it forces a re-render of 18 already-public static pages — the same
//     thing that happens every 900s anyway. A Route Handler doing the same
//     job would need its own session check, which is exactly the "Next API
//     route doing auth checks" CLAUDE.md forbids.
//
// One call covers every locale AND every nested page under the segment:
// `'/[locale]', 'layout'` matches the dynamic-segment path with type
// 'layout', which invalidates the whole subtree in one call (see
// 01-app/03-api-reference/04-functions/revalidatePath.md, "What can be
// invalidated").
// ---------------------------------------------------------------------------
export async function publishSiteContent() {
  revalidatePath('/[locale]', 'layout');
}
