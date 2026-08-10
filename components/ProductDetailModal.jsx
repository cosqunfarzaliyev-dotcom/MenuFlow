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

const GRADIENT = 'linear-gradient(180deg, #7B61FF 0%, #5B3DF5 100%)';

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

  const calculateTotal = () => {
    let base = product.price || 0;
    Object.values(selectedOptions).forEach((opt) => {
      base += Number(opt?.extraPrice || 0);
    });
    return (base * quantity).toFixed(2);
  };

  const handleOptionSelect = (optionTitle, choice) => {
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
    <div className="customer-theme fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm">

      {/* Background click listener */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-[#ECECEC] rounded-3xl z-10 no-scrollbar" style={{ boxShadow: '0 24px 70px rgba(0,0,0,.18)' }}>

        {/* Close & Favorite top buttons */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-4 bg-white/90 backdrop-blur-md border-b border-[#E8E8E8]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#8A8F98] uppercase tracking-wider">
              {getLocalizedText("aboutProduct", lang)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleFavorite(product.id)}
              className={`p-2 rounded-full border transition-colors ${
                isFavorite
                  ? "bg-rose-500 text-white border-rose-500"
                  : "bg-white text-[#8A8F98] border-[#E8E8E8] hover:text-rose-500"
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? "fill-white" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white text-[#8A8F98] hover:text-[#14151A] border border-[#E8E8E8] transition-colors"
              id="modal-close-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hero Image */}
        <div className="relative h-56 sm:h-72 w-full overflow-hidden">
          <Image
            src={product.image?.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"}
            alt={product.name}
            className="object-cover"
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            unoptimized
          />

          {/* Badges on image */}
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-2">
            {product.isPopular && (
              <span className="bg-[#FFB020] text-[#14151A] font-black text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                <Star className="w-3.5 h-3.5 fill-[#14151A]" />
                {getLocalizedText("popular", lang)}
              </span>
            )}
            {product.isChefChoice && (
              <span className="bg-[var(--theme-primary)] text-white font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                {getLocalizedText("chefChoice", lang)}
              </span>
            )}
            {product.isSpicy && (
              <span className="bg-rose-500 text-white font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                <Flame className="w-3.5 h-3.5 fill-white" />
                {getLocalizedText("spicy", lang)}
              </span>
            )}
            {product.isVegetarian && (
              <span className="bg-[#34C759] text-white font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                <Leaf className="w-3.5 h-3.5 fill-white" />
                {getLocalizedText("vegetarian", lang)}
              </span>
            )}
            {product.rating != null && (
              <span className="bg-white/90 backdrop-blur-md text-[#14151A] font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                <Star className="w-3.5 h-3.5 fill-[#FFB020] text-[#FFB020]" />
                {Number(product.rating).toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-8 space-y-6">

          {/* Header & Price */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8E8E8] pb-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#14151A]">
                {product.name}
              </h2>
              <p className="text-[#8A8F98] text-xs mt-1">
                {getLocalizedText("category", lang)} <span className="text-[var(--theme-primary)] font-semibold capitalize">{getLocalizedCategoryName({ id: product.category, name: product.category }, lang)}</span>
              </p>
            </div>
            <div className="text-left sm:text-right">
              {product.originalPrice ? (
                <span className="block text-[#B4B8C0] text-xs sm:text-sm line-through">{product.originalPrice.toFixed(2)} {currencySymbol}</span>
              ) : null}
              <span className="text-2xl sm:text-3xl font-extrabold text-[#14151A]">
                {product.price.toFixed(2)} {currencySymbol}
              </span>
            </div>
          </div>

          {/* Prep time & Calories bar */}
          {(product.prepTime || product.calories) && (
            <div className="flex items-center gap-4 bg-[#F7F8FA] p-3.5 rounded-2xl border border-[#E8E8E8] text-xs text-[#5A5F68]">
              {product.prepTime && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--theme-primary)]" />
                  <span>{getLocalizedText("prepTime", lang)} <strong className="text-[#14151A]">{product.prepTime}</strong></span>
                </div>
              )}
              {product.calories && (
                <>
                  <span className="text-[#D9DBE3]">•</span>
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-[#FFB020]" />
                    <span>{getLocalizedText("energy", lang)} <strong className="text-[#14151A]">{product.calories}</strong></span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-[#5A5F68] uppercase tracking-wider mb-2">
              {getLocalizedText("description", lang)}
            </h4>
            <p className="text-[#5A5F68] text-sm leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Ingredients */}
          {product.ingredients && product.ingredients.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[#5A5F68] uppercase tracking-wider mb-2">
                {getLocalizedText("ingredients", lang)}
              </h4>
              <div className="flex flex-wrap gap-2">
                {product.ingredients.map((ing, idx) => (
                  <span
                    key={idx}
                    className="bg-[#F7F8FA] border border-[#E8E8E8] text-[#5A5F68] text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary)]" />
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custom Options if any */}
          {product.options && product.options.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-[#E8E8E8]">
              {product.options.map((optGroup) => (
                <div key={optGroup.title}>
                  <h4 className="text-xs font-bold text-[#5A5F68] uppercase tracking-wider mb-2.5">
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
                              ? "bg-[var(--theme-primary)]/8 border-[var(--theme-primary)] text-[#14151A]"
                              : "bg-[#F7F8FA] border-[#E8E8E8] text-[#5A5F68] hover:border-[#D9DBE3]"
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0 truncate">
                            <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white" : "border-[#D9DBE3]"
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </span>
                            <span className="truncate">{choice.name}</span>
                          </span>
                          {choice.extraPrice > 0 ? (
                            <span className="text-[var(--theme-primary)] font-bold shrink-0 whitespace-nowrap">
                              +{choice.extraPrice.toFixed(2)} ₼
                            </span>
                          ) : (
                            <span className="text-[#8A8F98] font-normal shrink-0 whitespace-nowrap">{getLocalizedText("freeOption", lang)}</span>
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
          <div className="pt-2 border-t border-[#E8E8E8]">
            <h4 className="text-xs font-bold text-[#5A5F68] uppercase tracking-wider mb-2">
              {getLocalizedText("kitchenRequestLabel", lang)}
            </h4>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={getLocalizedText("kitchenRequestPlaceholder", lang)}
              className="w-full bg-[#F7F8FA] border border-[#E8E8E8] rounded-xl p-3 text-xs text-[#14151A] placeholder-[#B4B8C0] focus:outline-none focus:border-[var(--theme-primary)] transition-colors h-20 resize-none"
            />
          </div>

          {/* Footer controls: Quantity + Add Button */}
          <div className="sticky bottom-0 bg-white p-4 rounded-2xl border border-[#E8E8E8] flex flex-col sm:flex-row items-center justify-between gap-4" style={{ boxShadow: '0 -8px 24px rgba(0,0,0,.05)' }}>

            {/* Quantity Selector */}
            <div className="flex items-center bg-[#F7F8FA] border border-[#E8E8E8] rounded-xl p-1.5 w-full sm:w-auto justify-between sm:justify-start gap-4">
              <span className="text-xs text-[#8A8F98] pl-2 font-medium">{getLocalizedText("quantity", lang)}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-2 rounded-lg bg-white border border-[#E8E8E8] hover:border-[#D9DBE3] text-[#14151A] transition-colors"
                  id="qty-minus-btn"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-extrabold text-[#14151A] w-6 text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="p-2 rounded-lg bg-white border border-[#E8E8E8] hover:border-[#D9DBE3] text-[#14151A] transition-colors"
                  id="qty-plus-btn"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Add Button with calculated total */}
            <button
              onClick={handleAdd}
              className="customer-btn-primary w-full sm:w-auto flex-1 h-auto py-3.5 px-4 sm:px-6 text-xs sm:text-sm flex items-center justify-between gap-2 min-w-0"
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
