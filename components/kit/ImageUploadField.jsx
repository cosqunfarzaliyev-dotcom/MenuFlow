"use client";

// ---------------------------------------------------------------------------
// components/kit/ImageUploadField.jsx
//
// Hybrid image field: a manual file-upload button (Supabase Storage, via
// lib/services/storageService.js) sitting next to the plain URL text input
// that already existed everywhere (product/category/restaurant-logo forms).
// Uploading fills the SAME text field with the resulting public URL rather
// than introducing a separate "uploaded image" concept — the underlying
// data model stays one text column, an admin who prefers pasting an
// external link can still just do that.
//
// Deliberately translation-agnostic (labels come in as props, like every
// other kit primitive) — this file has no useXTranslation() call of its own.
// ---------------------------------------------------------------------------
import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadRestaurantImage } from '@/lib/services/storageService';
import { Input, Button, Tag } from './primitives';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export function ImageUploadField({
  value,
  onChange,
  restaurantId,
  folder,
  urlPlaceholder,
  uploadLabel,
  previewAlt,
  invalidLabel,
  id,
  className,
  ...a11y
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [previewValid, setPreviewValid] = useState(true);

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    // Reset the input's own value so selecting the SAME file again still
    // fires onChange (browsers dedupe identical selections otherwise).
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    const { url, error } = await uploadRestaurantImage(file, { restaurantId, folder });
    setUploading(false);

    if (error) {
      setUploadError(error.message);
      return;
    }
    setPreviewValid(true);
    onChange(url);
  };

  const handleUrlChange = (event) => {
    setPreviewValid(true);
    setUploadError(null);
    onChange(event.target.value);
  };

  const trimmedValue = (value || '').trim();

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <Input id={id} type="text" value={value || ''} onChange={handleUrlChange} placeholder={urlPlaceholder} className="flex-1" {...a11y} />
        <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFileSelect} />
        <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} loading={uploading} icon={<Upload className="w-4 h-4" />}>
          {uploadLabel}
        </Button>
      </div>
      {uploadError && <p className="text-xs font-medium text-[var(--k-danger)]">{uploadError}</p>}
      {trimmedValue && (
        <div className="flex items-center gap-3 p-3 bg-[var(--k-surface-2)] border border-[var(--k-border)] rounded-[var(--k-r)]">
          {previewValid ? (
            <Image
              key={trimmedValue}
              src={trimmedValue}
              alt={previewAlt}
              width={40}
              height={40}
              unoptimized
              className="w-10 h-10 object-contain rounded-[var(--k-r-sm)] border border-[var(--k-border)]"
              // A solid --k-surface-3 fill here used to make every preview
              // look "fine" regardless of whether the uploaded PNG actually
              // had a transparent background — an admin had no way to tell
              // the difference from this thumbnail alone, and this panel's
              // own dark theme isn't representative of the (often light)
              // customer menu the logo actually renders on anyway. A
              // checkerboard is the standard "this is really transparent"
              // tell — a logo with a baked-in white/colored background
              // shows a solid square here; a truly transparent one shows
              // the checker pattern through it.
              style={{
                backgroundImage:
                  'conic-gradient(#8886 25%, transparent 0 50%, #8886 0 75%, transparent 0)',
                backgroundSize: '8px 8px',
                backgroundColor: 'var(--k-surface-3)',
              }}
              onError={() => setPreviewValid(false)}
            />
          ) : (
            <Tag tone="danger">{invalidLabel}</Tag>
          )}
        </div>
      )}
    </div>
  );
}

export default ImageUploadField;
