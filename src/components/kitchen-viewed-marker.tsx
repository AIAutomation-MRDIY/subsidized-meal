'use client';

import { useEffect } from 'react';

/** Stamps a cookie when admin visits the Kitchen page so the sidebar badge clears. */
export function KitchenViewedMarker() {
  useEffect(() => {
    document.cookie = `kitchen_nr_viewed_at=${Date.now()}; path=/; max-age=86400`;
  }, []);
  return null;
}
