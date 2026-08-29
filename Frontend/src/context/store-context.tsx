"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ToastMessage, type ToastTone } from "@/components/interaction-kit";
import type { CartItem, Product, ProductVariant, User } from "@/lib/types";
import { addWishlistProduct, getCustomerProfile, getNotifications, getWishlistProductIds, logoutCustomer, removeWishlistProduct } from "@/lib/api";

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
  unreadNotificationCount: number;
  token: string | null;
  user: User | null;
  hydrated: boolean;
  district: string;
  shippingTotal: number;
  grandTotal: number;
  addToCart: (product?: Product, variant?: ProductVariant | null, qty?: number, options?: { silent?: boolean }) => void;
  removeFromCart: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
  toggleWishlist: (productId?: number, productName?: string) => void;
  setDistrict: (district: string) => void;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  refreshNotificationCount: () => Promise<void>;
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
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [district, setDistrictState] = useState<string>("Dhaka");
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const wishlistSyncedToken = useRef<string | null>(null);

  // Toast notification callback
  const notify = useCallback(
    (
      message: string,
      tone: ToastTone = "success",
      options?: { actionLabel?: string; onAction?: () => void }
    ) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [
        { id, message, tone, actionLabel: options?.actionLabel, onAction: options?.onAction },
        ...current,
      ].slice(0, 3));
      window.setTimeout(
        () => setToasts((current) => current.filter((item) => item.id !== id)),
        4500
      );
    },
    []
  );

  // Load local state and validate any saved customer token against the backend.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const savedCart = localStorage.getItem("hajjmart_cart");
        if (savedCart) setCart(JSON.parse(savedCart));

        const savedDistrict = localStorage.getItem("hajjmart_district");
        if (savedDistrict) setDistrictState(savedDistrict);

        // Wishlists are account data. Remove the old browser-shared guest key.
        localStorage.removeItem("hajjmart_wishlist");
        localStorage.removeItem("hajjmart_coupon");

        const savedToken = localStorage.getItem("hajjmart_token");
        const savedUser = localStorage.getItem("hajjmart_user");

        // Old demo tokens were never real backend sessions and must not survive.
        if (!savedToken || savedToken.startsWith("demo_token_")) {
          setWishlist([]);
          setUnreadNotificationCount(0);
          localStorage.removeItem("hajjmart_token");
          localStorage.removeItem("hajjmart_user");
          return;
        }

        setToken(savedToken);
        if (savedUser) {
          try { setUser(JSON.parse(savedUser)); } catch { /* use server profile below */ }
        }

        try {
          const serverUser = await getCustomerProfile(savedToken);
          if (cancelled) return;
          setUser(serverUser);
          localStorage.setItem("hajjmart_user", JSON.stringify(serverUser));
        } catch {
          if (cancelled) return;
          setToken(null);
          setUser(null);
          setWishlist([]);
          setUnreadNotificationCount(0);
          localStorage.removeItem("hajjmart_token");
          localStorage.removeItem("hajjmart_user");
        }
      } catch {
        // Ignore storage errors, but never invent an authenticated session.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };

    void hydrate();
    return () => { cancelled = true; };
  }, []);

  // Wishlist is account-scoped: the backend is the only source of truth.
  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      setWishlist([]);
      wishlistSyncedToken.current = null;
      return;
    }
    if (wishlistSyncedToken.current === token) return;
    wishlistSyncedToken.current = token;

    void getWishlistProductIds(token)
      .then((serverIds) => {
        const uniqueIds = [...new Set(serverIds.map(Number).filter(Number.isFinite))];
        setWishlist(uniqueIds);
      })
      .catch(() => {
        setWishlist([]);
        wishlistSyncedToken.current = null;
      });
  }, [hydrated, token]);

  const refreshNotificationCount = useCallback(async () => {
    if (!token) {
      setUnreadNotificationCount(0);
      return;
    }
    try {
      const notifications = await getNotifications(token);
      setUnreadNotificationCount(notifications.filter((notification) => !notification.read).length);
    } catch {
      setUnreadNotificationCount(0);
    }
  }, [token]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshNotificationCount();
  }, [hydrated, refreshNotificationCount]);

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
  const addToCart = (product?: Product, variant?: ProductVariant | null, qty: number = 1, options?: { silent?: boolean }) => {
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

    if (!options?.silent) {
      notify(`“${product.name}” কার্টে যোগ করা হয়েছে।`, "success");
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

  // Remove Item from Cart
  const removeFromCart = (key: string) => {
    const item = cart.find((cartItem) => cartItem.key === key);
    if (!item) return;
    saveCartState(cart.filter((cartItem) => cartItem.key !== key));
    notify(`“${item.name}” কার্ট থেকে সরানো হয়েছে।`, "neutral");
  };

  // Clear Cart
  const clearCart = () => {
    saveCartState([]);
  };

  // Wishlist Toggle
  const toggleWishlist = (productId?: number, productName?: string) => {
    if (!productId) return;
    if (!token) {
      setWishlist([]);
      notify("পছন্দের তালিকা ব্যবহার করতে আগে লগইন করুন।", "neutral");
      return;
    }

    const wasSaved = wishlist.includes(productId);
    const updated = wasSaved
      ? wishlist.filter((id) => id !== productId)
      : [...new Set([...wishlist, productId])];

    setWishlist(updated);
    const wishlistLabel = productName ? `“${productName}”` : "পণ্যটি";
    notify(
      wasSaved
        ? `${wishlistLabel} পছন্দের তালিকা থেকে সরানো হয়েছে।`
        : `${wishlistLabel} পছন্দের তালিকায় যোগ করা হয়েছে।`,
      wasSaved ? "neutral" : "success"
    );

    const request = wasSaved
      ? removeWishlistProduct(productId, token)
      : addWishlistProduct(productId, token);

    void request.catch(() => {
      const rollback = wasSaved
        ? [...new Set([...updated, productId])]
        : updated.filter((id) => id !== productId);
      setWishlist(rollback);
      notify("পছন্দের তালিকা আপডেট করা যায়নি। আবার চেষ্টা করুন।", "error");
    });
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

  // Session login / logout
  const setSession = (newToken: string, newUser: User) => {
    setWishlist([]);
    setUnreadNotificationCount(0);
    setToken(newToken);
    setUser(newUser);
    wishlistSyncedToken.current = null;
    try {
      localStorage.setItem("hajjmart_token", newToken);
      localStorage.setItem("hajjmart_user", JSON.stringify(newUser));
    } catch {
      // Ignore
    }
  };

  const logout = () => {
    const activeToken = token;
    if (activeToken) void logoutCustomer(activeToken).catch(() => undefined);

    setToken(null);
    setUser(null);
    setWishlist([]);
    setUnreadNotificationCount(0);
    wishlistSyncedToken.current = null;
    try {
      localStorage.removeItem("hajjmart_token");
      localStorage.removeItem("hajjmart_user");
      localStorage.removeItem("hajjmart_wishlist");
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
  const shippingTotal = baseShipping;
  const grandTotal = Math.max(0, cartSubtotal + shippingTotal);

  const value: StoreContextValue = {
    cart,
    cartCount,
    cartSubtotal,
    cartOpen,
    wishlist,
    unreadNotificationCount,
    token,
    user,
    hydrated,
    district,
    shippingTotal,
    grandTotal,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setCartOpen,
    toggleWishlist,
    setDistrict,
    setSession,
    logout,
    refreshNotificationCount,
    notify,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toasts.length > 0 ? (
        <div className="store-toast-viewport" aria-live="polite" aria-atomic="false">
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
