"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { clientApi } from "@/lib/api";
import { ProductCard } from "./product-card";
import { Skeleton } from "./interaction-kit";

export const RECENTLY_VIEWED_KEY = "hajjmart-recently-viewed-v1";

// Keep the default prop referentially stable. `products = []` creates a new array on
// every render and can retrigger effects forever when the rail is rendered without
// a products prop (for example on /account and product detail pages).
const EMPTY_PRODUCTS: Product[] = [];

export function rememberRecentlyViewed(productId: number) {
  try {
    const current = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]") as number[];
    const next = [productId, ...current.filter((id) => id !== productId)].slice(0, 12);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // Browsing remains fully functional when storage is blocked.
  }
}

function mergeProducts(current: Product[], incoming: Product[]): Product[] {
  if (!incoming.length) return current;

  const byId = new Map(current.map((product) => [product.id, product]));
  let changed = false;

  for (const product of incoming) {
    if (byId.get(product.id) !== product) {
      byId.set(product.id, product);
      changed = true;
    }
  }

  return changed ? Array.from(byId.values()) : current;
}

export function RecentlyViewedRail({ products = EMPTY_PRODUCTS, excludeId }: { products?: Product[]; excludeId?: number }) {
  const [ids, setIds] = useState<number[]>([]);
  const [fetchedProducts, setFetchedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const attemptedIds = useRef(new Set<number>());

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]") as unknown;
      setIds(Array.isArray(stored) ? stored.filter((id): id is number => typeof id === "number" && Number.isInteger(id)) : []);
    } catch {
      setIds([]);
    }
  }, []);

  // Server/page-provided products and products fetched specifically for the rail are
  // derived together instead of copying `products` into state inside an effect.
  // That removes the render -> effect -> setState -> render cycle entirely.
  const resolved = useMemo(
    () => mergeProducts(products, fetchedProducts),
    [products, fetchedProducts],
  );

  useEffect(() => {
    const wanted = ids.filter((id) => id !== excludeId).slice(0, 4);
    const resolvedIds = new Set(resolved.map((product) => product.id));
    const missing = wanted.filter((id) => !resolvedIds.has(id) && !attemptedIds.current.has(id));

    if (!missing.length) return;

    // A deleted product or a temporary API failure must not create an infinite retry
    // render loop. Each ID gets one request attempt per mounted rail; a page refresh
    // gives transient failures another chance naturally.
    missing.forEach((id) => attemptedIds.current.add(id));
    let cancelled = false;
    setLoading(true);

    void Promise.allSettled(
      missing.map((id) => clientApi<Product>(`/products/${id}`).then((response) => response.data)),
    )
      .then((results) => {
        if (cancelled) return;
        const fetched = results.flatMap((result) =>
          result.status === "fulfilled" && result.value ? [result.value] : [],
        );
        if (fetched.length) {
          setFetchedProducts((current) => mergeProducts(current, fetched));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ids, excludeId, resolved]);

  const recent = useMemo(
    () => ids
      .map((id) => resolved.find((product) => product.id === id))
      .filter((product): product is Product => Boolean(product && product.id !== excludeId))
      .slice(0, 4),
    [ids, resolved, excludeId],
  );

  if (!ids.filter((id) => id !== excludeId).length) return null;
  if (!recent.length && !loading) return null;

  return <section className="recently-viewed-rail">
    <div className="mb-7"><p className="eyebrow">Picked up where you left off</p><h2 className="mt-2 font-serif text-3xl">Recently viewed</h2></div>
    {recent.length
      ? <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-5">{recent.map((product) => <ProductCard key={product.id} product={product}/>)}</div>
      : loading
        ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: Math.min(4, ids.length) }).map((_, index) => <Skeleton key={index} className="aspect-[4/5] rounded-2xl"/>)}</div>
        : null}
  </section>;
}
