"use client";

import React from "react";
import Image from 'next/image';
import { Star, Heart, Clock, Plus, Flame, Leaf, Sparkles } from "lucide-react";
import { getLocalizedProduct, getLocalizedText } from "@/lib/translations";
import { useAppStore } from "@/lib/store";

export const ProductCard = ({
  product: originalProduct,
  onOpenDetail,
  onAddToCart,
  isFavorite,
  onToggleFavorite,
  lang = "az",
}) => {
  const currencySymbol = useAppStore(state => state.settings?.currencySymbol) || '₼';
  const product = getLocalizedProduct(originalProduct, lang);

  return (
    <div className="group glass-panel-interactive rounded-2xl overflow-hidden flex flex-col justify-between border border-slate-800/50 shadow-sm hover:shadow-md hover:border-slate-700/80 transition-all duration-300">
      
      {/* Top Image Section */}
      <div 
        className="relative h-40 sm:h-52 w-full overflow-hidden cursor-pointer"
        onClick={() => onOpenDetail(originalProduct)}
      >
        <Image
          src={product.image?.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"}
          alt={product.name}
          className="object-cover transform group-hover:scale-110 transition-transform duration-500 ease-out"
          fill
          sizes="(max-width: 640px) 100vw, 25vw"
          unoptimized
        />
        
        {/* Dark subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-12 flex flex-wrap gap-1 z-10 max-h-16 overflow-hidden">
          {product.isPopular && (
            <span className="bg-amber-500/90 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 rounded-full backdrop-blur-md shadow-md flex items-center gap-1 shrink-0 whitespace-nowrap">
              <Star className="w-2.5 h-2.5 fill-slate-950" />
              {getLocalizedText("popular", lang)}
            </span>
          )}

          {product.isChefChoice && (
            <span className="bg-blue-600/90 text-white font-bold text-[9px] uppercase px-2 py-0.5 rounded-full backdrop-blur-md shadow-md flex items-center gap-1 shrink-0 whitespace-nowrap">
              <Sparkles className="w-2.5 h-2.5 text-amber-300" />
              {getLocalizedText("chefChoice", lang)}
            </span>
          )}

          {product.isSpicy && (
            <span className="bg-rose-600/90 text-white font-bold text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 whitespace-nowrap">
              <Flame className="w-2.5 h-2.5 fill-white" />
              {getLocalizedText("spicy", lang)}
            </span>
          )}

          {product.isVegetarian && (
            <span className="bg-emerald-600/90 text-white font-bold text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 whitespace-nowrap">
              <Leaf className="w-2.5 h-2.5 fill-white" />
              {getLocalizedText("vegetarian", lang)}
            </span>
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all z-10 ${
            isFavorite
              ? "bg-rose-600 text-white shadow-lg"
              : "bg-slate-950/60 text-slate-300 hover:text-rose-400 hover:bg-slate-900"
          }`}
          title={getLocalizedText("details", lang)}
          id={`fav-btn-${product.id}`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? "fill-white" : ""}`} />
        </button>

        {/* Prep Time floating badge */}
        {product.prepTime && (
          <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md text-slate-300 text-[10px] px-2.5 py-1 rounded-full border border-slate-800 flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-400" />
            <span>{product.prepTime}</span>
          </div>
        )}
      </div>

      {/* Product Information Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div className="cursor-pointer" onClick={() => onOpenDetail(originalProduct)}>
          <h3 className="font-serif-title text-base sm:text-lg font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1 mb-1.5">
            {product.name}
          </h3>
          <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">
            {product.description}
          </p>
        </div>

        {/* Footer Price & Add Button */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2">
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block font-medium">{getLocalizedText("price", lang)}</span>
            <span className="text-base sm:text-lg font-extrabold text-blue-400 tracking-tight whitespace-nowrap">
              {product.price.toFixed(2)} {currencySymbol}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onOpenDetail(originalProduct)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              {getLocalizedText("details", lang)}
            </button>
            <button
              onClick={() => onAddToCart(originalProduct)}
              className="p-2 sm:p-2.5 rounded-xl glass-button-blue text-white hover:scale-105 active:scale-95 transition-all shadow-md shadow-blue-600/30 shrink-0"
              title={getLocalizedText("addToCart", lang)}
              id={`add-btn-${product.id}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
