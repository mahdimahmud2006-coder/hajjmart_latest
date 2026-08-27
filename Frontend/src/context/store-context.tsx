"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ToastMessage, type ToastTone } from "@/components/interaction-kit";
import type { CartItem, Product, ProductVariant, User } from "@/lib/types";

type Toast = {
  id: number;
  message: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
};

export type StoreCartItem = CartItem;

type StoreContextValue = {
  cart: StoreCartItem[];
  cartCount: number;
  cartSubtotal: number;
  cartOpen: boolean;
  wishlist: number[];
  token: string | null;
  user: User | null;
  hydrated: boolean;
  district: string;
  couponCode: string | null;
  couponDiscount: number;
  shippingTotal: number;
  grandTotal: number;
  addToCart: (product?: Product, variant?: ProductVariant | null, qty?: number) => void;
  removeFromCart: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
  toggleWishlist: (productId?: number) => void;
  setDistrict: (district: string) => void;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  notify: (
    message: string,
    tone?: ToastTone,
    options?: { actionLabel?: string; onAction?: () => void }
  ) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<StoreCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [district, setDistrictState] = useState<string>("Dhaka");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Toast notification callback
  const notify = useCallback(
    (
      message: string,
      tone: ToastTone = "success",
      options?: { actionLabel?: string; onAction?: () => void }
    ) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [
        ...current,
        { id, message, tone, actionLabel: options?.actionLabel, onAction: options?.onAction },
      ]);
      window.setTimeout(
        () => setToasts((current) => current.filter((item) => item.id !== id)),
        5000
      );
    },
    []
  );

  // Load saved state from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("hajjmart_cart");
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedWishlist = localStorage.getItem("hajjmart_wishlist");
      if (savedWishlist) setWishlist(JSON.parse(savedWishlist));

      const savedToken = localStorage.getItem("hajjmart_token");
      if (savedToken) setToken(savedToken);

      const savedUser = localStorage.getItem("hajjmart_user");
      if (savedUser) setUser(JSON.parse(savedUser));

      const savedDistrict = localStorage.getItem("hajjmart_district");
      if (savedDistrict) setDistrictState(savedDistrict);

      const savedCoupon = localStorage.getItem("hajjmart_coupon");
      if (savedCoupon) {
        const parsed = JSON.parse(savedCoupon);
        setCouponCode(parsed.code);
        setCouponDiscount(parsed.discount);
      }
    } catch {
      // Ignore storage errors
    } finally {
      setHydrated(true);
    }
  }, []);

  // Save cart to localStorage
  const saveCartState = (newCart: StoreCartItem[]) => {
    setCart(newCart);
    try {
      localStorage.setItem("hajjmart_cart", JSON.stringify(newCart));
    } catch {
      // Ignore storage errors
    }
  };

  // Add Item to Cart
  const addToCart = (product?: Product, variant?: ProductVariant | null, qty: number = 1) => {
    if (!product) return;

    const unitPrice = variant?.retail_price
      ? Number(variant.retail_price)
      : variant?.sale_price
      ? Number(variant.sale_price)
      : typeof product.retail_price === "number"
      ? product.retail_price
      : Number(product.retail_price || product.selling_price || 0);

    const regularPrice = variant?.regular_price
      ? Number(variant.regular_price)
      : product.regular_price
      ? Number(product.regular_price)
      : undefined;

    const itemKey = `${product.id}:${variant?.id || "base"}`;
    const existingIndex = cart.findIndex((item) => item.key === itemKey);

    if (existingIndex > -1) {
      const updated = cart.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + qty } : item
      );
      saveCartState(updated);
    } else {
      const variantLabel = variant
        ? typeof variant.attribute_values === "object" && variant.attribute_values
          ? Object.values(variant.attribute_values).join(" / ")
          : variant.sku || null
        : null;

      const newItem: StoreCartItem = {
        key: itemKey,
        productId: product.id,
        variantId: variant?.id || null,
        slug: product.slug,
        name: product.name,
        image: product.primary_image_url || product.image_src?.[0] || null,
        unitPrice,
        regularPrice,
        quantity: qty,
        maxStock: product.available_stock || 99,
        variantLabel,
      };

      saveCartState([...cart, newItem]);
    }
  };

  // Update Item Quantity
  const updateQuantity = (key: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    const updated = cart.map((item) =>
      item.key === key ? { ...item, quantity: newQuantity } : item
    );
    saveCartState(updated);
  };

  // Remove Item from Cart with 5-Second Undo Toast
  const removeFromCart = (key: string) => {
    const targetItem = cart.find((item) => item.key === key);
    if (!targetItem) return;

    const updated = cart.filter((item) => item.key !== key);
    saveCartState(updated);

    notify(`"${targetItem.name}" কার্ট থেকে সরানো হয়েছে।`, "neutral", {
      actionLabel: "পূর্বাবস্থায় ফেরান",
      onAction: () => {
        setCart((current) => [...current, targetItem]);
        try {
          localStorage.setItem("hajjmart_cart", JSON.stringify([...cart, targetItem]));
        } catch {
          // Ignore
        }
      },
    });
  };

  // Clear Cart
  const clearCart = () => {
    saveCartState([]);
    setCouponCode(null);
    setCouponDiscount(0);
    try {
      localStorage.removeItem("hajjmart_coupon");
    } catch {
      // Ignore
    }
  };

  // Wishlist Toggle
  const toggleWishlist = (productId?: number) => {
    if (!productId) return;
    let updated: number[];
    if (wishlist.includes(productId)) {
      updated = wishlist.filter((id) => id !== productId);
    } else {
      updated = [...wishlist, productId];
    }
    setWishlist(updated);
    try {
      localStorage.setItem("hajjmart_wishlist", JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  // District Setting
  const setDistrict = (dist: string) => {
    setDistrictState(dist);
    try {
      localStorage.setItem("hajjmart_district", dist);
    } catch {
      // Ignore
    }
  };

  // Apply Coupon Code
  const applyCoupon = (code: string): boolean => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return false;

    if (trimmed === "HAJJ2026" || trimmed === "EID2026") {
      const discount = 500;
      setCouponCode(trimmed);
      setCouponDiscount(discount);
      try {
        localStorage.setItem(
          "hajjmart_coupon",
          JSON.stringify({ code: trimmed, discount })
        );
      } catch {
        // Ignore
      }
      notify(`কুপন কোড "${trimmed}" সঠিকভাবে প্রয়োগ করা হয়েছে (-৳৫০০)!`, "success");
      return true;
    }

    notify(`" ${trimmed} " কুপন কোডটি সঠিক নয় বা মেয়ার্দোত্তীর্ণ।`, "error");
    return false;
  };

  const removeCoupon = () => {
    setCouponCode(null);
    setCouponDiscount(0);
    try {
      localStorage.removeItem("hajjmart_coupon");
    } catch {
      // Ignore
    }
    notify("কুপন সেশন সরানো হয়েছে।", "neutral");
  };

  // Session login / logout
  const setSession = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    try {
      localStorage.setItem("hajjmart_token", newToken);
      localStorage.setItem("hajjmart_user", JSON.stringify(newUser));
    } catch {
      // Ignore
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    try {
      localStorage.removeItem("hajjmart_token");
      localStorage.removeItem("hajjmart_user");
    } catch {
      // Ignore
    }
  };

  // Calculations
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cart.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0
  );
  const baseShipping = district.toLowerCase() === "dhaka" ? 70 : 130;
  const shippingTotal = cartSubtotal >= 3000 ? 0 : baseShipping;
  const grandTotal = Math.max(0, cartSubtotal - couponDiscount + shippingTotal);

  const value: StoreContextValue = {
    cart,
    cartCount,
    cartSubtotal,
    cartOpen,
    wishlist,
    token,
    user,
    hydrated,
    district,
    couponCode,
    couponDiscount,
    shippingTotal,
    grandTotal,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setCartOpen,
    toggleWishlist,
    setDistrict,
    applyCoupon,
    removeCoupon,
    setSession,
    logout,
    notify,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toasts.length > 0 ? (
        <div className="fixed bottom-20 sm:bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-auto max-w-sm w-full px-4">
          {toasts.map((toast) => (
            <ToastMessage
              key={toast.id}
              message={toast.message}
              tone={toast.tone}
              actionLabel={toast.actionLabel}
              onAction={toast.onAction}
              onDismiss={() =>
                setToasts((current) => current.filter((item) => item.id !== toast.id))
              }
            />
          ))}
        </div>
      ) : null}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
