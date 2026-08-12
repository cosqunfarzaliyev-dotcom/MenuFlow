"use client";

import React from "react";
import Image from 'next/image';
import { Star, Heart, Clock, Plus, Flame, Leaf, Sparkles } from "lucide-react";
import { getLocalizedProduct, getLocalizedText } from "@/lib/translations";
import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui";

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
    <div className="customer-card group flex flex-col overflow-hidden">

      {/* Image — the largest single element in the card, food stays the hero */}
      <div
        className="relative h-36 sm:h-44 w-full overflow-hidden cursor-pointer shrink-0"
        onClick={() => onOpenDetail(originalProduct)}
      >
        <Image
          src={product.image?.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"}
          alt={product.name}
          className="object-cover transform group-hover:scale-105 transition-transform duration-500 ease-out"
          fill
          sizes="(max-width: 640px) 100vw, 25vw"
          unoptimized
        />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-12 flex flex-wrap gap-1 z-10 max-h-16 overflow-hidden">
          {/* Badge tone is a closest-match placeholder — className fully
              overrides colors/size to keep these brand-specific product
              badges pixel-identical (same override technique used
              throughout the Admin/Staff/SuperAdmin migration). */}
          {product.isPopular && (
            <Badge tone="warning" className="bg-[#FFB020] text-[#14151A] font-extrabold text-[9px] uppercase px-2 py-0.5 shadow-sm shrink-0 whitespace-nowrap">
              <Star className="w-2.5 h-2.5 fill-[#14151A]" />
              {getLocalizedText("popular", lang)}
            </Badge>
          )}
          {product.isChefChoice && (
            <Badge tone="brand" className="bg-[var(--theme-primary)] text-white text-[9px] uppercase px-2 py-0.5 shadow-sm shrink-0 whitespace-nowrap">
              <Sparkles className="w-2.5 h-2.5 text-white" />
              {getLocalizedText("chefChoice", lang)}
            </Badge>
          )}
          {product.isSpicy && (
            <Badge tone="danger" className="bg-rose-500 text-white text-[9px] px-2 py-0.5 shadow-sm shrink-0 whitespace-nowrap">
              <Flame className="w-2.5 h-2.5 fill-white" />
              {getLocalizedText("spicy", lang)}
            </Badge>
          )}
          {product.isVegetarian && (
            <Badge tone="success" className="bg-[#34C759] text-white text-[9px] px-2 py-0.5 shadow-sm shrink-0 whitespace-nowrap">
              <Leaf className="w-2.5 h-2.5 fill-white" />
              {getLocalizedText("vegetarian", lang)}
            </Badge>
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          className={`absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-md transition-all z-10 ${
            isFavorite
              ? "bg-rose-500 text-white shadow-md"
              : "bg-white/85 text-[#8A8F98] hover:text-rose-500"
          }`}
          title={getLocalizedText("details", lang)}
          id={`fav-btn-${product.id}`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-white" : ""}`} />
        </button>

        {/* Rating pill — only shown when the product actually has a rating */}
        {product.rating != null && (
          <Badge tone="neutral" className="absolute bottom-2.5 left-2.5 bg-white/90 backdrop-blur-md text-[#14151A] text-[10px] px-2 shadow-sm">
            <Star className="w-3 h-3 fill-[#FFB020] text-[#FFB020]" />
            <span>{Number(product.rating).toFixed(1)}</span>
          </Badge>
        )}

        {/* Prep Time floating badge — no font-bold in the original (unlike
            the rating pill above), so font-normal cancels Badge's default. */}
        {product.prepTime && (
          <Badge tone="neutral" className="absolute bottom-2.5 right-2.5 bg-white/90 backdrop-blur-md text-[#14151A] text-[10px] px-2 font-normal shadow-sm">
            <Clock className="w-3 h-3 text-[var(--theme-primary)]" />
            <span>{product.prepTime}</span>
          </Badge>
        )}
      </div>

      {/* Product Information Body */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
        <div className="cursor-pointer" onClick={() => onOpenDetail(originalProduct)}>
          <h3 className="text-sm sm:text-base font-bold text-[#14151A] group-hover:text-[var(--theme-primary)] transition-colors line-clamp-1 mb-1">
            {product.name}
          </h3>
          <p className="text-[#8A8F98] text-xs line-clamp-2 leading-relaxed mb-3">
            {product.description}
          </p>
        </div>

        {/* Footer Price & Add Button */}
        <div className="flex items-center justify-between pt-2.5 border-t border-[#F0F0F2] gap-2">
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            {product.originalPrice ? (
              <span className="text-[#B4B8C0] text-xs line-through">{product.originalPrice.toFixed(2)} {currencySymbol}</span>
            ) : null}
            <span className="text-base sm:text-lg font-extrabold text-[#14151A] tracking-tight">
              {product.price.toFixed(2)} {currencySymbol}
            </span>
          </span>

          <button
            onClick={() => onAddToCart(originalProduct)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white shrink-0 transition-transform active:scale-95 hover:scale-105"
            style={{ background: 'linear-gradient(180deg, #7B61FF 0%, #5B3DF5 100%)', boxShadow: '0 6px 16px -4px rgba(108,76,255,.5)' }}
            title={getLocalizedText("addToCart", lang)}
            id={`add-btn-${product.id}`}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
