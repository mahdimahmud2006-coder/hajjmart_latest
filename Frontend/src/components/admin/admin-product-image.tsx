"use client";

import { useEffect, useState } from "react";
import type { AdminProduct } from "@/lib/admin-types";

const FALLBACK = "/images/products/travel-kit.svg";

function normalizeImageUrl(value?: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  if (/^(https?:|data:|blob:)/i.test(candidate)) return candidate;
  if (candidate.startsWith("//")) return `https:${candidate}`;
  if (candidate.startsWith("/images/")) return candidate;

  const configuredApi = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
  let apiOrigin = "";
  try { apiOrigin = configuredApi ? new URL(configuredApi).origin : ""; } catch { apiOrigin = ""; }

  if (candidate.startsWith("/storage/")) return apiOrigin ? `${apiOrigin}${candidate}` : candidate;
  if (candidate.startsWith("storage/")) return apiOrigin ? `${apiOrigin}/${candidate}` : `/${candidate}`;
  if (candidate.startsWith("/")) return apiOrigin ? `${apiOrigin}${candidate}` : candidate;
  return apiOrigin ? `${apiOrigin}/storage/${candidate.replace(/^public\//, "")}` : candidate;
}

export function productImageUrl(product?: AdminProduct | null): string {
  if (!product) return FALLBACK;

  const legacyImages = Array.isArray(product.image_src)
    ? product.image_src
    : typeof product.image_src === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(product.image_src);
            return Array.isArray(parsed) ? parsed : [product.image_src];
          } catch { return [product.image_src]; }
        })()
      : [];

  const relation = product.product_images?.find((image) => image.is_primary) || product.product_images?.[0];
  const candidates = [
    product.primary_image_url,
    ...legacyImages,
    relation?.downloaded_url,
    relation?.source_url,
    relation?.url,
    relation?.path,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeImageUrl(candidate);
    if (normalized) return normalized;
  }
  return FALLBACK;
}

export function AdminProductImage({ product, alt, className }: { product?: AdminProduct | null; alt?: string; className?: string }) {
  const resolved = productImageUrl(product);
  const [src, setSrc] = useState(resolved);
  useEffect(() => setSrc(resolved), [resolved]);
  return <img className={className} src={src} alt={alt ?? product?.name ?? "Product"} loading="lazy" referrerPolicy="no-referrer" onError={() => setSrc(FALLBACK)}/>;
}
