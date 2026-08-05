import { create } from "zustand";
import { PRODUCTS as DEFAULT_PRODUCTS, CATEGORIES as DEFAULT_CATEGORIES } from "@/data/menuData";
import {
  createProduct as createProductService,
  updateProduct as updateProductService,
  deleteProduct as deleteProductService,
  createCategory as createCategoryService,
  updateCategory as updateCategoryService,
  deleteCategory as deleteCategoryService,
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
  fetchAlerts as fetchAlertsService,
} from "@/lib/services/supabaseService";
import { fetchMyProfile, fetchRestaurantBySlug, fetchRestaurantById, ROLES } from "@/lib/services/authService";
import { updateRestaurant as updateRestaurantService } from "@/lib/services/superAdminService";
import {
  fetchBanners as fetchBannersService,
  createBanner as createBannerService,
  updateBanner as updateBannerService,
  deleteBanner as deleteBannerService,
  fetchCampaigns as fetchCampaignsService,
  createCampaign as createCampaignService,
  updateCampaign as updateCampaignService,
  deleteCampaign as deleteCampaignService,
  fetchDiscounts as fetchDiscountsService,
  createDiscount as createDiscountService,
  updateDiscount as updateDiscountService,
  deleteDiscount as deleteDiscountService,
  fetchAuditLogs as fetchAuditLogsService,
  logAuditEvent,
} from "@/lib/services/promotionsService";

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
    currencySymbol: "₼",
    tableCount: 50,
    tagline: "Rəqəmsal QR Menyu və İdarəetmə Sistemi",
  },

  updateSettings: (newSettings) =>
    set((state) => {
      const currentSettings = state.settings || {
        restaurantName: "MenuFlow",
        restaurantLogo: "",
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
  updateRestaurantDesign: async ({ themePrimaryColor, themeSecondaryColor }) => {
    const current = get().restaurant;
    if (!current?.id) return { restaurant: null, error: new Error('Restoran tapılmadı') };
    const { restaurant: updated, error } = await updateRestaurantService({
      id: current.id,
      themePrimaryColor,
      themeSecondaryColor,
    });
    if (!error && updated) {
      set({ restaurant: { ...current, ...updated } });
      get().recordAudit({
        action: 'theme.update',
        entityType: 'settings',
        entityId: current.id,
        summary: `Rənglər dəyişdirildi (əsas: ${themePrimaryColor}, ikinci: ${themeSecondaryColor})`,
      });
    }
    return { restaurant: updated, error };
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
    set((state) => ({
      products: products.length > 0 ? products : state.products,
      categories: categories.length > 0 ? categories : state.categories,
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
    if (tables.length > 0) {
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
  loadOrders: async () => {
    const restaurantId = get().restaurant?.id;
    const orders = await fetchOrdersService(restaurantId);
    set({ orders });
  },
  createOrder: async ({ tableId, total, items, note, paymentMethod, paymentMethodLabel }) => {
    const restaurantId = get().restaurant?.id;
    const qrToken = get().qrToken;
    const { order, error } = await createOrderService({ tableId, total, items, note, restaurantId, qrToken, paymentMethod, paymentMethodLabel });
    if (!error && order) {
      const orders = await fetchOrdersService(restaurantId);
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
    const { category: createdCategory, error } = await createCategoryService(category, restaurantId);
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

  // Campaigns (Admin -> Kampaniya) ------------------------------------------
  campaigns: [],
  loadCampaigns: async () => {
    const restaurantId = get().restaurant?.id;
    const campaigns = await fetchCampaignsService(restaurantId);
    set({ campaigns });
    return campaigns;
  },
  createCampaign: async (campaign) => {
    const restaurantId = get().restaurant?.id;
    const { campaign: created, error } = await createCampaignService(campaign, restaurantId);
    if (!error && created) {
      set({ campaigns: await fetchCampaignsService(restaurantId) });
      get().recordAudit({ action: 'campaign.create', entityType: 'campaign', entityId: created.id, summary: `Kampaniya əlavə edildi: ${created.title}` });
    }
    return { campaign: created, error };
  },
  updateCampaign: async (campaign) => {
    const restaurantId = get().restaurant?.id;
    const { campaign: updated, error } = await updateCampaignService(campaign);
    if (!error && updated) {
      set({ campaigns: await fetchCampaignsService(restaurantId) });
      get().recordAudit({ action: 'campaign.update', entityType: 'campaign', entityId: updated.id, summary: `Kampaniya yeniləndi: ${updated.title}` });
    }
    return { campaign: updated, error };
  },
  deleteCampaign: async (id) => {
    const restaurantId = get().restaurant?.id;
    const { error } = await deleteCampaignService(id);
    if (!error) {
      set({ campaigns: await fetchCampaignsService(restaurantId) });
      get().recordAudit({ action: 'campaign.delete', entityType: 'campaign', entityId: id, summary: 'Kampaniya silindi' });
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
