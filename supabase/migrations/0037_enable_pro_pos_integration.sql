-- Pro's POS entitlement was introduced after the original plan-feature seed.
-- Seed it explicitly so the public pricing page and the entitlement resolver
-- agree that POS integration belongs to Pro. The SuperAdmin Plans tab can
-- change this row afterwards through its regular per-plan feature switch.
insert into public.plan_features (plan_id, feature_key, enabled)
select id, 'pos_integration', true
from public.plans
where key = 'pro'
on conflict (plan_id, feature_key) do update
  set enabled = excluded.enabled;
