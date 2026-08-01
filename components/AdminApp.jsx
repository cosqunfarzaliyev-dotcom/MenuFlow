"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ORDER_STATUS, useAppStore } from '@/lib/store';
import { Settings, Plus, Edit2, Trash2, Shield, QrCode, Lock, BarChart3, Users, Download, Printer, TrendingUp, Clock, Activity, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { SettingsTab } from '@/components/SettingsTab';

// TODO: Set NEXT_PUBLIC_ADMIN_PASSWORD in .env.local before deploying.
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

export function AdminApp() {
  const { 
    products, categories, createProduct, updateProduct, deleteProduct, createCategory, updateCategory, deleteCategory, 
    tables, loadTables, loadMenuData, loadOrders, loadAlerts, updateTableName, isAdminAuthenticated, setIsAdminAuthenticated, orders,
    settings: rawSettings, updateSettings 
  } = useAppStore();

  const settings = rawSettings || {
    restaurantName: 'MenuFlow',
    restaurantLogo: '',
    currencySymbol: '₼',
    tableCount: 50,
    tagline: 'Rəqəmsal QR Menyu və İdarəetmə Sistemi'
  };
  
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('products');
  const [editingTableId, setEditingTableId] = useState(null);
  const [editingTableName, setEditingTableName] = useState('');
  const [origin, setOrigin] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: '' });

  const handleOpenCategoryModal = (category = null) => {
    if (category) {
      setEditingCategoryId(category.id);
      setCategoryForm({ name: category.name, icon: category.icon });
    } else {
      setEditingCategoryId(null);
      setCategoryForm({ name: '', icon: '' });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim() || !categoryForm.icon.trim()) return;

    if (editingCategoryId) {
      await updateCategory({ id: editingCategoryId, ...categoryForm });
    } else {
      await createCategory({ ...categoryForm });
    }
    setIsCategoryModalOpen(false);
  };

  const handleDeleteCategory = (id) => {
    const hasProducts = products.some(p => p.category === id);
    if (hasProducts) {
      setConfirmState({
        isOpen: true,
        title: 'Diqqət',
        message: 'Bu kateqoriyada məhsullar var. Əvvəlcə məhsulları silin və ya başqa kateqoriyaya keçirin.',
        onConfirm: null,
        isAlert: true
      });
      return;
    }
    setConfirmState({
      isOpen: true,
      title: 'Kateqoriyanı Sil',
      message: 'Bu kateqoriyanı silmək istədiyinizə əminsiniz?',
      onConfirm: () => {
        deleteCategory(id);
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      },
      isAlert: false
    });
  };

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', category: '', price: '', description: '', image: '', isPopular: false, isChefChoice: false, isSpicy: false, isVegetarian: false });

  // Confirmation Modal State
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    isAlert: false
  });

  const handleOpenProductModal = (product = null) => {
    if (product) {
      setEditingProductId(product.id);
      setProductForm({ 
        name: product.name, 
        category: product.category, 
        price: product.price, 
        description: product.description, 
        image: product.image || '',
        isPopular: !!product.isPopular,
        isChefChoice: !!product.isChefChoice,
        isSpicy: !!product.isSpicy,
        isVegetarian: !!product.isVegetarian
      });
    } else {
      setEditingProductId(null);
      setProductForm({ name: '', category: categories[0]?.id || '', price: '', description: '', image: '', isPopular: false, isChefChoice: false, isSpicy: false, isVegetarian: false });
    }
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.price) return;
    
    const parsedPrice = parseFloat(productForm.price);

    if (editingProductId) {
      await updateProduct({ id: editingProductId, ...productForm, price: parsedPrice });
    } else {
      await createProduct({ currency: "₼", ...productForm, price: parsedPrice });
    }
    setIsProductModalOpen(false);
  };

  const handleDeleteProduct = (id) => {
    setConfirmState({
      isOpen: true,
      title: 'Məhsulu Sil',
      message: 'Bu məhsulu silmək istədiyinizə əminsiniz?',
      onConfirm: () => {
        deleteProduct(id);
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      },
      isAlert: false
    });
  };

  const handleDownloadQR = async (table) => {
    const container = document.querySelector(`#qr-${table.id}`);
    if (!container) return;

    // Prefer an existing canvas if present
    const existingCanvas = container.querySelector('canvas');
    const fileName = `table-${table.id}.png`;

    if (existingCanvas) {
      try {
        const dataUrl = existingCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      } catch (e) {
        console.error('Canvas export error:', e);
        return;
      }
    }

    const qrSvg = container.querySelector('svg');
    if (!qrSvg) {
      console.error('No SVG or canvas found for QR export');
      return;
    }

    try {
      // Serialize SVG
      let svgMarkup = new XMLSerializer().serializeToString(qrSvg);
      if (!/xmlns/.test(svgMarkup)) {
        svgMarkup = svgMarkup.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const svgData = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgMarkup;

      // Render SVG into an Image, then paint into a 1024x1024 canvas with white background and 30px quiet zone
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvasSize = 1024; // minimum size
          const margin = 30; // quiet zone in pixels
          const drawSize = canvasSize - margin * 2;

          const canvas = document.createElement('canvas');
          canvas.width = canvasSize;
          canvas.height = canvasSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas not available');

          // White background (no transparency)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw the SVG image centered within the quiet zone
          ctx.drawImage(img, margin, margin, drawSize, drawSize);

          // Use toDataURL as requested and trigger download
          const dataUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (err) {
          console.error('Canvas export error:', err);
        }
      };

      img.onerror = (e) => {
        console.error('SVG to Image load error', e);
      };

      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    } catch (err) {
      console.error('QR export error:', err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    // load supabase-backed data for admin views
    const load = async () => {
      try {
        await Promise.all([loadMenuData(), loadTables(), loadOrders(), loadAlerts()]);
      } catch (err) {
        // ignore load errors in admin
        console.error('Admin data load error:', err);
      }
    };
    load();
  }, [loadMenuData, loadTables, loadOrders, loadAlerts]);

  if (!isMounted) return null;

  const handleLogin = (e) => {
    e.preventDefault();
    if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
      setIsAdminAuthenticated(true);
      setError('');
    } else {
      setError('Şifrə yanlışdır.');
    }
  };

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm glass-panel p-8 rounded-3xl border border-slate-800 text-center">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto flex items-center justify-center border border-slate-800 mb-6">
            <Lock className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-2xl font-serif-title font-bold text-white mb-2">Admin Girişi</h2>
          <p className="text-slate-400 text-sm mb-6">İdarəetmə panelinə daxil olmaq üçün şifrəni daxil edin.</p>
          
          <input 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin şifrəsi"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {error && <p className="text-rose-500 text-xs mb-4 text-left font-bold">{error}</p>}
          
          <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors">
            Daxil ol
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 h-[90vh]">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 glass-panel border border-slate-800 rounded-3xl p-4 flex flex-col">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white leading-tight">{settings.restaurantName || "MenuFlow"}</h2>
              <span className="text-xs text-slate-500 font-bold">Admin Paneli</span>
            </div>
          </div>
          
          <div className="space-y-2 flex-1">
            <SidebarBtn icon={<BarChart3 />} label="Analitika" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
            <SidebarBtn icon={<UtensilsCrossed />} label="Məhsullar" active={activeTab === 'products'} onClick={() => setActiveTab('products')} />
            <SidebarBtn icon={<Grid />} label="Kateqoriyalar" active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} />
            <SidebarBtn icon={<QrCode />} label="QR Kodlar" active={activeTab === 'qrcodes'} onClick={() => setActiveTab('qrcodes')} />
            <SidebarBtn icon={<Settings />} label="Tənzimləmələr" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <Link href="/" className="w-full flex items-center justify-center gap-2 py-2.5 text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 rounded-xl font-bold transition-all text-xs">
              <QrCode className="w-4 h-4" />
              <span>Müştəri Menyusuna Keç</span>
            </Link>
            <button onClick={() => setIsAdminAuthenticated(false)} className="w-full py-2.5 text-slate-500 hover:text-white bg-slate-900 rounded-xl font-bold transition-colors text-xs">
              Çıxış et
            </button>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 glass-panel border border-slate-800 rounded-3xl overflow-hidden flex flex-col">
          
          <div className="p-6 border-b border-slate-800/60 bg-slate-900/40 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white capitalize">{
              activeTab === 'analytics' ? 'Satış və Sifariş Analitikası' :
              activeTab === 'products' ? 'Menyu İdarəetməsi' :
              activeTab === 'categories' ? 'Kateqoriya İdarəetməsi' :
              activeTab === 'qrcodes' ? 'QR Kod Generatoru' :
              'Restoran Tənzimləmələri (Branding)'
            }</h3>
            {(activeTab === 'products' || activeTab === 'categories') && (
              <button 
                onClick={() => activeTab === 'categories' ? handleOpenCategoryModal() : handleOpenProductModal()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                {activeTab === 'products' ? 'Yeni Məhsul' : 'Yeni Kateqoriya'}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            
            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <SettingsTab settings={settings} updateSettings={updateSettings} />
            )}
            
            {/* Analytics Demo */}
            {activeTab === 'analytics' && (
              <AnalyticsDashboard orders={orders} tables={tables} />
            )}

            {/* Products CRUD Demo */}
            {activeTab === 'products' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {products.map(product => (
                  <div key={product.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                      <Image
                        src={product.image?.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        width={160}
                        height={160}
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-bold text-sm truncate">{product.name}</h4>
                      <p className="text-blue-400 font-bold text-sm">{product.price} {settings.currencySymbol || '₼'}</p>
                      <div className="flex gap-2 mt-1">
                        {product.isPopular && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">Populyar</span>}
                        {product.isChefChoice && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold">Şefin Seçimi</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleOpenProductModal(product)}
                        className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Categories Demo */}
            {activeTab === 'categories' && (
              <div className="space-y-3">
                {categories.map(category => (
                  <div key={category.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl bg-slate-800 p-3 rounded-xl">{category.icon}</span>
                      <span className="text-white font-bold text-lg">{category.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleOpenCategoryModal(category)}
                        className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCategory(category.id)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* QR Codes Demo */}
            {activeTab === 'qrcodes' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between print:hidden">
                  <p className="text-slate-400 text-sm">Masalar üçün QR kodları buradan redaktə edib, çap edə bilərsiniz.</p>
                  <button 
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Hamısını PDF Kimi Çap Et
                  </button>
                </div>
                
                <style dangerouslySetInnerHTML={{__html: `
                  @media print {
                    body * { visibility: hidden; }
                    #print-qr-area, #print-qr-area * { visibility: visible; }
                    #print-qr-area { position: absolute; left: 0; top: 0; width: 100%; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
                    .print\\:hidden { display: none !important; }
                  }
                `}} />

                <div id="print-qr-area" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {tables.map(table => {
                    const tableUrl = `${origin}/menu/${encodeURIComponent(table.id)}`;
                    return (
                      <div key={table.id} id={`qr-card-${table.id}`} className="qr-code-card bg-white flex flex-col items-center justify-center gap-3 relative group p-4 border border-slate-200 rounded-2xl">
                        
                        <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider">
                          {settings.restaurantLogo ? (
                            <Image
                              src={settings.restaurantLogo}
                              alt="Logo"
                              className="w-4 h-4 object-contain rounded"
                              width={16}
                              height={16}
                              unoptimized
                            />
                          ) : (
                            <QrCode className="w-4 h-4 text-blue-600" />
                          )}
                          <span>{settings.restaurantName || "MenuFlow"}</span>
                        </div>

                        <div id={`qr-${table.id}`} className="bg-white p-2 border-2 border-slate-100 rounded-xl">
                          <QRCodeSVG 
                            value={tableUrl}
                            size={120}
                            bgColor={"#ffffff"}
                            fgColor={"#0f172a"}
                            level={"Q"}
                          />
                        </div>
                        
                        {editingTableId === table.id ? (
                          <div className="flex flex-col gap-2 w-full print:hidden">
                            <input 
                              type="text" 
                              value={editingTableName}
                              onChange={(e) => setEditingTableName(e.target.value)}
                              className="w-full bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-slate-900 text-center font-bold text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  updateTableName(table.id, editingTableName);
                                  setEditingTableId(null);
                                }}
                                className="flex-1 bg-blue-600 text-white text-xs font-bold py-1.5 rounded-lg"
                              >Yadda saxla</button>
                              <button 
                                onClick={() => setEditingTableId(null)}
                                className="flex-1 bg-slate-300 text-slate-700 text-xs font-bold py-1.5 rounded-lg"
                              >Ləğv et</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 w-full">
                            <span className="font-bold text-slate-900 font-serif-title text-lg text-center break-words w-full">{table.name}</span>
                            
                            <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                              <button 
                                onClick={() => {
                                  setEditingTableId(table.id);
                                  setEditingTableName(table.name);
                                }}
                                className="p-2 bg-slate-100 text-slate-600 hover:text-blue-600 rounded-lg transition-colors"
                                title="Adı Dəyiş"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              
                              <button 
                                onClick={() => handleDownloadQR(table)}
                                className="p-2 bg-slate-100 text-slate-600 hover:text-emerald-600 rounded-lg transition-colors"
                                title="PNG Yüklə"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <CategoryModal 
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        categoryForm={categoryForm}
        setCategoryForm={setCategoryForm}
        isEditing={!!editingCategoryId}
      />

      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        productForm={productForm}
        setProductForm={setProductForm}
        isEditing={!!editingProductId}
        categories={categories}
      />

      <ConfirmModal 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        isAlert={confirmState.isAlert}
      />
    </div>
  );
}

function ProductModal({ isOpen, onClose, onSave, productForm, setProductForm, isEditing, categories }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto no-scrollbar">
        <h2 className="text-2xl font-serif-title font-bold text-white mb-6">
          {isEditing ? 'Məhsulu Redaktə Et' : 'Yeni Məhsul'}
        </h2>
        
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Məhsul Adı</label>
            <input 
              type="text" 
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              placeholder="Məsələn: Pepperoni Pizza"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-1">Kateqoriya</label>
              <select 
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-1">Qiymət (₼)</label>
              <input 
                type="number" 
                step="0.01"
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                placeholder="Məsələn: 12.50"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Şəkil URL (İstəyə bağlı)</label>
            <input 
              type="text" 
              value={productForm.image}
              onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
              placeholder="https://... şəkil linki"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Təsvir</label>
            <textarea 
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              placeholder="Məhsul haqqında məlumat..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>
          
          {/* Tags / Badges */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={productForm.isPopular || false} 
                onChange={(e) => setProductForm({ ...productForm, isPopular: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-950 accent-amber-500"
              />
              <span className="text-sm font-bold text-slate-300">⭐ Populyar</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={productForm.isChefChoice || false} 
                onChange={(e) => setProductForm({ ...productForm, isChefChoice: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-950 accent-blue-500"
              />
              <span className="text-sm font-bold text-slate-300">👨‍🍳 Şefin Seçimi</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={productForm.isSpicy || false} 
                onChange={(e) => setProductForm({ ...productForm, isSpicy: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500 focus:ring-offset-slate-950 accent-rose-500"
              />
              <span className="text-sm font-bold text-slate-300">🌶️ Acılı</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={productForm.isVegetarian || false} 
                onChange={(e) => setProductForm({ ...productForm, isVegetarian: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-950 accent-emerald-500"
              />
              <span className="text-sm font-bold text-slate-300">🥗 Veqetarian</span>
            </label>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
            >
              Ləğv et
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors"
            >
              Yadda saxla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryModal({ isOpen, onClose, onSave, categoryForm, setCategoryForm, isEditing }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-2xl font-serif-title font-bold text-white mb-6">
          {isEditing ? 'Kateqoriyanı Redaktə Et' : 'Yeni Kateqoriya'}
        </h2>
        
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Kateqoriya Adı</label>
            <input 
              type="text" 
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              placeholder="Məsələn: İsti İçkilər"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">İkon (Emoji)</label>
            <input 
              type="text" 
              value={categoryForm.icon}
              onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
              placeholder="Məsələn: ☕"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
            >
              Ləğv et
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors"
            >
              Yadda saxla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, isAlert }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-xl text-center">
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400 mb-6 text-sm">{message}</p>
        
        <div className="flex gap-3">
          {!isAlert && (
            <button 
              onClick={onCancel}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
            >
              Ləğv et
            </button>
          )}
          <button 
            onClick={isAlert ? onCancel : onConfirm}
            className={`flex-1 py-3 text-white rounded-xl font-bold transition-colors ${
              isAlert ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {isAlert ? 'Tamam' : 'Bəli, Sil'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SidebarBtn({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${
        active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
      }`}
    >
      <span className={active ? 'text-white' : 'text-slate-500'}>{React.cloneElement(icon, { className: 'w-5 h-5' })}</span>
      {label}
    </button>
  );
}

function StatCard({ label, value, change }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <h4 className="text-2xl font-bold text-white">{value}</h4>
        <span className="text-emerald-400 text-xs font-bold">{change}</span>
      </div>
    </div>
  );
}

function Grid({ className }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
}
function UtensilsCrossed({ className }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"></path><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"></path><path d="m2.1 21.8 6.4-6.3"></path><path d="m19 5-7 7"></path></svg>
}

// Analytics Dashboard Component
function AnalyticsDashboard({ orders, tables }) {
  const [timeFilter, setTimeFilter] = useState('day'); // 'day', 'week', 'month'

  const stats = useMemo(() => {
    const now = new Date();
    
    let filteredOrders = [];
    if (timeFilter === 'day') {
      filteredOrders = orders.filter(o => new Date(o.time).toDateString() === now.toDateString());
    } else if (timeFilter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter(o => new Date(o.time) >= oneWeekAgo);
    } else if (timeFilter === 'month') {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter(o => new Date(o.time) >= oneMonthAgo);
    }
    
    const revenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const count = filteredOrders.length;
    const aov = count > 0 ? (revenue / count) : 0;
    
    const activeTables = new Set(
      orders.filter(o => o.status !== ORDER_STATUS.SERVED && o.status !== ORDER_STATUS.CANCELLED).map(o => o.table)
    ).size;

    // Top dishes
    const dishCounts = {};
    filteredOrders.forEach(o => {
      o.items.forEach(item => {
        const id = item.product.id;
        if (!dishCounts[id]) {
          dishCounts[id] = { name: item.product.name, count: 0, revenue: 0 };
        }
        dishCounts[id].count += item.quantity;
        dishCounts[id].revenue += (item.quantity * item.product.price);
      });
    });
    
    const topDishes = Object.values(dishCounts).sort((a, b) => b.count - a.count).slice(0, 5);
    const totalItemsSold = Object.values(dishCounts).reduce((sum, d) => sum + d.count, 0);

    // Table revenue
    const tableRevenue = {};
    filteredOrders.forEach(o => {
      const tId = o.table;
      if (!tableRevenue[tId]) {
        tableRevenue[tId] = 0;
      }
      tableRevenue[tId] += (o.total || 0);
    });

    const topTables = Object.entries(tableRevenue)
      .map(([id, rev]) => {
        const t = tables.find(tb => tb.id === id);
        return { name: t ? t.name : `Masa ${id}`, value: rev };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Chart Data
    let chartData = [];
    if (timeFilter === 'day') {
      const hourlyData = {};
      for (let i = 8; i <= 23; i++) {
        hourlyData[i] = { label: `${i}:00`, sales: 0, orders: 0 };
      }
      filteredOrders.forEach(o => {
        const hour = new Date(o.time).getHours();
        if (hourlyData[hour]) {
          hourlyData[hour].sales += (o.total || 0);
          hourlyData[hour].orders += 1;
        }
      });
      chartData = Object.values(hourlyData);
    } else if (timeFilter === 'week') {
      const daysOfWeek = ['Bazar', 'B.E', 'Ç.A', 'Ç', 'C.A', 'C', 'Ş'];
      const weekData = {};
      for(let i = 0; i < 7; i++) {
        weekData[i] = { label: daysOfWeek[i], sales: 0, orders: 0 };
      }
      filteredOrders.forEach(o => {
        const day = new Date(o.time).getDay();
        weekData[day].sales += (o.total || 0);
        weekData[day].orders += 1;
      });
      chartData = [1,2,3,4,5,6,0].map(d => weekData[d]);
    } else if (timeFilter === 'month') {
      const monthData = {};
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for(let i = 1; i <= daysInMonth; i++) {
        monthData[i] = { label: `${i}`, sales: 0, orders: 0 };
      }
      filteredOrders.forEach(o => {
        const day = new Date(o.time).getDate();
        if(monthData[day]) {
          monthData[day].sales += (o.total || 0);
          monthData[day].orders += 1;
        }
      });
      chartData = Object.values(monthData);
    }

    return { revenue, count, aov, activeTables, topDishes, totalItemsSold, topTables, chartData };
  }, [orders, tables, timeFilter]);

  const recentOrders = useMemo(() => {
    return [...orders].reverse().slice(0, 5).map(o => {
      const table = tables.find(t => t.id === o.table);
      return { ...o, tableName: table ? table.name : `Masa ${o.table}` };
    });
  }, [orders, tables]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-1 bg-slate-900/50 border border-slate-800 rounded-xl w-fit">
        <button 
          onClick={() => setTimeFilter('day')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === 'day' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Bugün
        </button>
        <button 
          onClick={() => setTimeFilter('week')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === 'week' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Bu Həftə
        </button>
        <button 
          onClick={() => setTimeFilter('month')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === 'month' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Bu Ay
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={timeFilter === 'day' ? "Günlük Gəlir" : timeFilter === 'week' ? "Həftəlik Gəlir" : "Aylıq Gəlir"} value={`${stats.revenue.toFixed(2)} ₼`} icon={<TrendingUp className="text-emerald-400" />} />
        <StatCard label={timeFilter === 'day' ? "Bugünkü Sifariş" : timeFilter === 'week' ? "Həftəlik Sifariş" : "Aylıq Sifariş"} value={stats.count} icon={<Activity className="text-blue-400" />} />
        <StatCard label="Orta Hesab (AOV)" value={`${stats.aov.toFixed(2)} ₼`} icon={<BarChart3 className="text-purple-400" />} />
        <StatCard label="Aktiv Masalar" value={stats.activeTables} icon={<Users className="text-amber-400" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
          <h4 className="text-white font-bold mb-6 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-400"/> {timeFilter === 'day' ? 'Saatlıq' : timeFilter === 'week' ? 'Həftəlik' : 'Aylıq'} Sifariş Dinamikası</h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₼${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }}
                  itemStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                />
                <Bar dataKey="sales" name="Satış (₼)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
          <h4 className="text-white font-bold mb-6 flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-amber-400"/> Gəlir Paylanması (Masalar)</h4>
          <div className="h-56">
            {stats.topTables.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.topTables}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.topTables.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => `${value.toFixed(2)} ₼`}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">Məlumat yoxdur</div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {stats.topTables.map((t, i) => (
              <div key={i} className="flex justify-between items-center text-xs font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-slate-300">{t.name}</span>
                </div>
                <span className="text-white">{t.value.toFixed(2)} ₼</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
          <h4 className="text-white font-bold mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400"/> Ən Çox Satılanlar (Top 5)</h4>
          <div className="space-y-4">
            {stats.topDishes.length > 0 ? stats.topDishes.map((dish, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-200">{i + 1}. {dish.name}</span>
                  <span className="text-emerald-400">{dish.count} ədəd</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full" 
                    style={{ width: `${Math.max(5, (dish.count / (stats.totalItemsSold || 1)) * 100)}%` }} 
                  />
                </div>
              </div>
            )) : (
               <div className="text-slate-500 text-sm text-center py-8">Sifariş yoxdur</div>
            )}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex flex-col">
          <h4 className="text-white font-bold mb-6 flex items-center gap-2"><Clock className="w-5 h-5 text-purple-400"/> Son Sifarişlər (Live Feed)</h4>
          <div className="space-y-3 flex-1 overflow-y-auto pr-2 no-scrollbar">
            {recentOrders.length > 0 ? recentOrders.map(order => (
              <div key={order.id} className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold text-sm">{order.tableName}</span>
                    <span className="text-slate-500 text-[10px]">{new Date(order.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <span className="text-slate-400 text-xs font-semibold">{order.items.length} məhsul</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-blue-400 font-bold text-sm">{order.total ? order.total.toFixed(2) : "0.00"} ₼</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    order.status === ORDER_STATUS.SERVED || order.status === ORDER_STATUS.READY ? 'bg-emerald-500/20 text-emerald-400' :
                    order.status === ORDER_STATUS.PREPARING || order.status === ORDER_STATUS.ACCEPTED ? 'bg-blue-500/20 text-blue-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {order.status === ORDER_STATUS.SERVED ? 'Xidmət edildi' :
                      order.status === ORDER_STATUS.READY ? 'Hazırdır' :
                      order.status === ORDER_STATUS.PREPARING ? 'Hazırlanır' :
                      order.status === ORDER_STATUS.ACCEPTED ? 'Qəbul edildi' :
                      order.status === ORDER_STATUS.CANCELLED ? 'Ləğv edildi' : 'Gözləyir'}
                  </span>
                </div>
              </div>
            )) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">Aktiv sifariş yoxdur</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PieChartIcon({ className }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
}
