"use client";

import { CustomerApp } from "@/components/CustomerApp";
import { use } from 'react';
import { redirect } from 'next/navigation';

export default function RestaurantMenuPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const { restaurant } = params;

  // Pre-multi-tenant QR codes point to /menu/[table] (e.g. /menu/12).
  // If the single segment after /menu/ is purely numeric, it's a legacy table number.
  // Redirect it to /menu/default/[table].
  if (restaurant && /^\d+$/.test(restaurant)) {
    redirect(`/menu/default/${encodeURIComponent(restaurant)}`);
  }

  return <CustomerApp />;
}
