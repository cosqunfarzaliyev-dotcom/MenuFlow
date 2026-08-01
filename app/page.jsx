"use client";

import React, { useEffect, useState } from 'react';
import { CustomerApp } from '@/components/CustomerApp';
import { StaffApp } from '@/components/StaffApp';
import { AdminApp } from '@/components/AdminApp';
import { useAppStore } from '@/lib/store';

export default function AppRoot() {
  const {
  role,
  setRole,
  setCurrentTable,
} = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryRole = params.get("role");
      const table = params.get("table");

      if (table) {
        setCurrentTable(table);
        if (queryRole !== "admin" && queryRole !== "staff") {
          setRole("customer");
        }
      }

      if (
        queryRole === "admin" ||
        queryRole === "staff" ||
        queryRole === "customer"
      ) {
        setRole(queryRole);
      }
    }
    return () => window.clearTimeout(timer);
  }, [setRole, setCurrentTable]);

  if (!mounted) return null; // Avoid hydration mismatch on initial render for persist

  if (role === 'admin') return <AdminApp />;
  if (role === 'staff') return <StaffApp />;
  return <CustomerApp />;
}

