-- Adds contact.instagram_url to the site_content CMS registry
-- (lib/services/siteContentService.js's CONTACT_DETAIL_KEYS, extended to 4
-- keys). Seeded blank like contact.address was in 0032 — a SuperAdmin fills
-- it in from SiteContactTab.jsx; the marketing footer and /contact page
-- both skip the Instagram card entirely while this is empty, so there is
-- no dead link in the meantime.
insert into public.site_content (key, value_az, translations) values
  ('contact.instagram_url', '', '{}'::jsonb)
on conflict (key) do nothing;
