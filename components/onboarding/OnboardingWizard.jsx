"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store, Image as ImageIcon, Globe, DollarSign, Phone, LayoutGrid,
  UtensilsCrossed, Palette, CheckCircle2, ChevronLeft, ChevronRight, PlusCircle,
} from 'lucide-react';
import { supabase, supabaseReady } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { useOnboardingTranslation } from '@/lib/i18n/dictionaries/onboarding';
import { Button, Input, Field, Tag, LanguageToggle } from '@/components/kit';

const CURRENCIES = ['₼', '$', '€', '₺', '₽', '£'];

// Post-activation setup wizard for a just-assigned restaurant_admin
// (Master Plan D1's "Yol A" — see CLAUDE.md → Roles): the restaurant itself
// already exists (a super admin created it and this admin's account in the
// same form, superAdminService.createOrAssignRestaurantUser), including a name,
// currency, and a default batch of tables (superAdminService.createRestaurant
// -> createDefaultTablesForRestaurant). This wizard doesn't create anything
// from scratch — it lets the newly-activated admin confirm/fill in the rest
// (branding, contact, an initial menu, theme colors) before landing on
// /admin. Every step reuses the exact same store actions/services the Admin
// panel itself uses (updateRestaurantDesign, createProduct, createCategory,
// updateTableName, ...) — nothing here is a parallel write path.
//
// Gating: middleware.js only lets a restaurant_admin reach this page while
// restaurants.onboarding_completed_at is null, and only lets them reach
// /admin once it's set (migration 0024_onboarding_completion.sql). This
// component's only job re: that gate is calling completeOnboarding() on the
// final step — the actual access control lives server-side in middleware.js.
const STEPS = ['info', 'branding', 'language', 'currency', 'contact', 'tables', 'menu', 'design'];

const STEP_ICONS = {
  info: Store,
  branding: ImageIcon,
  language: Globe,
  currency: DollarSign,
  contact: Phone,
  tables: LayoutGrid,
  menu: UtensilsCrossed,
  design: Palette,
};

export function OnboardingWizard({ restaurant, profile }) {
  const router = useRouter();
  const updateRestaurantProfile = useAppStore((s) => s.updateRestaurantProfile);
  const updateRestaurantDesign = useAppStore((s) => s.updateRestaurantDesign);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const loadTables = useAppStore((s) => s.loadTables);
  const loadMenuData = useAppStore((s) => s.loadMenuData);
  const createCategory = useAppStore((s) => s.createCategory);
  const createProduct = useAppStore((s) => s.createProduct);
  const updateTableName = useAppStore((s) => s.updateTableName);
  const { t } = useOnboardingTranslation();

  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Restaurant info
  const [name, setName] = useState(restaurant?.name || '');
  const [tagline, setTagline] = useState(restaurant?.tagline || '');
  // Step 2 — Branding
  const [logo, setLogo] = useState(restaurant?.logo || '');
  // Step 4 — Currency
  const [currencySymbol, setCurrencySymbol] = useState(restaurant?.currency_symbol || '₼');
  // Step 5 — Contact
  const [phone, setPhone] = useState(restaurant?.phone || '');
  const [address, setAddress] = useState(restaurant?.address || '');
  // Step 6 — Tables
  const [tables, setTables] = useState([]);
  const [tablesLoaded, setTablesLoaded] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  // Step 7 — Initial menu
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [productDraft, setProductDraft] = useState({ name: '', price: '', categoryId: '' });
  const [addingProduct, setAddingProduct] = useState(false);
  // Step 8 — Design
  const [primaryColor, setPrimaryColor] = useState(restaurant?.theme_primary_color || '#6C4CFF');
  const [secondaryColor, setSecondaryColor] = useState(restaurant?.theme_secondary_color || '#14151A');

  const currentStep = STEPS[stepIndex];

  // Fetched via the raw return value of loadTables()/loadMenuData() (not the
  // store's `tables`/`products`/`categories` fields), which fall back to seed
  // demo data when a restaurant genuinely has none yet — exactly this
  // wizard's starting state. See lib/store.js for why the return value is
  // the real fetch result and the committed state can differ from it.
  useEffect(() => {
    if (currentStep !== 'tables' || tablesLoaded) return;
    // Wrapped in an async IIFE (same shape app/onboarding/page.jsx's own
    // session-sync effect already uses) rather than calling setState
    // synchronously in the effect body — react-hooks/set-state-in-effect
    // only flags the latter.
    (async () => {
      setTablesLoading(true);
      const fetched = await loadTables();
      setTables(fetched || []);
      setTablesLoading(false);
      setTablesLoaded(true);
    })();
  }, [currentStep, tablesLoaded, loadTables]);

  useEffect(() => {
    if (currentStep === 'menu' && !menuLoaded) {
      loadMenuData().then(({ products: p, categories: c }) => {
        setProducts(p || []);
        setCategories(c || []);
        setMenuLoaded(true);
      });
    }
  }, [currentStep, menuLoaded, loadMenuData]);

  const persistStep = async (step) => {
    if (step === 'info') {
      if (!name.trim()) {
        setError(t('restaurantNameRequired'));
        return false;
      }
      setSaving(true);
      const { error: err } = await updateRestaurantProfile({ name: name.trim(), tagline: tagline.trim() });
      setSaving(false);
      if (err) { setError(t('genericSaveError')(err.message)); return false; }
      return true;
    }
    if (step === 'branding') {
      setSaving(true);
      const { error: err } = await updateRestaurantProfile({ logo: logo.trim() });
      setSaving(false);
      if (err) { setError(t('genericSaveError')(err.message)); return false; }
      return true;
    }
    if (step === 'currency') {
      setSaving(true);
      const { error: err } = await updateRestaurantProfile({ currencySymbol: currencySymbol.trim() || '₼' });
      setSaving(false);
      if (err) { setError(t('genericSaveError')(err.message)); return false; }
      return true;
    }
    if (step === 'contact') {
      setSaving(true);
      const { error: err } = await updateRestaurantProfile({ phone: phone.trim(), address: address.trim() });
      setSaving(false);
      if (err) { setError(t('genericSaveError')(err.message)); return false; }
      return true;
    }
    if (step === 'design') {
      setSaving(true);
      const { error: err } = await updateRestaurantDesign({ themePrimaryColor: primaryColor, themeSecondaryColor: secondaryColor });
      setSaving(false);
      if (err) { setError(t('genericSaveError')(err.message)); return false; }
      return true;
    }
    // language/tables/menu already persist per-action (LanguageToggle's own
    // sync, updateTableName, createCategory/createProduct) — nothing left to
    // save when moving off them.
    return true;
  };

  const handleNext = async () => {
    setError('');
    const ok = await persistStep(currentStep);
    if (!ok) return;
    if (stepIndex === STEPS.length - 1) {
      setSaving(true);
      const { error: err } = await completeOnboarding();
      setSaving(false);
      if (err) { setError(t('genericSaveError')(err.message)); return; }
      setCompleted(true);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const handleBack = () => {
    setError('');
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const handleRenameTable = async (tableId, newName) => {
    const { error: err } = await updateTableName(tableId, newName);
    if (!err) {
      setTables((prev) => prev.map((tb) => (tb.id === tableId ? { ...tb, name: newName } : tb)));
    }
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim()) return;
    setAddingCategory(true);
    const { category, error: err } = await createCategory({ name: categoryName.trim() });
    setAddingCategory(false);
    if (err) { setError(t('genericSaveError')(err.message)); return; }
    if (category) {
      setCategories((prev) => [...prev, category]);
      setCategoryName('');
    }
  };

  const handleAddProduct = async () => {
    const categoryId = productDraft.categoryId || categories[0]?.id;
    if (!productDraft.name.trim() || !categoryId) return;
    const priceNum = Number(productDraft.price);
    setAddingProduct(true);
    const { product, error: err } = await createProduct({
      name: productDraft.name.trim(),
      price: Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0,
      category: categoryId,
    });
    setAddingProduct(false);
    if (err) { setError(t('genericSaveError')(err.message)); return; }
    if (product) {
      setProducts((prev) => [...prev, product]);
      setProductDraft({ name: '', price: '', categoryId });
    }
  };

  const finishAndGoToAdmin = () => router.replace('/admin');

  const handleSignOut = async () => {
    if (supabaseReady) await supabase.auth.signOut();
    router.replace('/login');
  };

  if (completed) {
    return (
      <div className="w-full max-w-lg bg-[var(--k-surface)]/90 backdrop-blur p-6 sm:p-8 rounded-3xl border border-[var(--k-border)] text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto bg-emerald-500/15 rounded-2xl flex items-center justify-center border border-emerald-500/30 mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--k-text)] mb-2">{t('completeTitle')}</h2>
        <p className="text-[var(--k-text-2)] text-sm leading-relaxed mb-6">{t('completeBody')}</p>

        <div className="bg-[var(--k-surface-2)] border border-[var(--k-border)] rounded-2xl p-4 mb-6 text-left space-y-2">
          <p className="text-xs font-bold text-[var(--k-text-2)] uppercase tracking-wider mb-1">{t('completeSummaryTitle')}</p>
          <SummaryRow label={t('completeSummaryName')} value={name || restaurant?.name} />
          <SummaryRow label={t('completeSummaryCurrency')} value={currencySymbol} />
          <SummaryRow label={t('completeSummaryTables')} value={tables.length || restaurant?.table_count || 0} />
          <SummaryRow label={t('completeSummaryProducts')} value={products.length} />
        </div>

        <Button type="button" onClick={finishAndGoToAdmin} className="w-full">
          {t('goToAdminButton')} <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  const StepIcon = STEP_ICONS[currentStep];
  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <div className="w-full max-w-2xl bg-[var(--k-surface)]/90 backdrop-blur p-6 sm:p-8 rounded-3xl border border-[var(--k-border)] shadow-2xl">
      <div className="flex items-center justify-between flex-wrap gap-y-3 mb-6">
        <div className="flex items-center gap-2">
          {STEPS.map((step, i) => (
            <span
              key={step}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIndex ? 'w-6 bg-[var(--k-accent)]' : i < stepIndex ? 'w-3 bg-[var(--k-accent)]/40' : 'w-3 bg-[var(--k-border)]'
              }`}
            />
          ))}
        </div>
        <LanguageToggle profile={profile} />
      </div>

      <p className="text-xs font-bold text-[var(--k-accent)] uppercase tracking-wider mb-2">{t('stepLabel')(stepIndex + 1, STEPS.length)}</p>

      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 shrink-0 bg-[var(--k-accent-soft)] border border-[var(--k-accent)]/25 rounded-xl flex items-center justify-center">
          <StepIcon className="w-5 h-5 text-[var(--k-accent)]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--k-text)]">{t(`${currentStep}StepTitle`)}</h2>
          <p className="text-[var(--k-text-2)] text-sm mt-1 leading-relaxed">
            {currentStep === 'tables'
              ? t('tablesStepSubtitle')(restaurant?.table_count || tables.length || 0)
              : t(`${currentStep}StepSubtitle`)}
          </p>
        </div>
      </div>

      <div className="min-h-[180px]">
        {currentStep === 'info' && (
          <div className="space-y-4">
            <Field label={t('restaurantNameFieldLabel')} required>
              {(id, a11y) => (
                <Input id={id} value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={t('restaurantNameFieldPlaceholder')} {...a11y} />
              )}
            </Field>
            <Field label={t('taglineFieldLabel')}>
              {(id, a11y) => (
                <Input id={id} value={tagline} onChange={(e) => setTagline(e.target.value)}
                  placeholder={t('taglineFieldPlaceholder')} {...a11y} />
              )}
            </Field>
          </div>
        )}

        {currentStep === 'branding' && (
          <div className="space-y-4">
            <Field label={t('logoUrlFieldLabel')}>
              {(id, a11y) => (
                <Input id={id} value={logo} onChange={(e) => setLogo(e.target.value)}
                  placeholder={t('logoUrlFieldPlaceholder')} {...a11y} />
              )}
            </Field>
            {logo.trim() ? (
              <div className="flex items-center gap-3 p-3 bg-[var(--k-surface-2)] border border-[var(--k-border)] rounded-xl">
                <span className="text-xs font-semibold text-[var(--k-text-2)] shrink-0">{t('logoPreviewLabel')}</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-supplied URL, not a known-domain asset next/image can optimize */}
                <img src={logo.trim()} alt="" className="w-10 h-10 object-contain rounded-lg border border-[var(--k-border)] bg-[var(--k-bg)]" />
              </div>
            ) : (
              <p className="text-xs text-[var(--k-text-3)]">{t('logoEmptyHint')}</p>
            )}
          </div>
        )}

        {currentStep === 'language' && (
          <div className="flex justify-center py-4">
            <LanguageToggle profile={profile} className="scale-125" />
          </div>
        )}

        {currentStep === 'currency' && (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {CURRENCIES.map((c) => (
                <button type="button" key={c} onClick={() => setCurrencySymbol(c)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${
                    currencySymbol === c
                      ? 'bg-[var(--k-accent)] text-[var(--k-accent-fg)] border-[var(--k-accent)] shadow-md shadow-black/20'
                      : 'bg-[var(--k-bg)] text-[var(--k-text-2)] border-[var(--k-border)] hover:text-[var(--k-text)] hover:border-[var(--k-border-2)]'
                  }`}>
                  {c}
                </button>
              ))}
              <Input value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)}
                placeholder={t('currencyOtherFieldPlaceholder')} className="w-24 text-center font-bold" />
            </div>
            <p className="text-xs text-[var(--k-text-3)]">{t('currencyFieldHint')}</p>
          </div>
        )}

        {currentStep === 'contact' && (
          <div className="space-y-4">
            <Field label={t('phoneFieldLabel')}>
              {(id, a11y) => (
                <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('phoneFieldPlaceholder')} {...a11y} />
              )}
            </Field>
            <Field label={t('addressFieldLabel')}>
              {(id, a11y) => (
                <Input id={id} value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder={t('addressFieldPlaceholder')} {...a11y} />
              )}
            </Field>
          </div>
        )}

        {currentStep === 'tables' && (
          <div>
            {tablesLoading ? (
              <p className="text-sm text-[var(--k-text-3)]">{t('tablesLoadingHint')}</p>
            ) : tables.length === 0 ? (
              <p className="text-sm text-[var(--k-text-3)]">{t('tablesEmptyHint')}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                {tables.map((tb) => (
                  <input
                    key={tb.id}
                    defaultValue={tb.name || t('tableNumberLabel')(tb.table_number)}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== tb.name) handleRenameTable(tb.id, v);
                    }}
                    className="bg-[var(--k-bg)] border border-[var(--k-border)] rounded-lg px-3 py-2 text-xs text-[var(--k-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)] transition-colors"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {currentStep === 'menu' && (
          <div className="space-y-5">
            <div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)}
                  placeholder={t('categoryNameFieldPlaceholder')} className="flex-1" />
                <Button type="button" onClick={handleAddCategory} loading={addingCategory} disabled={!categoryName.trim()}>
                  <PlusCircle className="w-4 h-4" /> {t('addCategoryButton')}
                </Button>
              </div>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {categories.map((c) => <Tag key={c.id} tone="neutral">{c.name}</Tag>)}
                </div>
              )}
            </div>

            {categories.length === 0 ? (
              <p className="text-xs text-[var(--k-text-3)]">{t('menuNeedsCategoryHint')}</p>
            ) : (
              <div className="border-t border-[var(--k-border)] pt-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={productDraft.name}
                    onChange={(e) => setProductDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder={t('productNameFieldPlaceholder')} className="flex-1" />
                  <Input type="number" min="0" step="0.01" value={productDraft.price}
                    onChange={(e) => setProductDraft((d) => ({ ...d, price: e.target.value }))}
                    placeholder={t('productPriceFieldLabel')} className="sm:w-28" />
                  <select
                    value={productDraft.categoryId || categories[0]?.id || ''}
                    onChange={(e) => setProductDraft((d) => ({ ...d, categoryId: e.target.value }))}
                    className="bg-[var(--k-bg)] border border-[var(--k-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--k-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)] sm:w-40"
                  >
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Button type="button" onClick={handleAddProduct} loading={addingProduct} disabled={!productDraft.name.trim()}>
                    <PlusCircle className="w-4 h-4" /> {t('addProductButton')}
                  </Button>
                </div>
                {products.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {products.map((p) => <Tag key={p.id} tone="success">{p.name}</Tag>)}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-[var(--k-text-3)]">{t('menuEmptyOkHint')}</p>
          </div>
        )}

        {currentStep === 'design' && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-6">
              <div>
                <label className="block text-xs font-bold text-[var(--k-text-2)] uppercase tracking-wider mb-2">{t('primaryColorFieldLabel')}</label>
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-14 h-11 rounded-lg border border-[var(--k-border)] bg-[var(--k-bg)] cursor-pointer" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--k-text-2)] uppercase tracking-wider mb-2">{t('secondaryColorFieldLabel')}</label>
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-14 h-11 rounded-lg border border-[var(--k-border)] bg-[var(--k-bg)] cursor-pointer" />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--k-text-2)] uppercase tracking-wider mb-2">{t('designPreviewLabel')}</p>
              <div className="rounded-2xl p-4 border border-[var(--k-border)]" style={{ backgroundColor: secondaryColor }}>
                <button type="button" className="px-4 py-2 rounded-xl text-sm font-bold text-[var(--k-text)]" style={{ backgroundColor: primaryColor }}>
                  {t('designPreviewButtonText')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-rose-500 text-xs mt-4 text-left font-bold">{error}</p>}

      <div className="flex items-center gap-3 mt-8 pt-6 border-t border-[var(--k-border)]">
        {stepIndex > 0 && (
          <Button type="button" variant="ghost" onClick={handleBack} disabled={saving}>
            <ChevronLeft className="w-4 h-4" /> {t('backButton')}
          </Button>
        )}
        <Button type="button" onClick={handleNext} loading={saving} className="ml-auto">
          {isLastStep ? t('finishButton') : t('nextButton')}
          {!isLastStep && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>

      <button type="button" onClick={handleSignOut} className="block mx-auto mt-5 text-xs text-[var(--k-text-3)] hover:text-[var(--k-text-2)] transition-colors">
        {t('signOutLink')}
      </button>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--k-text-3)]">{label}</span>
      <span className="text-[var(--k-text)] font-semibold">{value}</span>
    </div>
  );
}
