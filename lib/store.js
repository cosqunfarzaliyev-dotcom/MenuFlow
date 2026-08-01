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
  fetchOrders as fetchOrdersService,
  fetchAlerts as fetchAlertsService,
} from "@/lib/services/supabaseService";

export const ORDER_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
  CANCELLED: "cancelled",
};

const createDefaultTables = (count = 50) =>
  Array.from({ length: count }, (_, i) => ({
    id: (i + 1).toString(),
    name: `Masa ${i + 1}`,
  }));

export const useAppStore = create((set) => ({
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

  // Role State
  role: "customer",
  setRole: (role) => set({ role }),

  currentTable: null,
  setCurrentTable: (table) => set({ currentTable: table }),

  // Menu Data
  products: DEFAULT_PRODUCTS,
  categories: DEFAULT_CATEGORIES,
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  loadMenuData: async () => {
    const [products, categories] = await Promise.all([
      fetchProductsService(),
      fetchCategoriesService(),
    ]);
    set((state) => ({
      products: products.length > 0 ? products : state.products,
      categories: categories.length > 0 ? categories : state.categories,
    }));
    return { products, categories };
  },
  deleteProduct: async (id) => {
    const { error } = await deleteProductService(id);
    if (!error) {
      set((state) => ({ products: state.products.filter((item) => item.id !== id) }));
    }
    return { error };
  },
  deleteCategory: async (id) => {
    const { error } = await deleteCategoryService(id);
    if (!error) {
      set((state) => ({ categories: state.categories.filter((item) => item.id !== id) }));
    }
    return { error };
  },

  // Tables
  tables: createDefaultTables(50),
  setTables: (tables) => set({ tables }),
  loadTables: async () => {
    const tables = await fetchTablesService();
    if (tables.length > 0) {
      set({ tables });
    }
    return tables;
  },
  updateTableName: async (id, name) => {
    const { table, error } = await updateTableNameService(id, name);
    if (!error && table) {
      set((state) => ({
        tables: state.tables.map((t) => (t.id === id ? table : t)),
      }));
    }
    return { table, error };
  },

  // Orders
  orders: [],
  setOrders: (orders) => set({ orders }),
  loadOrders: async () => {
    const orders = await fetchOrdersService();
    set({ orders });
  },
  createOrder: async ({ tableId, total, items, note }) => {
    const { order, error } = await createOrderService({ tableId, total, items, note });
    if (!error && order) {
      set((state) => ({ orders: [...state.orders, order] }));
    }
    return { order, error };
  },
  updateOrderStatus: async (id, status) => {
    const { order, error } = await updateOrderStatusService(id, status);
    if (!error && order) {
      set((state) => ({
        orders: state.orders.map((current) =>
          current.id === order.id ? order : current,
        ),
      }));
    }
    return { order, error };
  },

  // Alerts
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  loadAlerts: async () => {
    const alerts = await fetchAlertsService();
    set({ alerts });
  },
  createAlert: async ({ tableId, type, paymentMethod, paymentMethodLabel, note }) => {
    const { alert, error } = await createAlertService({ tableId, type, paymentMethod, paymentMethodLabel, note });
    if (!error && alert) {
      set((state) => ({ alerts: [...state.alerts, alert] }));
    }
    return { alert, error };
  },
  resolveAlert: async (id) => {
    const { alert, error } = await resolveAlertService(id);
    if (!error && alert) {
      set((state) => ({
        alerts: state.alerts.map((current) =>
          current.id === alert.id ? alert : current,
        ),
      }));
    }
    return { alert, error };
  },

  // Product / Category helpers
  createProduct: async (product) => {
    const { product: createdProduct, error } = await createProductService(product);
    if (!error && createdProduct) {
      set((state) => ({ products: [...state.products, createdProduct] }));
    }
    return { product: createdProduct, error };
  },
  updateProduct: async (product) => {
    const { product: updatedProduct, error } = await updateProductService(product);
    if (!error && updatedProduct) {
      set((state) => ({
        products: state.products.map((current) =>
          current.id === updatedProduct.id ? updatedProduct : current,
        ),
      }));
    }
    return { product: updatedProduct, error };
  },
  createCategory: async (category) => {
    const { category: createdCategory, error } = await createCategoryService(category);
    if (!error && createdCategory) {
      set((state) => ({ categories: [...state.categories, createdCategory] }));
    }
    return { category: createdCategory, error };
  },
  updateCategory: async (category) => {
    const { category: updatedCategory, error } = await updateCategoryService(category);
    if (!error && updatedCategory) {
      set((state) => ({
        categories: state.categories.map((current) =>
          current.id === updatedCategory.id ? updatedCategory : current,
        ),
      }));
    }
    return { category: updatedCategory, error };
  },

  // Auth (simple demo auth)
  isAdminAuthenticated: false,
  setIsAdminAuthenticated: (auth) => set({ isAdminAuthenticated: auth }),
}));
