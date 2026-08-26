"use client";

import React, { useState } from "react";
import Image from 'next/image';
import {
  Star, Clock, Flame, Leaf, Sparkles, Plus, Minus,
  Check, Utensils, ChevronLeft, Beef, Wheat, Droplet,
} from "lucide-react";
import { getLocalizedProduct, getLocalizedText, getLocalizedCategoryName } from "@/lib/translations";
import { useAppStore } from "@/lib/store";
import { Sheet, Button, Tag, Textarea, Field } from "@/components/kit";
import { cn } from "@/lib/utils";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";

export const ProductDetailModal = ({
  product: rawProduct,
  onClose,
  onAddToCartWithOptions,
  lang = "az",
}) => {
  const currencySymbol = useAppStore(state => state.settings?.currencySymbol) || '₼';
  // Read from the store rather than a prop — categories are already
  // globally loaded there for every surface, same as currencySymbol above.
  const categories = useAppStore(state => state.categories);
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

  const category = categories.find((c) => c.id?.toString() === product.category?.toString());

  // Attribute row that sits directly above the title: diet, heat and the two
  // promotional markers, as tonal tags rather than stickers on the photo.
  const attributeTags = [
    product.isVegetarian && { key: 'veg', Icon: Leaf, label: getLocalizedText("vegetarian", lang), tone: 'success' },
    product.isSpicy && { key: 'spicy', Icon: Flame, label: getLocalizedText("spicy", lang), tone: 'danger' },
    product.isPopular && { key: 'pop', Icon: Star, label: getLocalizedText("popular", lang), tone: 'neutral' },
    product.isChefChoice && { key: 'chef', Icon: Sparkles, label: getLocalizedText("chefChoice", lang), tone: 'accent' },
  ].filter(Boolean);

  // Nutrition cells (0031_product_nutrition.sql). Every field is optional per
  // product — an admin who hasn't measured the macros leaves them blank and
  // those cells simply don't render, rather than showing a misleading 0.
  const nutritionCells = [
    product.calories && { key: 'kcal', Icon: Flame, value: product.calories, label: getLocalizedText("energy", lang) },
    product.protein && { key: 'protein', Icon: Beef, value: product.protein, label: getLocalizedText("proteinLabel", lang) },
    product.carbs && { key: 'carbs', Icon: Wheat, value: product.carbs, label: getLocalizedText("carbsLabel", lang) },
    product.fat && { key: 'fat', Icon: Droplet, value: product.fat, label: getLocalizedText("fatLabel", lang) },
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
      /* top/right/left/bottom-24 (not inset-0) keeps CustomerApp's fixed
         bottom nav visible above the scrim — see CartDrawer.jsx's Sheet for
         the full rationale (same 6rem the page's own pb-24 reserves). */
      scrimClassName="top-0 right-0 left-0 bottom-24 sm:items-center sm:justify-center sm:p-4"
    >
      {/* Hero. Contained on a soft tint rather than edge-to-edge cover, so the
          whole dish stays visible the way the reference's cut-out product shot
          does. The back control floats over it — no separate header bar
          stealing vertical space above the photo. */}
      <div className="relative aspect-[16/11] w-full overflow-hidden bg-[var(--k-surface-2)]">
        <Image
          src={product.image?.trim() || FALLBACK_IMAGE}
          alt={product.name}
          className="object-cover"
          fill
          sizes="(max-width: 640px) 100vw, 640px"
          unoptimized
        />
        <button
          onClick={onClose}
          id="modal-close-btn"
          aria-label={getLocalizedText("cancel", lang)}
          className="absolute left-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--k-surface)]/92 text-[var(--k-text)] backdrop-blur-sm transition-colors hover:bg-[var(--k-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--k-focus)]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Body. Pulled up over the hero's bottom edge on a rounded white sheet,
          the way the reference overlaps its image. */}
      <div className="relative -mt-5 rounded-t-[24px] bg-[var(--k-surface)] px-4 pb-4 pt-5 sm:px-6">

        {/* Attribute row */}
        {attributeTags.length > 0 && (
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {attributeTags.map(({ key, Icon, label, tone }) => (
              <Tag key={key} tone={tone} size="sm">
                <Icon className="w-3 h-3" aria-hidden="true" />
                {label}
              </Tag>
            ))}
          </div>
        )}

        {/* Title */}
        <div>
          <div className="min-w-0">
            <h2 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--k-text)]">
              {product.name}
            </h2>
            {/* Kateqoriya + hazırlanma vaxtı. Hazırlanma vaxtı qəsdən
                qidalanma panelində deyil: o, qidalanma göstəricisi deyil,
                gözləmə müddətidir — panel yalnız makro dəyərlər üçün qalır. */}
            {(category || product.prepTime) && (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--k-text-3)]">
                {category && <span>{getLocalizedCategoryName(category, lang)}</span>}
                {category && product.prepTime && <span aria-hidden="true">·</span>}
                {product.prepTime && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {product.prepTime}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <section className="mt-5">
            <h3 className="mb-1.5 text-[15px] font-bold text-[var(--k-text)]">
              {getLocalizedText("description", lang)}
            </h3>
            <p className="text-[13px] leading-relaxed text-[var(--k-text-2)]">{product.description}</p>
          </section>
        )}

        {/* Ingredients */}
        {product.ingredients && product.ingredients.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-2.5 text-[15px] font-bold text-[var(--k-text)]">
              {getLocalizedText("ingredients", lang)}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {product.ingredients.map((ing, idx) => (
                <Tag key={idx} tone="neutral" size="sm">{ing}</Tag>
              ))}
            </div>
          </section>
        )}

        {/* Customisation. A real radiogroup per option set — the reference's
            chip row is a single-choice control, and a screen reader needs the
            group semantics to announce it as one. */}
        {product.options && product.options.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-2.5 text-[15px] font-bold text-[var(--k-text)]">
              {getLocalizedText("customisationLabel", lang)}
            </h3>
            <div className="space-y-4">
              {product.options.map((optGroup) => (
                <div key={optGroup.title} role="radiogroup" aria-label={optGroup.title}>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--k-text-3)]">
                    {optGroup.title}
                  </p>
                  <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 no-scrollbar sm:-mx-6 sm:px-6">
                    {optGroup.choices.map((choice) => {
                      const isSelected = selectedOptionTitle(selectedOptions, optGroup.title) === choice.name;
                      return (
                        <button
                          key={choice.name}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => handleOptionSelect(optGroup.title, choice)}
                          className="group flex w-[68px] shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none"
                        >
                          <span
                            className={cn(
                              'relative flex h-14 w-14 items-center justify-center rounded-full border-2 transition-colors duration-[var(--k-dur)]',
                              'group-focus-visible:ring-2 group-focus-visible:ring-[var(--k-focus)]',
                              isSelected
                                ? 'border-[var(--k-accent)] bg-[var(--k-accent-soft)]'
                                : 'border-[var(--k-border)] bg-[var(--k-surface-2)]',
                            )}
                          >
                            {/* Admin-in seçdiyi emoji (choice.icon), yoxdursa
                                neytral ehtiyat ikon — kateqoriya kaşeləri ilə
                                eyni məntiq. */}
                            {choice.icon ? (
                              <span aria-hidden="true" className="text-2xl leading-none">{choice.icon}</span>
                            ) : (
                              <Utensils
                                className={cn('h-5 w-5', isSelected ? 'text-[var(--k-accent)]' : 'text-[var(--k-text-3)]')}
                                aria-hidden="true"
                              />
                            )}
                            {isSelected && (
                              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--k-accent)] text-[var(--k-accent-fg)]">
                                <Check className="h-3 w-3" strokeWidth={3} />
                              </span>
                            )}
                          </span>
                          <span
                            className={cn(
                              'line-clamp-2 w-full text-center text-[11px] leading-tight',
                              isSelected ? 'font-semibold text-[var(--k-text)]' : 'font-medium text-[var(--k-text-3)]',
                            )}
                          >
                            {choice.name}
                          </span>
                          {choice.extraPrice > 0 && (
                            <span className="k-nums text-[10px] font-semibold text-[var(--k-accent)]">
                              +{choice.extraPrice.toFixed(2)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Nutrition panel */}
        {nutritionCells.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-2.5 text-[15px] font-bold text-[var(--k-text)]">
              {getLocalizedText("nutritionPanelLabel", lang)}
            </h3>
            <div className="flex flex-wrap gap-2">
              {nutritionCells.map(({ key, Icon, value, label }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--k-surface-2)] px-3.5 py-2"
                >
                  <Icon className="h-3.5 w-3.5 text-[var(--k-accent)]" aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-[var(--k-text)]">{value}</span>
                  <span className="text-[11px] text-[var(--k-text-3)]">{label}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Kitchen note */}
        <div className="mt-5">
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
      </div>

      {/* Sticky action bar. Quantity and the add button on one line so the
          primary action stays reachable with a thumb on mobile. */}
      <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-[var(--k-border)] bg-[var(--k-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
        <div className="flex h-12 shrink-0 items-center gap-1 rounded-full border border-[var(--k-border)] bg-[var(--k-surface-2)] px-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            id="qty-minus-btn"
            aria-label="-"
            disabled={quantity <= 1}
            className="rounded-full"
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
          <span className="k-nums w-7 text-center text-sm font-semibold text-[var(--k-text)]" aria-live="polite">
            {String(quantity).padStart(2, '0')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setQuantity((q) => q + 1)}
            id="qty-plus-btn"
            aria-label="+"
            className="rounded-full"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={handleAdd}
          id="modal-add-to-cart-btn"
          className="h-12 flex-1 justify-between gap-2 min-w-0 rounded-full"
        >
          <span className="truncate">{getLocalizedText("addToCart", lang)}</span>
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
