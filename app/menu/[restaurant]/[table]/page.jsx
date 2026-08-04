"use client";

import { Suspense } from "react";
import { CustomerApp } from "@/components/CustomerApp";

export default function TableMenuPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <CustomerApp />
    </Suspense>
  );
}

