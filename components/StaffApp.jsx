"use client";

import { supabase, supabaseReady } from '@/lib/supabase';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAppStore, BROADCAST_CHANNEL_NAME, ORDER_STATUS } from '@/lib/store';
import { CheckCircle2, Clock, Bell, UserSquare2, UtensilsCrossed, Check, QrCode } from 'lucide-react';
import { OrderCard } from '@/components/staff/OrderCard';

export function StaffApp() {
  const { orders, updateOrderStatus, alerts, resolveAlert, tables, settings: rawSettings } = useAppStore();
  const settings = rawSettings || { restaurantName: 'MenuFlow' };
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'alerts'
  const [notification, setNotification] = useState(null);

  const initializedRef = useRef(false);
  const prevOrdersLen = useRef(0);
  const prevAlertsLen = useRef(0);
  const notificationTimeoutRef = useRef(null);

  const getTableName = (id) => {
    const t = tables.find(t => t.id === id);
    return t ? t.name : `Masa ${id}`;
  };

  const playChimeSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.7);
    } catch (e) {
      console.log("Audio play error:", e);
    }
  };

  const triggerNotification = (msg) => {
    setNotification(msg);
    playChimeSound();
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Real-time listener for BroadcastChannel & Storage events
  useEffect(() => {
    if (!supabaseReady) {
      console.warn("Supabase client is not ready; skipping realtime subscriptions.");
      return;
    }

    const channel = supabase
      .channel('staff-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log("Yeni Supabase sifarişi:", payload.new);

          triggerNotification("⚡ Yeni sifariş gəldi!");

          if (useAppStore.persist && typeof useAppStore.persist.rehydrate === 'function') {
            useAppStore.persist.rehydrate();
          }
        }
      )
      .subscribe();

    const handleRealtimeMessage = (eventData) => {
      if (!eventData) return;
      if (useAppStore.persist && typeof useAppStore.persist.rehydrate === 'function') {
        useAppStore.persist.rehydrate();
      }

      const { type, payload } = eventData;
      if (type === 'NEW_ORDER') {
        const tableName = payload?.table ? getTableName(payload.table) : '';
        triggerNotification(`⚡ YENİ SİFARİŞ GƏLDİ! ${tableName ? `(${tableName})` : ''}`);
      } else if (type === 'NEW_ALERT') {
        const tableName = payload?.table ? getTableName(payload.table) : '';
        if (payload?.type === 'bill') {
          triggerNotification(`💳 HESAB İSTƏNİLDİ! ${tableName ? `(${tableName})` : ''}`);
        } else {
          triggerNotification(`🔔 OFİSİANT ÇAĞIRILDI! ${tableName ? `(${tableName})` : ''}`);
        }
      }
    };

    let bc;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.onmessage = (event) => {
          handleRealtimeMessage(event.data);
        };
      }
    } catch (e) {
      console.error(e);
    }

    const handleStorageChange = (e) => {
      if (e.key === 'menuflow_realtime_event' && e.newValue) {
        try {
          const eventData = JSON.parse(e.newValue);
          handleRealtimeMessage(eventData);
        } catch (err) {
          console.error(err);
        }
      } else if (e.key === 'restaurant-storage') {
        if (useAppStore.persist && typeof useAppStore.persist.rehydrate === 'function') {
          useAppStore.persist.rehydrate();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorageChange);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      prevOrdersLen.current = orders.length;
      prevAlertsLen.current = alerts.length;
      initializedRef.current = true;
      return;
    }

    if (orders.length > prevOrdersLen.current) {
      const latestOrder = orders[orders.length - 1];
      const tableName = latestOrder?.table ? getTableName(latestOrder.table) : '';
      triggerNotification(`⚡ YENİ SİFARİŞ GƏLDİ! ${tableName ? `(${tableName})` : ''}`);
    } else if (alerts.length > prevAlertsLen.current) {
      const latestAlert = alerts[alerts.length - 1];
      const tableName = latestAlert?.table ? getTableName(latestAlert.table) : '';
      if (latestAlert?.type === 'bill') {
        triggerNotification(`💳 HESAB İSTƏNİLDİ! ${tableName ? `(${tableName})` : ''}`);
      } else {
        triggerNotification(`🔔 OFİSİANT ÇAĞIRILDI! ${tableName ? `(${tableName})` : ''}`);
      }
    }

    prevOrdersLen.current = orders.length;
    prevAlertsLen.current = alerts.length;
  }, [orders.length, alerts.length]);

  const pendingOrders = orders.filter(o => o.status === ORDER_STATUS.PENDING);
  const acceptedOrders = orders.filter(o => o.status === ORDER_STATUS.ACCEPTED);
  const preparingOrders = orders.filter(o => [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING].includes(o.status));
  const readyOrders = orders.filter(o => o.status === ORDER_STATUS.READY);
  const servedOrders = orders.filter(o => o.status === ORDER_STATUS.SERVED);
  const finishedOrders = orders.filter(o => [ORDER_STATUS.READY, ORDER_STATUS.SERVED].includes(o.status));

  const activeAlerts = alerts.filter(a => a.status === 'active');

  const handleStatusChange = (id) => {
    const order = orders.find((currentOrder) => currentOrder.id === id);
    const nextStatus = {
      [ORDER_STATUS.PENDING]: ORDER_STATUS.ACCEPTED,
      [ORDER_STATUS.ACCEPTED]: ORDER_STATUS.PREPARING,
      [ORDER_STATUS.PREPARING]: ORDER_STATUS.READY,
      [ORDER_STATUS.READY]: ORDER_STATUS.SERVED,
      [ORDER_STATUS.SERVED]: ORDER_STATUS.CANCELLED,
    }[order?.status];

    if (nextStatus) updateOrderStatus(id, nextStatus);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 sm:p-8 font-sans">
      
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-6 right-6 z-[100] bg-rose-600 text-white px-6 py-4 rounded-2xl font-bold shadow-[0_10px_40px_rgba(225,29,72,0.4)] flex items-center gap-4 animate-bounce">
          <Bell className="w-6 h-6 animate-pulse" />
          <span className="text-lg tracking-wide">{notification}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif-title font-bold text-white flex items-center gap-3">
              <UserSquare2 className="w-8 h-8 text-blue-500" />
              Ofisiant / Mətbəx Paneli
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {settings.restaurantName || "MenuFlow"} — Canlı sifarişlər və çağırışların idarə edilməsi
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Link 
              href="/"
              className="px-4 py-2.5 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-xs font-bold transition-all flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              <span>Müştəri Menyusu</span>
            </Link>

            <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button 
                onClick={() => setActiveTab('orders')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
              >
                Sifarişlər ({pendingOrders.length})
              </button>
              <button 
                onClick={() => setActiveTab('alerts')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'alerts' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
              >
                Çağırışlar 
                {activeAlerts.length > 0 && (
                  <span className="bg-white text-amber-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">
                    {activeAlerts.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'orders' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* Pending */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Gözləyən ({pendingOrders.length})
                </h3>
              </div>
              <div className="space-y-4">
                {pendingOrders.map(order => (
                  <OrderCard key={order.id} order={order} tableName={getTableName(order.table)} onStatusChange={handleStatusChange} nextStatus={ORDER_STATUS.ACCEPTED} nextLabel="Qəbul et" nextColor="bg-blue-600 hover:bg-blue-500" />
                ))}
                {pendingOrders.length === 0 && (
                  <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-500">
                    Yeni sifariş yoxdur
                  </div>
                )}
              </div>
            </div>

            {/* Preparing */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-blue-400" />
                  Hazırlanır ({preparingOrders.length})
                </h3>
              </div>
              <div className="space-y-4">
                {preparingOrders.map(order => (
                  <OrderCard key={order.id} order={order} tableName={getTableName(order.table)} onStatusChange={handleStatusChange} nextStatus={ORDER_STATUS.READY} nextLabel="Hazırdır" nextColor="bg-emerald-600 hover:bg-emerald-500" />
                ))}
              </div>
            </div>

            {/* Completed */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Hazır / Xidmət edildi ({finishedOrders.length})
                </h3>
              </div>
              <div className="space-y-4">
                {finishedOrders.slice(0, 10).map(order => (
                  <OrderCard key={order.id} order={order} tableName={getTableName(order.table)} onStatusChange={handleStatusChange} isCompleted={order.status === ORDER_STATUS.SERVED} nextLabel="Xidmət edildi" nextColor="bg-emerald-600 hover:bg-emerald-500" />
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeAlerts.map(alert => {
              const isBill = alert.type === 'bill';
              const isCash = alert.paymentMethod === 'cash';
              const isCard = alert.paymentMethod === 'card';
              const paymentLabel = alert.paymentMethodLabel || (isCash ? '💵 Cash' : isCard ? '💳 POS Terminal' : '💳 Card');

              return (
                <div key={alert.id} className="bg-slate-900 border-2 border-amber-500/30 rounded-2xl p-5 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500">
                        <Bell className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-white">{getTableName(alert.table)}</h4>
                        <p className="text-amber-400 text-sm font-semibold">{alert.type === 'waiter' ? 'Ofisiant Çağırışı' : 'Hesab İstəyi'}</p>
                      </div>
                    </div>
                  </div>

                  {isBill && (
                    <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 mb-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Ödəniş Növü</div>
                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${isCash ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300'}`}>
                        <span>{isCash ? '💵' : '💳'}</span>
                        <span>{paymentLabel}</span>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-slate-400 mb-4">
                    Zaman: {new Date(alert.time).toLocaleTimeString()}
                  </div>
                  <button 
                    onClick={() => resolveAlert(alert.id)}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Həll Edildi
                  </button>
                </div>
              );
            })}
            {activeAlerts.length === 0 && (
              <div className="col-span-full p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white">Gözləyən çağırış yoxdur</h3>
                <p className="text-slate-400 mt-2">Bütün masalara xidmət edilib.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
