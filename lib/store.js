import { create } from "zustand";
import { supabaseReady } from "@/lib/supabase";
import { PRODUCTS as DEFAULT_PRODUCTS, CATEGORIES as DEFAULT_CATEGORIES } from "@/data/menuData";
import {
  createProduct as createProductService,
  updateProduct as updateProductService,
  deleteProduct as deleteProductService,
  createCategory as createCategoryService,
  updateCategory as updateCategoryService,
  deleteCategory as deleteCategoryService,
  reorderCategories as reorderCategoriesService,
  updateTableName as updateTableNameService,
  updateOrderStatus as updateOrderStatusService,
  resolveAlert as resolveAlertService,
  createAlert as createAlertService,
  createOrder as createOrderService,
  fetchProducts as fetchProductsService,
  fetchCategories as fetchCategoriesService,
  fetchTables as fetchTablesService,
  fetchRestaurantQrTokens as fetchRestaurantQrTokensService,
  fetchOrders as fetchOrdersService,
  fetchTableOrders as fetchTableOrdersService,
  settleTablePayment as settleTablePaymentService,
  fetchAlerts as fetchAlertsService,
  fetchRestaurantStaff as fetchRestaurantStaffService,
  fetchPosIntegrationStatus as fetchPosIntegrationStatusService,
  savePosCredentials as savePosCredentialsService,
  disconnectPosIntegration as disconnectPosIntegrationService,
  syncPosMenuNow as syncPosMenuNowService,
} from "@/lib/services/supabaseService";
import { fetchMyProfile, fetchRestaurantBySlug, fetchRestaurantById, ROLES } from "@/lib/services/authService";
import { updateRestaurant as updateRestaurantService } from "@/lib/services/superAdminService";
import { fetchPlans as fetchPlansService, fetchPlanFeatures as fetchPlanFeaturesService } from "@/lib/services/planService";
import { hydratePlanFeatureDefaults } from "@/lib/services/entitlementService";
import {
  fetchAnnouncements as fetchAnnouncementsService,
  fetchMyReadIds as fetchMyReadIdsService,
  markAnnouncementsRead as markAnnouncementsReadService,
} from "@/lib/services/announcementService";
import {
  fetchBanners as fetchBannersService,
  createBanner as createBannerService,
  updateBanner as updateBannerService,
  deleteBanner as deleteBannerService,
  fetchDiscounts as fetchDiscountsService,
  createDiscount as createDiscountService,
  updateDiscount as updateDiscountService,
  deleteDiscount as deleteDiscountService,
  fetchAuditLogs as fetchAuditLogsService,
  logAuditEvent,
} from "@/lib/services/promotionsService";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ORDER_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
  CANCELLED: "cancelled",
};

export { ROLES };

const createDefaultTables = (count = 50) =>
  Array.from({ length: count }, (_, i) => ({
    id: (i + 1).toString(),
    name: `Masa ${i + 1}`,
  }));

export const useAppStore = create((set, get) => ({
  // Settings / Branding
  settings: {
    restaurantName: "MenuFlow",
    restaurantLogo: "",
    logoDisplayMode: "name",
    currencySymbol: "₼",
    tableCount: 50,
    tagline: "Rəqəmsal QR Menyu və İdarəetmə Sistemi",
  },

  updateSettings: (newSettings) =>
    set((state) => {
      const currentSettings = state.settings || {
        restaurantName: "MenuFlow",
        restaurantLogo: "",
        logoDisplayMode: "name",
        currencySymbol: "₼",
        tableCount: 50,
        tagline: "Rəqəmsal QR Menyu və İdarəetmə Sistemi",
      };
      const updatedSettings = { ...currentSettings, ...newSettings };
      let updatedTables = state.tables || [];

      if (newSettings.tableCount !== undefined) {
        const count = Math.max(
          1,
          Math.min(200, parseInt(newSettings.tableCount, 10) || 1),
        );
        updatedSettings.tableCount = count;
        if (updatedTables.length > count) {
          updatedTables = updatedTables.slice(0, count);
        } else if (updatedTables.length < count) {
          updatedTables = [...updatedTables];
          for (let i = updatedTables.length + 1; i <= count; i++) {
            updatedTables.push({ id: i.toString(), name: `Masa ${i}` });
          }
        }
      }

      return {
        settings: updatedSettings,
        tables: updatedTables,
      };
    }),

  // Role State (UI role: which app surface is being shown)
  role: "customer",
  setRole: (role) => set({ role }),

  currentTable: null,
  setCurrentTable: (table) => set({ currentTable: table }),

  // Tenant (restaurant) context ------------------------------------------
  // restaurant: the full restaurant row the current app instance belongs to
  // (resolved from the /menu/[restaurant]/[table] slug for the customer
  // app, or from the signed-in user's profile for admin/staff).
  restaurant: null,
  setRestaurant: (restaurant) => set({ restaurant }),
  // Imzalı QR token (?t=...) — həmin masanın QR kodunda kodlanıb, sifariş/
  // çağırış RLS insert policy-ləri bunu server tərəfdə doğrulayır (bax:
  // supabase/migrations/0008_qr_token_verification.sql). Anon spoof
  // sifarişlərinin qarşısını almaq üçündür.
  qrToken: null,
  setQrToken: (qrToken) => set({ qrToken }),
  loadRestaurantBySlug: async (slug) => {
    const restaurant = await fetchRestaurantBySlug(slug);
    set({ restaurant });
    return restaurant;
  },
  // Theme Builder (Restoran dizaynı): persists theme colors to the
  // restaurant's row so the customer-facing menu can pick them up.
  //
  // Four colours as of 0043 — accent, text, page background, card surface.
  // themeSecondaryColor is the TEXT colour: before that migration it wrote a
  // column no renderer ever read, so the picker behind it did nothing.
  updateRestaurantDesign: async ({ themePrimaryColor, themeSecondaryColor, themeBackgroundColor, themeSurfaceColor }) => {
    const current = get().restaurant;
    if (!current?.id) return { restaurant: null, error: new Error('Restoran tapılmadı') };
    const { restaurant: updated, error } = await updateRestaurantService({
      id: current.id,
      themePrimaryColor,
      themeSecondaryColor,
      themeBackgroundColor,
      themeSurfaceColor,
    });
    if (!error && updated) {
      set({ restaurant: { ...current, ...updated } });
      get().recordAudit({
        action: 'theme.update',
        entityType: 'settings',
        entityId: current.id,
        summary: `Rənglər dəyişdirildi (düymə: ${themePrimaryColor}, mətn: ${themeSecondaryColor}, fon: ${themeBackgroundColor}, kart: ${themeSurfaceColor})`,
      });
    }
    return { restaurant: updated, error };
  },

  // Onboarding wizard (components/onboarding/OnboardingWizard.jsx): writes
  // the restaurant-info/branding/currency/contact fields the wizard collects
  // (migration 0024_onboarding_completion.sql adds phone/address/
  // onboarding_completed_at). Mirrors updateRestaurantDesign's shape above —
  // kept as a separate action rather than folded into it so a caller can't
  // accidentally overwrite theme colors while saving, say, just the contact
  // step.
  updateRestaurantProfile: async (fields) => {
    const current = get().restaurant;
    if (!current?.id) return { restaurant: null, error: new Error('Restoran tapılmadı') };
    const { restaurant: updated, error } = await updateRestaurantService({ id: current.id, ...fields });
    if (!error && updated) {
      set({ restaurant: { ...current, ...updated } });
    }
    return { restaurant: updated, error };
  },
  // Marks the wizard done (restaurants.onboarding_completed_at) — the field
  // middleware.js reads to stop bouncing this restaurant_admin into
  // /onboarding and start letting them into /admin. See migration 0024's
  // header for why this is safe for a restaurant_admin to write themselves.
  completeOnboarding: async () => {
    const current = get().restaurant;
    if (!current?.id) return { restaurant: null, error: new Error('Restoran tapılmadı') };
    const { restaurant: updated, error } = await updateRestaurantService({
      id: current.id,
      onboardingCompletedAt: new Date().toISOString(),
    });
    if (!error && updated) {
      set({ restaurant: { ...current, ...updated } });
      get().recordAudit({
        action: 'restaurant.onboarding_complete',
        entityType: 'settings',
        entityId: current.id,
        summary: 'Quraşdırma sihirbazı tamamlandı',
      });
    }
    return { restaurant: updated, error };
  },

  // Plan Definition + Plan Features/Entitlements (supabase/migrations/
  // 0021_plan_subscription_system.sql) — fetched once, cached here, and used
  // to hydrate lib/services/entitlementService.js's PLAN_FEATURE_DEFAULTS so
  // /pricing and the entitlement resolver read from the exact same DB rows
  // (see planService.js's module header). `plans` is active/sellable plans
  // only (what /pricing renders); the hardcoded PLAN_FEATURE_DEFAULTS stays
  // correct as a fallback until this resolves, so nothing needs to await it.
  plans: [],
  planFeatures: [],
  loadPlans: async () => {
    const [plans, planFeatures] = await Promise.all([fetchPlansService(), fetchPlanFeaturesService()]);
    hydratePlanFeatureDefaults(planFeatures);
    set({ plans, planFeatures });
    return { plans, planFeatures };
  },

  // profile: the signed-in user's role + restaurant assignment
  // (super_admin / restaurant_admin / staff / unassigned).
  profile: null,
  setProfile: (profile) => set({ profile }),
  loadProfile: async () => {
    const profile = await fetchMyProfile();
    const restaurant = profile?.restaurantId ? await fetchRestaurantById(profile.restaurantId) : null;
    set({ profile, restaurant });
    return profile;
  },

  // Menu Data
  products: DEFAULT_PRODUCTS,
  categories: DEFAULT_CATEGORIES,
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  loadMenuData: async () => {
    const restaurantId = get().restaurant?.id;
    const [products, categories] = await Promise.all([
      fetchProductsService(restaurantId),
      fetchCategoriesService(restaurantId),
    ]);
    // supabaseReady === false: no Supabase configured at all (fetch*Service
    // always returns []) — keep whatever's in state (the data/menu.json seed
    // on first load) so the app is still usable for local dev without
    // .env.local. supabaseReady === true: the query genuinely ran, so an
    // empty result means "this restaurant really has 0 products/categories
    // right now" — trust it. Without this split, a restaurant that deletes
    // its entire catalog would keep showing whatever was last in state (the
    // generic seed on a fresh page load) forever, because every refetch
    // that legitimately returns [] was silently discarded.
    set((state) => ({
      products: products.length > 0 || supabaseReady ? products : state.products,
      categories: categories.length > 0 || supabaseReady ? categories : state.categories,
    }));
    return { products, categories };
  },
  deleteProduct: async (id) => {
    const restaurantId = get().restaurant?.id;
    const { error } = await deleteProductService(id);
    if (!error) {
      const products = await fetchProductsService(restaurantId);
      const categories = await fetchCategoriesService(restaurantId);
      set({ products: products.length > 0 ? products : [], categories: categories.length > 0 ? categories : [] });
      get().recordAudit({ action: 'product.delete', entityType: 'product', entityId: id, summary: 'Məhsul silindi' });
    }
    return { error };
  },
  deleteCategory: async (id) => {
    const restaurantId = get().restaurant?.id;
    const { error } = await deleteCategoryService(id);
    if (!error) {
      const categories = await fetchCategoriesService(restaurantId);
      const products = await fetchProductsService(restaurantId);
      set({ categories: categories.length > 0 ? categories : [], products: products.length > 0 ? products : [] });
    }
    return { error };
  },

  // Tables
  tables: createDefaultTables(50),
  setTables: (tables) => set({ tables }),
  loadTables: async () => {
    const restaurantId = get().restaurant?.id;
    const tables = await fetchTablesService(restaurantId);
    // Same reasoning as loadMenuData above: only fall back to the generic
    // seed tables when Supabase isn't configured at all, not whenever a
    // real (possibly legitimately empty) fetch comes back.
    if (tables.length > 0 || supabaseReady) {
      set({ tables });
    }
    return tables;
  },
  // Yalnız Admin Panel -> "QR Kodlar" üçün: qr_token sütunu adi table
  // sorğusunda gəlmir (bax: fetchRestaurantQrTokens), bu ayrıca yüklənir.
  qrTokensByTableId: {},
  loadQrTokens: async () => {
    const restaurantId = get().restaurant?.id;
    const qrTokensByTableId = await fetchRestaurantQrTokensService(restaurantId);
    set({ qrTokensByTableId });
    return qrTokensByTableId;
  },
  updateTableName: async (id, name) => {
    const restaurantId = get().restaurant?.id;
    const { table, error } = await updateTableNameService(id, name);
    if (!error && table) {
      const tables = await fetchTablesService(restaurantId);
      set({ tables });
    }
    return { table, error };
  },

  // Orders
  orders: [],
  setOrders: (orders) => set({ orders }),
  // Staff/Admin path — `orders` RLS has no anon SELECT policy (every policy
  // is `{authenticated} using (is_staff_of(...))`), so this always returns
  // everything for a signed-in staff member and always returns [] for an
  // anonymous customer. Never call this from the customer surface — see
  // loadTableOrders below for that path.
  loadOrders: async () => {
    const restaurantId = get().restaurant?.id;
    const orders = await fetchOrdersService(restaurantId);
    set({ orders });
  },
  // Customer path (anon), scoped to one table via the get_table_orders()
  // RPC (0025_order_payment_status.sql) — QR-token-gated, same auditorium as
  // place_order()/upsert_alert(). Takes the resolved DB table id explicitly
  // (CustomerApp only knows it once its own `tables` fetch + route param
  // resolve, same pattern updateTableName(id, ...) already uses).
  loadTableOrders: async (tableId) => {
    // `tables` starts out as the generic seed (createDefaultTables(50),
    // ids "1".."50" — not UUIDs) before the real restaurant-scoped fetch
    // resolves. CustomerApp's own `resolvedTable` lookup can match that seed
    // row by `t.id === tableId` on the very first render (before real
    // tables load), which would otherwise pass a plain "1" here straight
    // into a uuid-typed RPC parameter and fail with a Postgres 22P02 error.
    // Same defensive shape as CartDrawer's/supabaseService's own isUuid().
    if (!tableId || !UUID_RE.test(tableId)) return [];
    const restaurantId = get().restaurant?.id;
    const qrToken = get().qrToken;
    const orders = await fetchTableOrdersService(restaurantId, tableId, qrToken);
    set({ orders });
    return orders;
  },
  createOrder: async ({ tableId, total, items, note, paymentMethod, paymentMethodLabel }) => {
    const restaurantId = get().restaurant?.id;
    const qrToken = get().qrToken;
    const { order, orderId, error } = await createOrderService({ tableId, total, items, note, restaurantId, qrToken, paymentMethod, paymentMethodLabel });
    // Gate on `orderId`, not `order` — createOrderService's own `order`
    // field comes from a staff-only lookup (fetchOrderById) that always
    // comes back null for this anon customer session, even on a genuinely
    // successful insert. Gating on `order` here meant this refetch — and
    // therefore the new order ever appearing in "Aktiv Sifarişlərim" — never
    // ran at all for a real customer.
    if (!error && orderId) {
      // fetchOrdersService (staff-only) would silently wipe `orders` back to
      // [] here — this action is called from the customer's own anon
      // session (CartDrawer), so it must re-fetch through the same
      // QR-gated, table-scoped path loadTableOrders uses. tableId here is
      // already the resolved DB table UUID (CartDrawer resolves it before
      // calling createOrder), matching what loadTableOrders expects.
      const orders = await fetchTableOrdersService(restaurantId, tableId, qrToken);
      set({ orders });
    }
    return { order, error };
  },
  updateOrderStatus: async (id, status) => {
    const restaurantId = get().restaurant?.id;
    const { order, error } = await updateOrderStatusService(id, status);
    if (!error && order) {
      const orders = await fetchOrdersService(restaurantId);
      set({ orders });
    }
    return { order, error };
  },
  // Staff-only (settle_table_payment RPC has anon EXECUTE revoked). Settles
  // an entire table's unpaid balance — see the migration's header for why
  // this is table-scoped rather than per-order. `paid: false` reverses a
  // mis-tap. Same refresh-then-audit shape every other mutating action here
  // follows.
  settleTablePayment: async ({ tableId, paymentMethod, paymentMethodLabel, paid = true }) => {
    const restaurantId = get().restaurant?.id;
    const { result, error } = await settleTablePaymentService({ restaurantId, tableId, paymentMethod, paymentMethodLabel, paid });
    if (!error && result) {
      const orders = await fetchOrdersService(restaurantId);
      set({ orders });
      get().recordAudit({
        action: paid ? 'order.payment_settled' : 'order.payment_reverted',
        entityType: 'table',
        entityId: tableId,
        summary: paid
          ? `Masa hesabı bağlandı: ${result.settled_count} sifariş, ${result.settled_total} ${paymentMethodLabel || paymentMethod || ''}`
          : `Ödəniş təsdiqi geri alındı: ${result.settled_count} sifariş`,
      });
    }
    return { result, error };
  },

  // Restoran heyəti (Admin -> İstifadəçilər, oxu-only, 0028). Tək admin öz
  // ayarını oxuyur (yaratma/silmə yoxdur), ona görə realtime abunəliyi yoxdur
  // — posIntegration slice-ının şərhi ilə eyni məntiq.
  restaurantStaff: [],
  loadRestaurantStaff: async () => {
    const restaurantId = get().restaurant?.id;
    const restaurantStaff = await fetchRestaurantStaffService(restaurantId);
    set({ restaurantStaff });
    return restaurantStaff;
  },

  // POS (kassa) inteqrasiyası — Poster POS (0026_pos_integration.sql). Tək
  // admin öz ayarını redaktə edir (orders/products-dan fərqli olaraq eyni
  // anda çoxlu izləyici yoxdur), ona görə realtime abunəliyi yoxdur.
  posIntegration: null,
  loadPosIntegration: async () => {
    const restaurantId = get().restaurant?.id;
    const posIntegration = await fetchPosIntegrationStatusService(restaurantId);
    set({ posIntegration });
    return posIntegration;
  },
  savePosIntegration: async ({ accountIdentifier, apiToken, syncMenuEnabled, syncOrdersEnabled }) => {
    const restaurantId = get().restaurant?.id;
    const { status, error } = await savePosCredentialsService({ restaurantId, accountIdentifier, apiToken, syncMenuEnabled, syncOrdersEnabled });
    if (!error && status) {
      set({ posIntegration: await fetchPosIntegrationStatusService(restaurantId) });
      // apiToken heç vaxt audit summary-yə düşmür — yalnız hansı sahələrin
      // dəyişdiyi qeyd olunur, dəyərləri yox.
      get().recordAudit({
        action: 'pos_integration.update',
        entityType: 'pos_integration',
        entityId: restaurantId,
        summary: `Poster POS ayarları yeniləndi (hesab: ${accountIdentifier || status.account_identifier || '—'})`,
      });
    }
    return { status, error };
  },
  disconnectPosIntegrationAction: async () => {
    const restaurantId = get().restaurant?.id;
    const { error } = await disconnectPosIntegrationService(restaurantId);
    if (!error) {
      set({ posIntegration: await fetchPosIntegrationStatusService(restaurantId) });
      get().recordAudit({
        action: 'pos_integration.disconnect',
        entityType: 'pos_integration',
        entityId: restaurantId,
        summary: 'Poster POS bağlantısı kəsildi',
      });
    }
    return { error };
  },
  // Read-only connection test — deliberately does NOT refetch products/
  // categories/posIntegration or record an audit entry, unlike syncPosMenu
  // below: the Edge Function's dryRun branch writes nothing, so there is
  // nothing new to reflect.
  testPosConnection: async () => {
    const restaurantId = get().restaurant?.id;
    return syncPosMenuNowService(restaurantId, { dryRun: true });
  },
  syncPosMenu: async () => {
    const restaurantId = get().restaurant?.id;
    const { result, error } = await syncPosMenuNowService(restaurantId);
    if (!error && result) {
      const [products, categories] = await Promise.all([fetchProductsService(restaurantId), fetchCategoriesService(restaurantId)]);
      set({
        products: products.length > 0 || supabaseReady ? products : get().products,
        categories: categories.length > 0 || supabaseReady ? categories : get().categories,
        posIntegration: await fetchPosIntegrationStatusService(restaurantId),
      });
      get().recordAudit({
        action: 'pos_integration.menu_sync',
        entityType: 'pos_integration',
        entityId: restaurantId,
        summary: `${result.categoriesUpserted} kateqoriya, ${result.productsUpserted} məhsul sinxronlaşdı`,
      });
    }
    return { result, error };
  },

  // Alerts
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  loadAlerts: async () => {
    const restaurantId = get().restaurant?.id;
    const alerts = await fetchAlertsService(restaurantId);
    set({ alerts });
  },
  createAlert: async ({ tableId, type, paymentMethod, paymentMethodLabel, note }) => {
    const restaurantId = get().restaurant?.id;
    const qrToken = get().qrToken;
    const { alert, error } = await createAlertService({ tableId, type, paymentMethod, paymentMethodLabel, note, restaurantId, qrToken });
    if (!error && alert) {
      const alerts = await fetchAlertsService(restaurantId);
      set({ alerts });
    }
    return { alert, error };
  },
  resolveAlert: async (id) => {
    const restaurantId = get().restaurant?.id;
    const { alert, error } = await resolveAlertService(id);
    if (!error && alert) {
      const alerts = await fetchAlertsService(restaurantId);
      set({ alerts });
    }
    return { alert, error };
  },

  // Product / Category helpers
  createProduct: async (product) => {
    const restaurantId = get().restaurant?.id;
    const { product: createdProduct, error } = await createProductService(product, restaurantId);
    if (!error && createdProduct) {
      const products = await fetchProductsService(restaurantId);
      const categories = await fetchCategoriesService(restaurantId);
      set({ products, categories });
      get().recordAudit({ action: 'product.create', entityType: 'product', entityId: createdProduct.id, summary: `Yeni məhsul əlavə edildi: ${createdProduct.name}` });
    }
    return { product: createdProduct, error };
  },
  updateProduct: async (product) => {
    const restaurantId = get().restaurant?.id;
    const { product: updatedProduct, error } = await updateProductService(product);
    if (!error && updatedProduct) {
      const products = await fetchProductsService(restaurantId);
      const categories = await fetchCategoriesService(restaurantId);
      set({ products, categories });
      get().recordAudit({ action: 'product.update', entityType: 'product', entityId: updatedProduct.id, summary: `Məhsul yeniləndi: ${updatedProduct.name}` });
    }
    return { product: updatedProduct, error };
  },
  createCategory: async (category) => {
    const restaurantId = get().restaurant?.id;
    // Land new categories at the END of the current order rather than at
    // the default sort_order 0, which would silently drop every new one
    // into the alphabetical tiebreaker block ahead of already-ordered
    // rows. Same append-on-create shape DesignTab uses for banners.
    const sortOrder = (get().categories.length + 1) * 10;
    const { category: createdCategory, error } = await createCategoryService(
      { sort_order: sortOrder, ...category },
      restaurantId,
    );
    if (!error && createdCategory) {
      const categories = await fetchCategoriesService(restaurantId);
      const products = await fetchProductsService(restaurantId);
      set({ categories, products });
    }
    return { category: createdCategory, error };
  },
  updateCategory: async (category) => {
    const restaurantId = get().restaurant?.id;
    const { category: updatedCategory, error } = await updateCategoryService(category);
    if (!error && updatedCategory) {
      const categories = await fetchCategoriesService(restaurantId);
      const products = await fetchProductsService(restaurantId);
      set({ categories, products });
    }
    return { category: updatedCategory, error };
  },
  // Persists a whole new category order in one go. Follows the store's
  // standard shape: service call -> refetch the collection -> set() ->
  // recordAudit. Products are refetched alongside categories the same way
  // create/updateCategory already do, so a menu grid grouped by category
  // re-renders in the new order without a page reload.
  reorderCategories: async (idsInDesiredOrder) => {
    const restaurantId = get().restaurant?.id;
    const { error } = await reorderCategoriesService(idsInDesiredOrder);
    if (!error) {
      const categories = await fetchCategoriesService(restaurantId);
      const products = await fetchProductsService(restaurantId);
      set({ categories, products });
      get().recordAudit({ action: 'category.reorder', entityType: 'category', entityId: '', summary: `Kateqoriya sırası dəyişdirildi (${idsInDesiredOrder.length} kateqoriya)` });
    }
    return { error };
  },

  // Platform announcements (SuperAdmin -> restoran sahibi, admin panelindəki
  // zəng ikonu) --------------------------------------------------------------
  //
  // Oxunmamış sayı burada saxlanmır, komponentdə bu iki massivdən hesablanır:
  // ayrıca sayğac saxlamaq onu hər oxunma/realtime hadisəsində sinxron
  // saxlamaq öhdəliyi yaradardı, halbuki həcm onlarla sətirdir.
  announcements: [],
  announcementReadIds: [],
  loadAnnouncements: async () => {
    const [announcements, announcementReadIds] = await Promise.all([
      fetchAnnouncementsService(),
      fetchMyReadIdsService(),
    ]);
    set({ announcements, announcementReadIds });
    return announcements;
  },
  markAnnouncementsRead: async (ids) => {
    const profileId = get().profile?.id;
    if (!profileId || !ids?.length) return { error: null };
    const { error } = await markAnnouncementsReadService(ids, profileId);
    if (!error) set({ announcementReadIds: await fetchMyReadIdsService() });
    return { error };
  },

  // Auth
  isAdminAuthenticated: false,
  setIsAdminAuthenticated: (auth) => set({ isAdminAuthenticated: auth }),

  // Helper: records "who / when / what changed" for the current restaurant
  // + signed-in admin, then continues without blocking the caller.
  recordAudit: ({ action, entityType, entityId, summary }) => {
    const restaurantId = get().restaurant?.id;
    const profile = get().profile;
    logAuditEvent({
      restaurantId,
      actorId: profile?.id,
      actorEmail: profile?.email,
      action,
      entityType,
      entityId,
      summary,
    });
  },

  // Banners (Restoran dizaynı -> Banner sistemi) ---------------------------
  banners: [],
  loadBanners: async () => {
    const restaurantId = get().restaurant?.id;
    const banners = await fetchBannersService(restaurantId);
    set({ banners });
    return banners;
  },
  createBanner: async (banner) => {
    const restaurantId = get().restaurant?.id;
    const { banner: created, error } = await createBannerService(banner, restaurantId);
    if (!error && created) {
      set({ banners: await fetchBannersService(restaurantId) });
      get().recordAudit({ action: 'banner.create', entityType: 'banner', entityId: created.id, summary: `Banner əlavə edildi: ${created.title || created.image_url}` });
    }
    return { banner: created, error };
  },
  updateBanner: async (banner) => {
    const restaurantId = get().restaurant?.id;
    const { banner: updated, error } = await updateBannerService(banner);
    if (!error && updated) {
      set({ banners: await fetchBannersService(restaurantId) });
      get().recordAudit({ action: 'banner.update', entityType: 'banner', entityId: updated.id, summary: `Banner yeniləndi: ${updated.title || updated.image_url}` });
    }
    return { banner: updated, error };
  },
  deleteBanner: async (id) => {
    const restaurantId = get().restaurant?.id;
    const { error } = await deleteBannerService(id);
    if (!error) {
      set({ banners: await fetchBannersService(restaurantId) });
      get().recordAudit({ action: 'banner.delete', entityType: 'banner', entityId: id, summary: 'Banner silindi' });
    }
    return { error };
  },

  // Discounts (Endirimlər / Admin -> Endirim) -------------------------------
  discounts: [],
  loadDiscounts: async () => {
    const restaurantId = get().restaurant?.id;
    const discounts = await fetchDiscountsService(restaurantId);
    set({ discounts });
    return discounts;
  },
  createDiscount: async (discount) => {
    const restaurantId = get().restaurant?.id;
    const { discount: created, error } = await createDiscountService(discount, restaurantId);
    if (!error && created) {
      set({ discounts: await fetchDiscountsService(restaurantId) });
      get().recordAudit({ action: 'discount.create', entityType: 'discount', entityId: created.id, summary: `Endirim əlavə edildi: ${created.title}` });
    }
    return { discount: created, error };
  },
  updateDiscount: async (discount) => {
    const restaurantId = get().restaurant?.id;
    const { discount: updated, error } = await updateDiscountService(discount);
    if (!error && updated) {
      set({ discounts: await fetchDiscountsService(restaurantId) });
      get().recordAudit({ action: 'discount.update', entityType: 'discount', entityId: updated.id, summary: `Endirim yeniləndi: ${updated.title}` });
    }
    return { discount: updated, error };
  },
  deleteDiscount: async (id) => {
    const restaurantId = get().restaurant?.id;
    const { error } = await deleteDiscountService(id);
    if (!error) {
      set({ discounts: await fetchDiscountsService(restaurantId) });
      get().recordAudit({ action: 'discount.delete', entityType: 'discount', entityId: id, summary: 'Endirim silindi' });
    }
    return { error };
  },

  // Audit log (Admin -> Audit Log) ------------------------------------------
  auditLogs: [],
  loadAuditLogs: async () => {
    const restaurantId = get().restaurant?.id;
    const auditLogs = await fetchAuditLogsService(restaurantId);
    set({ auditLogs });
    return auditLogs;
  },
}));
