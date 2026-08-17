"use client";

import React, { useState } from "react";
import Image from 'next/image';
import {
  Star, Clock, Flame, Leaf, Sparkles, Plus, Minus,
  ShoppingBag, Check, Utensils, Heart,
} from "lucide-react";
import { getLocalizedProduct, getLocalizedText, getLocalizedCategoryName } from "@/lib/translations";
import { useAppStore } from "@/lib/store";
import { Sheet, SheetClose, Button, Tag, Textarea, Field } from "@/components/kit";
import { cn } from "@/lib/utils";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";

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
    setSelectedOptions((prev) => ({ ...prev, [optionTitle]: choice }));
  };

  const handleAdd = () => {
    onAddToCartWithOptions(rawProduct, quantity, selectedOptions, note);
    onClose();
  };

  const markers = [
    product.isPopular && { key: 'pop', Icon: Star, label: getLocalizedText("popular", lang) },
    product.isChefChoice && { key: 'chef', Icon: Sparkles, label: getLocalizedText("chefChoice", lang) },
    product.isSpicy && { key: 'spicy', Icon: Flame, label: getLocalizedText("spicy", lang) },
    product.isVegetarian && { key: 'veg', Icon: Leaf, label: getLocalizedText("vegetarian", lang) },
  ].filter(Boolean);

  return (
    <Sheet
      isOpen={Boolean(rawProduct)}
      onClose={onClose}
      /* Bottom sheet on phones, centred dialog from `sm` up — a full-height
         centred modal on a 375px screen wastes the bottom third on scrim. */
      side="bottom"
      size="xl"
      ariaLabel={product.name}
      /* theme={null} renders in place rather than portalling to <body>.
         --theme-primary (the restaurant's brand colour) is set as an INLINE
         style on CustomerApp's root div, so a portalled panel would escape it
         and every accent in here would resolve to nothing. */
      theme={null}
      panelClassName="kit-light sm:rounded-[var(--k-r-lg)] sm:border sm:max-w-2xl sm:mx-auto sm:my-auto"
      scrimClassName="sm:items-center sm:justify-center sm:p-4"
    >
      {/* Hero image with the close button floated over it — no separate header
          bar stealing vertical space above the photo. */}
      <div className="relative aspect-[16/10] sm:aspect-[2/1] w-full overflow-hidden bg-[var(--k-surface-2)]">
        <Image
          src={product.image?.trim() || FALLBACK_IMAGE}
          alt={product.name}
          className="object-cover"
          fill
          sizes="(max-width: 640px) 100vw, 640px"
          unoptimized
        />
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button
            onClick={() => onToggleFavorite(product.id)}
            aria-label={getLocalizedText("details", lang)}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-[var(--k-r-sm)] backdrop-blur-sm transition-colors duration-[var(--k-dur)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)]',
              isFavorite
                ? 'bg-[var(--k-danger)] text-white'
                : 'bg-[var(--k-surface)]/92 text-[var(--k-text-3)] hover:text-[var(--k-danger)]',
            )}
          >
            <Heart className={cn('w-4 h-4', isFavorite && 'fill-current')} />
          </button>
          <SheetClose onClick={onClose} id="modal-close-btn" className="bg-[var(--k-surface)]/92 backdrop-blur-sm hover:bg-[var(--k-surface)]" />
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">

        {/* Title + price */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--k-text-3)]">
            {getLocalizedCategoryName({ id: product.category, name: product.category }, lang)}
          </p>
          <div className="mt-1.5 flex items-start justify-between gap-4">
            <h2 className="text-[22px] sm:text-2xl font-semibold leading-tight tracking-[-0.02em] text-[var(--k-text)]">
              {product.name}
            </h2>
            <span className="flex shrink-0 flex-col items-end leading-none">
              {product.originalPrice ? (
                <span className="k-nums text-xs text-[var(--k-text-3)] line-through">
                  {product.originalPrice.toFixed(2)} {currencySymbol}
                </span>
              ) : null}
              <span className="k-nums mt-1 text-[22px] sm:text-2xl font-semibold tracking-[-0.02em] text-[var(--k-text)]">
                {product.price.toFixed(2)} {currencySymbol}
              </span>
            </span>
          </div>

          {/* Markers as tonal tags, below the title where they read as
              attributes rather than as stickers on the photo. */}
          {(markers.length > 0 || product.rating != null) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {product.rating != null && (
                <Tag tone="warning" size="sm">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="k-nums">{Number(product.rating).toFixed(1)}</span>
                </Tag>
              )}
              {markers.map(({ key, Icon, label }) => (
                <Tag key={key} tone={key === 'chef' ? 'accent' : 'neutral'} size="sm">
                  <Icon className="w-3 h-3" aria-hidden="true" />
                  {label}
                </Tag>
              ))}
            </div>
          )}
        </div>

        {/* Prep time / calories — a plain meta row, not a boxed panel. */}
        {(product.prepTime || product.calories) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[var(--k-border)] py-3 text-[13px] text-[var(--k-text-2)]">
            {product.prepTime && (
              <span className="inline-flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[var(--k-text-3)]" aria-hidden="true" />
                {getLocalizedText("prepTime", lang)}
                <strong className="font-medium text-[var(--k-text)]">{product.prepTime}</strong>
              </span>
            )}
            {product.calories && (
              <span className="inline-flex items-center gap-2">
                <Utensils className="w-3.5 h-3.5 text-[var(--k-text-3)]" aria-hidden="true" />
                {getLocalizedText("energy", lang)}
                <strong className="font-medium text-[var(--k-text)]">{product.calories}</strong>
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {product.description && (
          <p className="text-sm leading-relaxed text-[var(--k-text-2)]">{product.description}</p>
        )}

        {/* Ingredients */}
        {product.ingredients && product.ingredients.length > 0 && (
          <section>
            <h4 className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--k-text-3)]">
              {getLocalizedText("ingredients", lang)}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {product.ingredients.map((ing, idx) => (
                <Tag key={idx} tone="neutral" size="sm">{ing}</Tag>
              ))}
            </div>
          </section>
        )}

        {/* Options. Rendered as a real radiogroup — the old version was a grid
            of buttons with a fake radio circle and no group semantics, so a
            screen reader announced four unrelated buttons. */}
        {product.options && product.options.length > 0 && (
          <div className="space-y-5">
            {product.options.map((optGroup) => (
              <section key={optGroup.title} role="radiogroup" aria-label={optGroup.title}>
                <h4 className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--k-text-3)]">
                  {optGroup.title}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {optGroup.choices.map((choice) => {
                    const isSelected = selectedOptionTitle(selectedOptions, optGroup.title) === choice.name;
                    return (
                      <button
                        key={choice.name}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleOptionSelect(optGroup.title, choice)}
                        className={cn(
                          'flex min-w-0 items-center justify-between gap-2 rounded-[var(--k-r)] border px-3 py-2.5 text-[13px] transition-colors duration-[var(--k-dur)]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)]',
                          isSelected
                            ? 'border-[var(--k-accent)] bg-[var(--k-accent-soft)] text-[var(--k-text)]'
                            : 'border-[var(--k-border)] bg-[var(--k-surface)] text-[var(--k-text-2)] hover:border-[var(--k-border-2)]',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                              isSelected
                                ? 'border-[var(--k-accent)] bg-[var(--k-accent)] text-[var(--k-accent-fg)]'
                                : 'border-[var(--k-border-2)]',
                            )}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5" />}
                          </span>
                          <span className="truncate font-medium">{choice.name}</span>
                        </span>
                        {choice.extraPrice > 0 ? (
                          <span className="k-nums shrink-0 whitespace-nowrap font-medium text-[var(--k-accent)]">
                            +{choice.extraPrice.toFixed(2)} {currencySymbol}
                          </span>
                        ) : (
                          <span className="shrink-0 whitespace-nowrap text-[var(--k-text-3)]">
                            {getLocalizedText("freeOption", lang)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Kitchen note */}
        <Field label={getLocalizedText("kitchenRequestLabel", lang)}>
          {(id, a11y) => (
            <Textarea
              id={id} {...a11y}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={getLocalizedText("kitchenRequestPlaceholder", lang)}
              rows={2}
            />
          )}
        </Field>
      </div>

      {/* Sticky action bar. Quantity and the add button on one line so the
          primary action stays reachable with a thumb on mobile. */}
      <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-[var(--k-border)] bg-[var(--k-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
        <div className="flex h-12 shrink-0 items-center gap-1 rounded-[var(--k-r)] border border-[var(--k-border)] bg-[var(--k-surface-2)] px-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            id="qty-minus-btn"
            aria-label="-"
            disabled={quantity <= 1}
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
          <span className="k-nums w-7 text-center text-sm font-semibold text-[var(--k-text)]" aria-live="polite">
            {quantity}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setQuantity((q) => q + 1)}
            id="qty-plus-btn"
            aria-label="+"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={handleAdd}
          id="modal-add-to-cart-btn"
          className="h-12 flex-1 justify-between gap-2 min-w-0"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span className="truncate">{getLocalizedText("addToCart", lang)}</span>
          </span>
          <span className="k-nums shrink-0 whitespace-nowrap font-semibold">
            {calculateTotal()} {currencySymbol}
          </span>
        </Button>
      </div>
    </Sheet>
  );
};

// Helper function
function selectedOptionTitle(selectedOptions, groupTitle) {
  return selectedOptions[groupTitle]?.name || "";
}
