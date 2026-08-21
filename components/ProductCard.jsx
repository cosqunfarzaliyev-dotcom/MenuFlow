"use client";

import React from "react";
import Image from 'next/image';
import { Star, Plus, Flame, Leaf, Sparkles } from "lucide-react";
import { getLocalizedProduct, getLocalizedText } from "@/lib/translations";
import { useAppStore } from "@/lib/store";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";

export const ProductCard = ({
  product: originalProduct,
  onOpenDetail,
  onAddToCart,
  lang = "az",
}) => {
  const currencySymbol = useAppStore(state => state.settings?.currencySymbol) || '₼';
  const product = getLocalizedProduct(originalProduct, lang);

  // Diet/heat markers answer "can I eat this", not "should I want this", so
  // they stay as small glyphs on the image rather than competing with the
  // Popular/Chef labels.
  const dietTags = [
    product.isSpicy && { key: 'spicy', Icon: Flame, label: getLocalizedText("spicy", lang) },
    product.isVegetarian && { key: 'veg', Icon: Leaf, label: getLocalizedText("vegetarian", lang) },
  ].filter(Boolean);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[20px] bg-[var(--k-surface)] shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-shadow duration-[var(--k-dur)] ease-[var(--k-ease)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.10)]">

      {/* Image. Square, contained on a soft tint rather than cover-cropped:
          the reference presents each dish as a cut-out product shot floating
          on a light ground, which only works if the whole item stays visible.
          object-contain also stops arbitrary admin photography from being
          cropped through the middle of the dish. */}
      <button
        type="button"
        onClick={() => onOpenDetail(originalProduct)}
        aria-label={product.name}
        className="relative block w-full aspect-square overflow-hidden bg-[var(--k-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)] focus-visible:ring-inset"
      >
        <Image
          src={product.image?.trim() || FALLBACK_IMAGE}
          alt={product.name}
          className="object-cover transition-transform duration-500 ease-[var(--k-ease)] group-hover:scale-[1.04]"
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          unoptimized
        />

        {/* Promotional markers — top-left. Solid-on-image is intentional (a
            tonal wash would be unreadable over arbitrary photography). */}
        {(product.isPopular || product.isChefChoice) && (
          <span className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap gap-1.5">
            {product.isPopular && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--k-text)]/85 px-2 py-1 text-[10px] font-medium text-[var(--k-surface)] backdrop-blur-sm">
                <Star className="w-2.5 h-2.5 fill-current" />
                {getLocalizedText("popular", lang)}
              </span>
            )}
            {product.isChefChoice && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--k-accent)] px-2 py-1 text-[10px] font-medium text-[var(--k-accent-fg)]">
                <Sparkles className="w-2.5 h-2.5" />
                {getLocalizedText("chefChoice", lang)}
              </span>
            )}
          </span>
        )}

        {/* Diet markers — bottom-left, glyph + accessible label. */}
        {dietTags.length > 0 && (
          <span className="absolute bottom-2.5 left-2.5 flex gap-1.5">
            {dietTags.map(({ key, Icon, label }) => (
              <span
                key={key}
                title={label}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--k-surface)]/92 text-[var(--k-text-2)] backdrop-blur-sm"
              >
                <Icon className="w-3 h-3" aria-hidden="true" />
                <span className="sr-only">{label}</span>
              </span>
            ))}
          </span>
        )}
      </button>

      {/* Body. Name, then price+add — no description: the card carries only
          what's needed to choose between two dishes at a glance, and the full
          copy is one tap away in the detail sheet. */}
      <div className="flex flex-1 flex-col gap-2 px-3 pb-3 pt-2.5">
        <button
          type="button"
          onClick={() => onOpenDetail(originalProduct)}
          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)] rounded-[var(--k-r-sm)]"
        >
          <h3 className="truncate text-[15px] font-semibold leading-snug text-[var(--k-text)]">
            {product.name}
          </h3>
        </button>

        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="flex min-w-0 flex-col leading-none">
            {product.originalPrice ? (
              <span className="k-nums truncate text-[11px] text-[var(--k-text-3)] line-through">
                {product.originalPrice.toFixed(2)} {currencySymbol}
              </span>
            ) : null}
            <span className="k-nums mt-1 truncate text-[17px] font-bold tracking-[-0.01em] text-[var(--k-text)]">
              {product.price.toFixed(2)} {currencySymbol}
            </span>
          </span>

          <button
            onClick={() => onAddToCart(originalProduct)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--k-accent)] text-[var(--k-accent-fg)] transition-colors duration-[var(--k-dur)] hover:bg-[var(--k-accent-hover)] active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--k-surface)]"
            title={getLocalizedText("addToCart", lang)}
            id={`add-btn-${product.id}`}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </article>
  );
};
