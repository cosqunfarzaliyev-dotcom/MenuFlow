"use client";

import React from "react";
import Image from 'next/image';
import { Star, Heart, Clock, Plus, Flame, Leaf, Sparkles } from "lucide-react";
import { getLocalizedProduct, getLocalizedText } from "@/lib/translations";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";

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

  // Diet/heat markers sit apart from the promotional ones: they answer "can I
  // eat this", not "should I want this", so they render as small glyphs on the
  // image rather than competing with the Popular/Chef labels.
  const dietTags = [
    product.isSpicy && { key: 'spicy', Icon: Flame, label: getLocalizedText("spicy", lang) },
    product.isVegetarian && { key: 'veg', Icon: Leaf, label: getLocalizedText("vegetarian", lang) },
  ].filter(Boolean);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--k-r-lg)] border border-[var(--k-border)] bg-[var(--k-surface)] transition-colors duration-[var(--k-dur)] ease-[var(--k-ease)] hover:border-[var(--k-border-2)]">

      {/* Image. Fixed 4:3 ratio instead of a fixed pixel height so every card in
          a row crops identically regardless of breakpoint — the food is the
          hero, so it gets the whole top of the card with no chrome over it
          except the two marker rows. */}
      <button
        type="button"
        onClick={() => onOpenDetail(originalProduct)}
        aria-label={product.name}
        className="relative block w-full aspect-[4/3] overflow-hidden bg-[var(--k-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)] focus-visible:ring-inset"
      >
        <Image
          src={product.image?.trim() || FALLBACK_IMAGE}
          alt={product.name}
          className="object-cover transition-transform duration-500 ease-[var(--k-ease)] group-hover:scale-[1.03]"
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          unoptimized
        />

        {/* Promotional markers — top-left, max two so they never wrap over the
            image. Solid-on-image is intentional here (a tonal wash would be
            unreadable over arbitrary photography). */}
        {(product.isPopular || product.isChefChoice) && (
          <span className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
            {product.isPopular && (
              <span className="inline-flex items-center gap-1 rounded-[var(--k-r-sm)] bg-[var(--k-text)]/85 px-2 py-1 text-[10px] font-medium text-[var(--k-surface)] backdrop-blur-sm">
                <Star className="w-2.5 h-2.5 fill-current" />
                {getLocalizedText("popular", lang)}
              </span>
            )}
            {product.isChefChoice && (
              <span className="inline-flex items-center gap-1 rounded-[var(--k-r-sm)] bg-[var(--k-accent)] px-2 py-1 text-[10px] font-medium text-[var(--k-accent-fg)]">
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
                className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--k-r-sm)] bg-[var(--k-surface)]/92 text-[var(--k-text-2)] backdrop-blur-sm"
              >
                <Icon className="w-3 h-3" aria-hidden="true" />
                <span className="sr-only">{label}</span>
              </span>
            ))}
          </span>
        )}

        {/* Prep time — bottom-right, the one piece of metadata a hungry person
            actually scans for. */}
        {product.prepTime && (
          <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-[var(--k-r-sm)] bg-[var(--k-surface)]/92 px-2 py-1 text-[10px] font-medium text-[var(--k-text-2)] backdrop-blur-sm">
            <Clock className="w-2.5 h-2.5" aria-hidden="true" />
            {product.prepTime}
          </span>
        )}
      </button>

      {/* Favourite. Outside the image button so it isn't nested inside it —
          the old markup had a <button> inside a click handler div and relied on
          stopPropagation. */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(product.id); }}
        className={cn(
          'absolute top-2.5 right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-[var(--k-r-sm)] backdrop-blur-sm transition-colors duration-[var(--k-dur)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)]',
          isFavorite
            ? 'bg-[var(--k-danger)] text-white'
            : 'bg-[var(--k-surface)]/92 text-[var(--k-text-3)] hover:text-[var(--k-danger)]',
        )}
        title={getLocalizedText("details", lang)}
        id={`fav-btn-${product.id}`}
      >
        <Heart className={cn('w-3.5 h-3.5', isFavorite && 'fill-current')} />
      </button>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3.5">
        <button
          type="button"
          onClick={() => onOpenDetail(originalProduct)}
          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)] rounded-[var(--k-r-sm)]"
        >
          <h3 className="text-[15px] font-semibold leading-snug text-[var(--k-text)] line-clamp-1">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--k-text-3)] line-clamp-2">
              {product.description}
            </p>
          )}
        </button>

        {/* Rating, when the product has one. Moved off the image and into the
            body: over photography it was one more floating chip; here it reads
            as what it is, a piece of product data. */}
        {product.rating != null && (
          <span className="mt-2 inline-flex w-fit items-center gap-1 text-[11px] font-medium text-[var(--k-text-2)]">
            <Star className="w-3 h-3 fill-[var(--k-warning)] text-[var(--k-warning)]" />
            <span className="k-nums">{Number(product.rating).toFixed(1)}</span>
          </span>
        )}

        {/* Price + add. Sits at the bottom of the card regardless of how long
            the title/description ran, so the add buttons line up across a row. */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3.5">
          <span className="flex flex-col leading-none">
            {product.originalPrice ? (
              <span className="k-nums text-[11px] text-[var(--k-text-3)] line-through">
                {product.originalPrice.toFixed(2)} {currencySymbol}
              </span>
            ) : null}
            <span className="k-nums mt-1 text-[17px] font-semibold tracking-[-0.01em] text-[var(--k-text)]">
              {product.price.toFixed(2)} {currencySymbol}
            </span>
          </span>

          <button
            onClick={() => onAddToCart(originalProduct)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--k-r)] bg-[var(--k-accent)] text-[var(--k-accent-fg)] transition-colors duration-[var(--k-dur)] hover:bg-[var(--k-accent-hover)] active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--k-surface)]"
            title={getLocalizedText("addToCart", lang)}
            id={`add-btn-${product.id}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
};
