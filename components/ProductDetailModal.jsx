"use client";

import React, { useState } from "react";
import Image from 'next/image';
import { 
  X, 
  Star, 
  Clock, 
  Flame, 
  Leaf, 
  Sparkles, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Check, 
  Utensils, 
  Heart 
} from "lucide-react";
import { getLocalizedProduct, getLocalizedText, getLocalizedCategoryName } from "@/lib/translations";
import { useAppStore } from "@/lib/store";

export const ProductDetailModal = ({
  product: rawProduct,
  onClose,
  onAddToCartWithOptions,
  isFavorite,
  onToggleFavorite,
  lang = "az",
}) => {
  const currencySymbol = useAppStore(state => state.settings?.currencySymbol) || '₼';
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selectedOptions, setSelectedOptions] = useState(() => {
    const initial = {};
    if (rawProduct?.options) {
      rawProduct.options.forEach((opt) => {
        if (opt?.choices?.length > 0) {
          initial[opt.title] = opt.choices[0];
        }
      });
    }
    return initial;
  });

  if (!rawProduct) return null;

  const product = getLocalizedProduct(rawProduct, lang);

  // Calculate total price based on options & quantity
  const calculateTotal = () => {
    let base = product.price || 0;
    Object.values(selectedOptions).forEach((opt) => {
      base += Number(opt?.extraPrice || 0);
    });
    return (base * quantity).toFixed(2);
  };

  const handleOptionSelect = (
    optionTitle,
    choice
  ) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionTitle]: choice,
    }));
  };

  const handleAdd = () => {
    onAddToCartWithOptions(rawProduct, quantity, selectedOptions, note);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      
      {/* Background click listener */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-panel border border-slate-700 rounded-3xl shadow-xl z-10 no-scrollbar bg-slate-950">
        
        {/* Close & Favorite top buttons */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-4 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {getLocalizedText("aboutProduct", lang)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleFavorite(product.id)}
              className={`p-2 rounded-full border transition-colors ${
                isFavorite
                  ? "bg-rose-600 text-white border-rose-500"
                  : "bg-slate-900 text-slate-300 border-slate-800 hover:text-rose-400"
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? "fill-white" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              id="modal-close-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hero Image */}
        <div className="relative h-64 sm:h-80 w-full overflow-hidden">
          <Image
            src={product.image?.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"}
            alt={product.name}
            className="object-cover"
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

          {/* Badges on image */}
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-2">
            {product.isPopular && (
              <span className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                <Star className="w-3.5 h-3.5 fill-slate-950" />
                {getLocalizedText("popular", lang)}
              </span>
            )}
            {product.isChefChoice && (
              <span className="bg-blue-600 text-white font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                {getLocalizedText("chefChoice", lang)}
              </span>
            )}
            {product.isSpicy && (
              <span className="bg-rose-600 text-white font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-white" />
                {getLocalizedText("spicy", lang)}
              </span>
            )}
            {product.isVegetarian && (
              <span className="bg-emerald-600 text-white font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1">
                <Leaf className="w-3.5 h-3.5 fill-white" />
                {getLocalizedText("vegetarian", lang)}
              </span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-8 space-y-6">
          
          {/* Header & Price */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="font-serif-title text-2xl sm:text-3xl font-extrabold text-white">
                {product.name}
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                {getLocalizedText("category", lang)} <span className="text-blue-400 font-semibold capitalize">{getLocalizedCategoryName({ id: product.category, name: product.category }, lang)}</span>
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">
                {product.price.toFixed(2)} {product.currency}
              </span>
            </div>
          </div>

          {/* Prep time & Calories bar */}
          <div className="flex items-center gap-4 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 text-xs text-slate-300">
            {product.prepTime && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>{getLocalizedText("prepTime", lang)} <strong className="text-white">{product.prepTime}</strong></span>
              </div>
            )}
            {product.calories && (
              <>
                <span className="text-slate-700">•</span>
                <div className="flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-amber-400" />
                  <span>{getLocalizedText("energy", lang)} <strong className="text-white">{product.calories}</strong></span>
                </div>
              </>
            )}
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              {getLocalizedText("description", lang)}
            </h4>
            <p className="text-slate-300 text-sm leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Ingredients */}
          {product.ingredients && product.ingredients.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                {getLocalizedText("ingredients", lang)}
              </h4>
              <div className="flex flex-wrap gap-2">
                {product.ingredients.map((ing, idx) => (
                  <span
                    key={idx}
                    className="bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custom Options if any */}
          {product.options && product.options.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-800">
              {product.options.map((optGroup) => (
                <div key={optGroup.title}>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                    {optGroup.title}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {optGroup.choices.map((choice) => {
                      const isSelected =
                        selectedOptionTitle(selectedOptions, optGroup.title) === choice.name;
                      return (
                        <button
                          key={choice.name}
                          type="button"
                          onClick={() => handleOptionSelect(optGroup.title, choice)}
                          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-all min-w-0 ${
                            isSelected
                              ? "bg-blue-600/20 border-blue-500 text-white"
                              : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0 truncate">
                            <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? "border-blue-400 bg-blue-500 text-white" : "border-slate-600"
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </span>
                            <span className="truncate">{choice.name}</span>
                          </span>
                          {choice.extraPrice > 0 ? (
                            <span className="text-blue-400 font-bold shrink-0 whitespace-nowrap">
                              +{choice.extraPrice.toFixed(2)} ₼
                            </span>
                          ) : (
                            <span className="text-slate-500 font-normal shrink-0 whitespace-nowrap">{getLocalizedText("freeOption", lang)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Kitchen Note / Request */}
          <div className="pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              {getLocalizedText("kitchenRequestLabel", lang)}
            </h4>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={getLocalizedText("kitchenRequestPlaceholder", lang)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors h-20 resize-none"
            />
          </div>

          {/* Footer controls: Quantity + Add Button */}
          <div className="sticky bottom-0 bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            
            {/* Quantity Selector */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1.5 w-full sm:w-auto justify-between sm:justify-start gap-4">
              <span className="text-xs text-slate-400 pl-2 font-medium">{getLocalizedText("quantity", lang)}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                  id="qty-minus-btn"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-extrabold text-white w-6 text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                  id="qty-plus-btn"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Add Button with calculated total */}
            <button
              onClick={handleAdd}
              className="w-full sm:w-auto flex-1 py-3.5 px-4 sm:px-6 rounded-xl glass-button-blue text-white font-bold text-xs sm:text-sm flex items-center justify-between gap-2 min-w-0 transition-transform active:scale-95 shadow-xl shadow-blue-600/30"
              id="modal-add-to-cart-btn"
            >
              <span className="flex items-center gap-2 truncate min-w-0">
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span className="truncate">{getLocalizedText("addToCart", lang)}</span>
              </span>
              <span className="bg-white/20 px-2.5 py-1 rounded-lg text-xs font-black shrink-0 whitespace-nowrap">
                {calculateTotal()} {currencySymbol}
              </span>
            </button>

          </div>

        </div>

      </div>
    </div>
  );
};

// Helper function
function selectedOptionTitle(selectedOptions, groupTitle) {
  return selectedOptions[groupTitle]?.name || "";
}
