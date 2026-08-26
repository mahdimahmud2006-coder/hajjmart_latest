"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CartItem, User } from "@/lib/types";
import { clientApi } from "@/lib/api";
import { localizedField } from "@/lib/i18n";
import { ToastMessage, type ToastTone } from "@/components/interaction-kit";
import { useOverlayPrimitive } from "@/components/overlay-primitive";
import { CloseIcon } from "@/components/icons";
import { Lang } from "@/components/lang";

type Toast = { id: number; message: string; tone?: ToastTone; actionLabel?: string; onAction?: () => void };
type CartMergePrompt = { device: CartItem[]; account: CartItem[] };
type CloudCart = { items: CartItem[] };
type WishlistRow = { product_id: number };

type StoreContextValue = {
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  cartOpen: boolean;
  wishlist: number[];
  token: string | null;
  user: User | null;
  hydrated: boolean;
  addToCart: (item: Omit<CartItem, "key">) => void;
  removeFromCart: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
  toggleWishlist: (productId: number) => void;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  notify: (message: string, tone?: Toast["tone"], options?: { actionLabel?: string; onAction?: () => void }) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);
const CART_KEY = "hajjmart-cart-v1";
const WISHLIST_KEY = "hajjmart-wishlist-v1";
const AUTH_KEY = "hajjmart-auth-v1";
const SESSION_REFRESH_AFTER_MS = 10.5 * 60 * 60 * 1000;

function cartSignature(items: CartItem[]): string {
  return JSON.stringify(items.map((item) => [item.key, item.quantity]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

function cartPayload(items: CartItem[]) {
  return items.map((item) => ({
    product_id: item.productId,
    variant_id: item.variantId || null,
    quantity: item.quantity,
  }));
}

function CartMergeDialog({ prompt, busy, onMerge, onUseAccount, onClose }: {
  prompt: CartMergePrompt;
  busy: boolean;
  onMerge: () => void;
  onUseAccount: () => void;
  onClose: () => void;
}) {
  const panelRef = useOverlayPrimitive(true, onClose);
  const deviceCount = prompt.device.reduce((sum, item) => sum + item.quantity, 0);
  const accountCount = prompt.account.reduce((sum, item) => sum + item.quantity, 0);
  return <div className="store-modal" role="presentation">
    <button type="button" className="store-modal-backdrop" onClick={onClose} aria-label="Close cart merge prompt"/>
    <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cart-merge-title" className="store-modal-panel">
      <button type="button" className="store-modal-close icon-button" onClick={onClose} aria-label="Close"><CloseIcon size={18}/></button>
      <p className="eyebrow"><Lang bn="আপনার প্রস্তুতির তালিকা একসাথে রাখুন" en="Keep your preparation together"/></p>
      <h2 id="cart-merge-title" className="mt-2 font-serif text-3xl"><Lang bn="এই ডিভাইস ও আপনার অ্যাকাউন্ট—দুই জায়গাতেই পণ্য আছে।" en="You have items on this device and in your account."/></h2>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]"><span className="lang-bn">এই ডিভাইসে {deviceCount}টি পণ্য এবং আপনার অ্যাকাউন্টে {accountCount}টি পণ্য আছে। কিছু হারিয়ে না যেতে দুই কার্ট একত্র করুন, অথবা শুধু অ্যাকাউন্টের কার্ট ব্যবহার করুন।</span><span className="lang-en">This device has {deviceCount} {deviceCount === 1 ? "item" : "items"}; your account has {accountCount}. Merge them so nothing is lost, or continue with the account cart only.</span></p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" className="button-primary" disabled={busy} onClick={onMerge}>{busy ? <Lang bn="একত্র করা হচ্ছে…" en="Merging…"/> : <Lang bn="দুই কার্ট একত্র করুন" en="Merge both carts"/>}</button>
        <button type="button" className="button-quiet" disabled={busy} onClick={onUseAccount}><Lang bn="অ্যাকাউন্টের কার্ট ব্যবহার করুন" en="Use account cart"/></button>
      </div>
    </section>
  </div>;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [accountStateReady, setAccountStateReady] = useState(false);
  const [sessionIssuedAt, setSessionIssuedAt] = useState(0);
  const [mergePrompt, setMergePrompt] = useState<CartMergePrompt | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const cartRef = useRef<CartItem[]>([]);
  const wishlistRef = useRef<number[]>([]);
  const accountLoadSequence = useRef(0);
  const cloudSyncSequence = useRef(0);
  const refreshingSession = useRef(false);

  useEffect(() => { cartRef.current = cart; }, [cart]);
  useEffect(() => { wishlistRef.current = wishlist; }, [wishlist]);

  useEffect(() => {
    try {
      const storedCart = localStorage.getItem(CART_KEY);
      const storedWishlist = localStorage.getItem(WISHLIST_KEY);
      const storedAuth = localStorage.getItem(AUTH_KEY);
      const nextCart = storedCart ? JSON.parse(storedCart) as CartItem[] : [];
      const nextWishlist = storedWishlist ? JSON.parse(storedWishlist) as number[] : [];
      const nextAuth = storedAuth ? JSON.parse(storedAuth) as { token: string; user: User; issuedAt?: number } : null;
      cartRef.current = nextCart;
      wishlistRef.current = nextWishlist;
      window.queueMicrotask(() => {
        setCart(nextCart);
        setWishlist(nextWishlist);
        if (nextAuth) {
          setToken(nextAuth.token);
          setUser(nextAuth.user);
          setSessionIssuedAt(Number(nextAuth.issuedAt) || Date.now());
        }
      });
    } catch {
      localStorage.removeItem(CART_KEY);
      localStorage.removeItem(WISHLIST_KEY);
      localStorage.removeItem(AUTH_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  }, [wishlist, hydrated]);

  const notify = useCallback((message: string, tone: Toast["tone"] = "success", options?: { actionLabel?: string; onAction?: () => void }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, tone, ...options }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3600);
  }, []);

  const syncCloudCart = useCallback(async (nextCart: CartItem[], mode: "replace" | "merge" = "replace", sessionToken = token) => {
    if (!sessionToken) return nextCart;
    const response = await clientApi<CloudCart>("/cart", {
      method: "PUT",
      body: JSON.stringify({ mode, items: cartPayload(nextCart) }),
    }, sessionToken);
    return response.data.items || [];
  }, [token]);

  useEffect(() => {
    if (!hydrated || !token) {
      setAccountStateReady(false);
      setMergePrompt(null);
      return;
    }

    const sequence = ++accountLoadSequence.current;
    setAccountStateReady(false);
    setMergePrompt(null);
    const deviceCart = cartRef.current;
    const deviceWishlist = wishlistRef.current;

    void Promise.all([
      clientApi<CloudCart>("/cart", {}, token),
      clientApi<WishlistRow[]>("/wishlist", {}, token),
    ]).then(async ([cartResponse, wishlistResponse]) => {
      if (sequence !== accountLoadSequence.current) return;
      const accountCart = cartResponse.data.items || [];
      const accountWishlist = Array.isArray(wishlistResponse.data) ? wishlistResponse.data.map((row) => Number(row.product_id)).filter(Boolean) : [];
      const mergedWishlist = Array.from(new Set([...accountWishlist, ...deviceWishlist]));
      setWishlist(mergedWishlist);
      const missingWishlist = deviceWishlist.filter((id) => !accountWishlist.includes(id));
      if (missingWishlist.length) {
        void Promise.allSettled(missingWishlist.map((id) => clientApi(`/wishlist/${id}`, { method: "POST", body: JSON.stringify({}) }, token)));
      }

      if (deviceCart.length && accountCart.length && cartSignature(deviceCart) !== cartSignature(accountCart)) {
        setMergePrompt({ device: deviceCart, account: accountCart });
        return;
      }

      if (deviceCart.length && !accountCart.length) {
        const synchronized = await syncCloudCart(deviceCart, "replace", token);
        if (sequence !== accountLoadSequence.current) return;
        setCart(synchronized);
      } else {
        setCart(accountCart);
      }
      setAccountStateReady(true);
    }).catch(() => {
      if (sequence !== accountLoadSequence.current) return;
      setAccountStateReady(true);
      notify(localizedField("অ্যাকাউন্টের তথ্য সিঙ্ক করা যায়নি। এই ডিভাইসের তথ্য এখনো আছে।", "Your account could not be synchronized. Device data is still available."), "error");
    });
  }, [hydrated, token, notify, syncCloudCart]);

  useEffect(() => {
    if (!token || !accountStateReady || mergePrompt) return;
    const sequence = ++cloudSyncSequence.current;
    const timer = window.setTimeout(() => {
      void syncCloudCart(cart, "replace", token).then((serverCart) => {
        if (sequence !== cloudSyncSequence.current) return;
        if (cartSignature(serverCart) !== cartSignature(cart) || JSON.stringify(serverCart) !== JSON.stringify(cart)) {
          setCart(serverCart);
        }
      }).catch(() => notify(localizedField("আপনার কার্ট এই ডিভাইসে সংরক্ষিত আছে; পরের পরিবর্তনের পর অ্যাকাউন্ট সিঙ্ক আবার চেষ্টা করবে।", "Your bag is saved on this device; account sync will retry after the next change."), "error"));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [cart, token, accountStateReady, mergePrompt, syncCloudCart, notify]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_KEY) return;
      if (!event.newValue) {
        accountLoadSequence.current += 1;
        setToken(null);
        setUser(null);
        setSessionIssuedAt(0);
        setCart([]);
        setWishlist([]);
        setAccountStateReady(false);
        setMergePrompt(null);
        return;
      }
      try {
        const next = JSON.parse(event.newValue) as { token: string; user: User; issuedAt?: number };
        if (!next.token || !next.user) return;
        setToken(next.token);
        setUser(next.user);
        setSessionIssuedAt(Number(next.issuedAt) || Date.now());
      } catch {
        // Ignore malformed values written by unrelated scripts/extensions.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!token || !sessionIssuedAt) return;
    const refreshIfNeeded = async () => {
      if (refreshingSession.current || Date.now() - sessionIssuedAt < SESSION_REFRESH_AFTER_MS) return;
      refreshingSession.current = true;
      try {
        const response = await clientApi<{ token: string; user: User }>("/auth/refresh", { method: "POST", body: JSON.stringify({}) }, token);
        const issuedAt = Date.now();
        setToken(response.data.token);
        setUser(response.data.user);
        setSessionIssuedAt(issuedAt);
        localStorage.setItem(AUTH_KEY, JSON.stringify({ token: response.data.token, user: response.data.user, issuedAt }));
      } catch (reason) {
        if ((reason as { status?: number }).status === 401) {
          setToken(null);
          setUser(null);
          setSessionIssuedAt(0);
          localStorage.removeItem(AUTH_KEY);
          notify(localizedField("আপনার সেশন শেষ হয়েছে। আবার লগইন করুন।", "Your session expired. Please sign in again."), "neutral");
        }
      } finally {
        refreshingSession.current = false;
      }
    };
    void refreshIfNeeded();
    const interval = window.setInterval(() => void refreshIfNeeded(), 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [token, sessionIssuedAt, notify]);

  const resolveMerge = useCallback(async () => {
    if (!mergePrompt || !token) return;
    setMergeBusy(true);
    try {
      const merged = await syncCloudCart(mergePrompt.device, "merge", token);
      setCart(merged);
      setMergePrompt(null);
      setAccountStateReady(true);
      notify(localizedField("এই ডিভাইস ও অ্যাকাউন্টের কার্ট একত্র হয়েছে।", "Your device and account carts were merged."));
    } catch (error) {
      notify(error instanceof Error ? error.message : localizedField("কার্ট দুটি একত্র করা যায়নি।", "We could not merge the carts."), "error");
    } finally {
      setMergeBusy(false);
    }
  }, [mergePrompt, token, syncCloudCart, notify]);

  const useAccountCart = useCallback(() => {
    if (!mergePrompt) return;
    setCart(mergePrompt.account);
    setMergePrompt(null);
    setAccountStateReady(true);
    notify(localizedField("আপনার অ্যাকাউন্টে সংরক্ষিত কার্ট ব্যবহার করা হচ্ছে।", "Using the cart saved to your account."), "neutral");
  }, [mergePrompt, notify]);

  const keepDeviceCartForNow = useCallback(() => {
    setMergePrompt(null);
    setAccountStateReady(false);
    notify(localizedField("আবার লগইন না করা পর্যন্ত অ্যাকাউন্ট কার্ট সিঙ্ক বন্ধ থাকবে।", "Account cart sync is paused until you sign in again."), "neutral");
  }, [notify]);

  const addToCart = useCallback((item: Omit<CartItem, "key">) => {
    const key = `${item.productId}:${item.variantId || "base"}`;
    const maxStock = Math.max(0, item.maxStock || 0);
    const existing = cartRef.current.find((line) => line.key === key);
    const requested = (existing?.quantity || 0) + item.quantity;
    const ceiling = maxStock || 99;
    const nextQuantity = Math.min(requested, ceiling);

    setCart((current) => {
      const found = current.find((line) => line.key === key);
      if (found) return current.map((line) => line.key === key ? { ...line, ...item, key, quantity: nextQuantity } : line);
      return [...current, { ...item, key, quantity: Math.min(item.quantity, ceiling) }];
    });
    setCartOpen(true);
    if (requested > ceiling) {
      notify(localizedField(`এখন মাত্র ${ceiling}টি পাওয়া যাচ্ছে।`, `Only ${ceiling} ${ceiling === 1 ? "piece is" : "pieces are"} currently available.`), "neutral", { actionLabel: localizedField("কার্ট দেখুন", "View bag"), onAction: () => setCartOpen(true) });
    } else {
      notify(localizedField(`${localizedField(item.name_bn, item.name)} কার্টে যোগ হয়েছে।`, `${item.name} added to your bag.`), "success", { actionLabel: localizedField("কার্ট দেখুন", "View bag"), onAction: () => setCartOpen(true) });
    }
  }, [notify]);

  const removeFromCart = useCallback((key: string) => {
    const removed = cartRef.current.find((item) => item.key === key);
    setCart((current) => current.filter((item) => item.key !== key));
    if (removed) {
      notify(localizedField(`${localizedField(removed.name_bn, removed.name)} কার্ট থেকে সরানো হয়েছে।`, `${removed.name} removed from your bag.`), "neutral", {
        actionLabel: localizedField("ফিরিয়ে আনুন", "Undo"),
        onAction: () => setCart((current) => current.some((item) => item.key === removed.key) ? current : [...current, removed]),
      });
    }
  }, [notify]);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    const currentItem = cartRef.current.find((item) => item.key === key);
    if (!currentItem) return;
    if (quantity < 1) {
      removeFromCart(key);
      return;
    }
    const ceiling = Math.max(1, currentItem.maxStock || 99);
    if (quantity > ceiling) notify(localizedField(`এখন মাত্র ${ceiling}টি পাওয়া যাচ্ছে।`, `Only ${ceiling} ${ceiling === 1 ? "piece is" : "pieces are"} currently available.`), "neutral");
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity: Math.min(quantity, ceiling) } : item));
  }, [removeFromCart, notify]);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWishlist = useCallback((productId: number) => {
    const removing = wishlistRef.current.includes(productId);
    setWishlist((current) => removing ? current.filter((id) => id !== productId) : [...current, productId]);
    if (!token) return;
    void clientApi(`/wishlist/${productId}`, {
      method: removing ? "DELETE" : "POST",
      ...(removing ? {} : { body: JSON.stringify({}) }),
    }, token).catch(() => {
      setWishlist((current) => removing ? Array.from(new Set([...current, productId])) : current.filter((id) => id !== productId));
      notify(localizedField("পছন্দের তালিকা সিঙ্ক করা যায়নি। আগের সংরক্ষিত অবস্থা ফিরিয়ে দেওয়া হয়েছে।", "Wishlist sync failed. Your previous saved state was restored."), "error");
    });
  }, [token, notify]);

  const setSession = useCallback((nextToken: string, nextUser: User) => {
    const issuedAt = Date.now();
    setToken(nextToken);
    setUser(nextUser);
    setSessionIssuedAt(issuedAt);
    setAccountStateReady(false);
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token: nextToken, user: nextUser, issuedAt }));
  }, []);

  const logout = useCallback(() => {
    const previousToken = token;
    accountLoadSequence.current += 1;
    setToken(null);
    setUser(null);
    setSessionIssuedAt(0);
    setCart([]);
    setWishlist([]);
    setAccountStateReady(false);
    setMergePrompt(null);
    localStorage.removeItem(AUTH_KEY);
    if (previousToken) void clientApi("/auth/logout", { method: "POST", body: JSON.stringify({}) }, previousToken).catch(() => undefined);
    notify(localizedField("আপনি লগআউট হয়েছেন।", "You have been signed out."), "neutral");
  }, [token, notify]);

  const value = useMemo<StoreContextValue>(() => ({
    cart,
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    cartSubtotal: cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    cartOpen,
    wishlist,
    token,
    user,
    hydrated,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setCartOpen,
    toggleWishlist,
    setSession,
    logout,
    notify,
  }), [cart, cartOpen, wishlist, token, user, hydrated, addToCart, removeFromCart, updateQuantity, clearCart, toggleWishlist, setSession, logout, notify]);

  return (
    <StoreContext.Provider value={value}>
      {children}
      {mergePrompt ? <CartMergeDialog prompt={mergePrompt} busy={mergeBusy} onMerge={resolveMerge} onUseAccount={useAccountCart} onClose={keepDeviceCartForNow}/> : null}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <ToastMessage
            key={toast.id}
            message={toast.message}
            tone={toast.tone}
            actionLabel={toast.actionLabel}
            onAction={toast.onAction ? () => { toast.onAction?.(); setToasts((current) => current.filter((item) => item.id !== toast.id)); } : undefined}
            onDismiss={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
          />
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
