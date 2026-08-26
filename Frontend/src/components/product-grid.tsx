"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { ProductCard } from "./product-card";
import { Reveal } from "./reveal";

export function ProductGrid({ products, className = "", priorityCount = 0 }: { products: Product[]; className?: string; priorityCount?: number }) {
  const [changing, setChanging] = useState(false);
  const [entering, setEntering] = useState(false);
  const changeTimer = useRef<number | null>(null);
  const signature = useMemo(() => products.map((product) => product.id).join(":"), [products]);

  useEffect(() => {
    const onChanging = () => {
      setChanging(true);
      if (changeTimer.current) window.clearTimeout(changeTimer.current);
      changeTimer.current = window.setTimeout(() => setChanging(false), 1800);
    };
    window.addEventListener("hajjmart:shop-results-changing", onChanging);
    return () => {
      window.removeEventListener("hajjmart:shop-results-changing", onChanging);
      if (changeTimer.current) window.clearTimeout(changeTimer.current);
    };
  }, []);

  useEffect(() => {
    setChanging(false);
    if (changeTimer.current) { window.clearTimeout(changeTimer.current); changeTimer.current = null; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setEntering(true);
    const timer = window.setTimeout(() => setEntering(false), 280);
    return () => window.clearTimeout(timer);
  }, [signature]);

  return (
    <div className={`product-results-grid ${changing ? "is-changing" : ""} ${entering ? "is-entering" : ""} grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 xl:gap-x-7 ${className}`}>
      {products.map((product, index) => (
        <Reveal key={product.id} delay={(index % 4) * 60}>
          <ProductCard product={product} priority={index < priorityCount} />
        </Reveal>
      ))}
    </div>
  );
}
