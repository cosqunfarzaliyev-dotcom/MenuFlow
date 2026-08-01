import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { PRODUCTS, CATEGORIES } from "@/data/menuData";

export const ORDER_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
  CANCELLED: "cancelled",
};

export const BROADCAST_CHANNEL_NAME = "menuflow_orders";

const ORDER_STATUS_FLOW = {
  [ORDER_STATUS.PENDING]: ORDER_STATUS.ACCEPTED,
  [ORDER_STATUS.ACCEPTED]: ORDER_STATUS.PREPARING,
  [ORDER_STATUS.PREPARING]: ORDER_STATUS.READY,
  [ORDER_STATUS.READY]: ORDER_STATUS.SERVED,
  [ORDER_STATUS.SERVED]: ORDER_STATUS.CANCELLED,
};

let broadcastChannel;

const getBroadcastChannel = () => {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return null;
  }

  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }

  return broadcastChannel;
};

export const broadcastEvent = (type, payload = {}) => {
  if (typeof window === "undefined") return;
  const eventData = { type, payload, timestamp: Date.now() };

  try {
    getBroadcastChannel()?.postMessage(eventData);
  } catch (e) {
    console.error("BroadcastChannel error:", e);
  }

  try {
    localStorage.setItem("menuflow_realtime_event", JSON.stringify(eventData));
  } catch (e) {
    console.error("localStorage event error:", e);
  }
};

export const useAppStore = create(
  persist(
    (set, get) => ({
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

          const res = {
            settings: updatedSettings,
            tables: updatedTables,
          };
          broadcastEvent("UPDATE_SETTINGS", updatedSettings);
          return res;
        }),

      // Role State
      role: "customer",
      setRole: (role) => set({ role }),

      currentTable: null,

      setCurrentTable: (table) =>
        set({
          currentTable: table,
        }),

      // Menu Data
      products: PRODUCTS,
      categories: CATEGORIES,
      setProducts: (products) => {
        set({ products });
        broadcastEvent("UPDATE_PRODUCTS", products);
      },
      setCategories: (categories) => {
        set({ categories });
        broadcastEvent("UPDATE_CATEGORIES", categories);
      },
      deleteProduct: (id) =>
        set((state) => {
          const updated = state.products.filter((p) => p.id !== id);
          broadcastEvent("UPDATE_PRODUCTS", updated);
          return { products: updated };
        }),
      deleteCategory: (id) =>
        set((state) => {
          const updated = state.categories.filter((c) => c.id !== id);
          broadcastEvent("UPDATE_CATEGORIES", updated);
          return { categories: updated };
        }),

      // Tables
      tables: Array.from({ length: 50 }, (_, i) => ({
        id: (i + 1).toString(),
        name: `Masa ${i + 1}`,
      })),
      updateTableName: (id, name) =>
        set((state) => {
          const updatedTables = state.tables.map((t) =>
            t.id === id ? { ...t, name } : t,
          );
          broadcastEvent("UPDATE_TABLES", updatedTables);
          return { tables: updatedTables };
        }),

      // Orders
      orders: [], // { id, table, items, status: ORDER_STATUS value, time, total }
      addOrder: (order) => {
        const newOrder = {
          ...order,
          id: uuidv4(),
          time: new Date().toISOString(),
        };

        set((state) => ({
          orders: [...state.orders, newOrder],
        }));

        broadcastEvent("NEW_ORDER", newOrder);
      },
      updateOrderStatus: (id, status) => {
        let changed = false;
        set((state) => {
          const orders = state.orders.map((order) => {
            if (order.id !== id || ORDER_STATUS_FLOW[order.status] !== status) {
              return order;
            }

            changed = true;
            return { ...order, status };
          });

          return { orders };
        });

        if (changed) broadcastEvent("UPDATE_ORDER_STATUS", { id, status });
      },

      // Waiter Calls & Bill Requests
      alerts: [], // { id, table, type: 'waiter'|'bill', status: 'active'|'resolved', time }
      addAlert: (alert) => {
        const newAlert = {
          ...alert,
          id: Date.now().toString(),
          status: "active",
          time: new Date().toISOString(),
        };
        set((state) => ({ alerts: [...state.alerts, newAlert] }));
        broadcastEvent("NEW_ALERT", newAlert);
      },
      resolveAlert: (id) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, status: "resolved" } : a,
          ),
        }));
        broadcastEvent("RESOLVE_ALERT", { id });
      },

      // Auth (simple demo auth)
      isAdminAuthenticated: false,
      setIsAdminAuthenticated: (auth) => set({ isAdminAuthenticated: auth }),
    }),
    {
      name: "restaurant-storage", // unique name
      version: 2,
      migrate: (persistedState) => ({
        ...persistedState,
        orders: (persistedState?.orders || []).map((order) => ({
          ...order,
          status:
            order.status === "completed" ? ORDER_STATUS.SERVED : order.status || ORDER_STATUS.PENDING,
        })),
      }),
    },
  ),
);

// Global cross-tab store rehydration listener
if (typeof window !== "undefined") {
  const syncStore = () => {
    if (
      useAppStore.persist &&
      typeof useAppStore.persist.rehydrate === "function"
    ) {
      useAppStore.persist.rehydrate();
    }
  };

  try {
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data) {
          syncStore();
        }
      };
    }
  } catch (e) {
    console.error("Error attaching BroadcastChannel listener:", e);
  }

  window.addEventListener("storage", (e) => {
    if (e.key === "restaurant-storage" || e.key === "menuflow_realtime_event") {
      syncStore();
    }
  });
}
