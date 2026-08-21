"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { useStore } from "@/context/store-context";
import { AppImage } from "./app-image";
import { BagIcon, CheckIcon, HeartIcon, StarIcon } from "./icons";
import { categoryName, formatPrice, getProductImage, getProductVariants, productPrice, regularProductPrice, stockAvailable } from "@/lib/utils";
import { flyToCart } from "@/lib/fly-to-cart";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { addToCart, toggleWishlist, wishlist } = useStore();
  const variants = getProductVariants(product);
  const price = productPrice(product);
  const regular = regularProductPrice(product);
  const stock = stockAvailable(product);
  const wished = wishlist.includes(product.id);
  const hasOptions = variants.length > 0;
  const alternateImage = getProductImage(product, 1);
  const [added, setAdded] = useState(false);

  function add(event: React.MouseEvent<HTMLButtonElement>) {
    if (hasOptions) return;
    flyToCart(event.currentTarget.closest(".product-square-media") as HTMLElement | null);
    addToCart({
      productId: product.id,
      slug: product.slug || String(product.id),
      name: product.name,
      image: getProductImage(product),
      unitPrice: price,
      regularPrice: regular,
      quantity: 1,
      maxStock: stock,
      variantId: null,
      variantLabel: null,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  const discount = regular ? Math.round((1 - price / regular) * 100) : 0;

  return (
    <article className="product-card product-card-square group">
      <div className="product-image-wrap product-square-media">
        <Link href={`/product/${product.slug || product.id}`} className="product-square-image-link" aria-label={product.name}>
          <AppImage
            src={getProductImage(product)}
            alt={product.name}
            loading={priority ? "eager" : "lazy"}
            className="product-square-image"
          />
          {alternateImage ? (
            <AppImage
              src={alternateImage}
              alt=""
              loading="lazy"
              className="product-square-image-alt"
            />
          ) : null}
        </Link>

        <div className="product-square-vignette" aria-hidden="true" />

        <div className="absolute left-4 top-4 z-[3] flex flex-col gap-1.5">
          {discount > 0 ? <span className="product-badge sale">−{discount}%</span> : null}
          {product.is_featured ? <span className="product-badge">Curated</span> : null}
          {stock === 0 ? <span className="product-badge dark">Sold out</span> : null}
        </div>

        <button className={`wishlist-button ${wished ? "is-active" : ""}`} aria-label={wished ? "Remove from wishlist" : "Add to wishlist"} onClick={() => toggleWishlist(product.id)}><HeartIcon size={18} fill={wished ? "currentColor" : "none"}/></button>

        <div className="product-square-copy">
          <div className="product-square-meta-row">
            <span>{categoryName(product)}</span>
            {Number(product.average_rating || 0) > 0 ? <span className="product-square-rating"><StarIcon size={11} fill="currentColor" />{Number(product.average_rating).toFixed(1)}</span> : null}
          </div>
          <Link href={`/product/${product.slug || product.id}`} className="product-square-title">{product.name}</Link>
          <div className="product-square-price"><strong>{formatPrice(price)}</strong>{regular ? <span>{formatPrice(regular)}</span> : null}</div>
        </div>

        <div className="product-action-bar product-square-action-bar">
          {hasOptions ? (
            <Link href={`/product/${product.slug || product.id}`} className="product-action"><span>Choose options</span><BagIcon size={17}/></Link>
          ) : (
            <button className={`product-action ${added ? "is-added" : ""}`} onClick={add} disabled={stock === 0}><span>{stock === 0 ? "Unavailable" : added ? "Added" : "Add to Cart"}</span>{added ? <CheckIcon size={17}/> : <BagIcon size={17}/>}</button>
          )}
        </div>
      </div>
    </article>
  );
}
