"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useStore } from "@/context/store-context";
import { clientApi } from "@/lib/api";
import { ArrowRightIcon, BagIcon, HeartIcon, MapPinIcon, PackageIcon, UserIcon, TrendingUpIcon } from "./icons";
import { formatPrice } from "@/lib/utils";
import { EmptyState, InlineConfirm, Skeleton } from "./interaction-kit";
import { RecentlyViewedRail } from "./recently-viewed-rail";
import { Lang, localizedMessage } from "./lang";
import { useLanguage } from "./use-language";
import { banglaFallback, banglaPlaceName } from "@/lib/i18n";

type Order = { id: number; order_number?: string; order_id?: string; status?: string; grand_total?: number | string; total?: number | string; created_at?: string; items?: unknown[] };
type Address = { id: number; label?: string | null; recipient_name: string; phone: string; email?: string | null; full_address: string; district: string; upazila?: string | null; area?: string | null; landmark?: string | null; is_default?: boolean };
type CheckoutOptions = { districts?: string[] };
type OrderListPayload = Order[] | { data?: Order[] };

function orderRows(payload: OrderListPayload | null | undefined): Order[] {
  if (!payload) return [];
  return Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : [];
}

const ORDER_STATUS: Record<string, { bn: string; en: string }> = {
  pending: { bn: "অপেক্ষমাণ", en: "Pending" },
  confirmed: { bn: "নিশ্চিত", en: "Confirmed" },
  processing: { bn: "প্রসেসিং", en: "Processing" },
  shipped: { bn: "পাঠানো হয়েছে", en: "Shipped" },
  delivered: { bn: "ডেলিভারড", en: "Delivered" },
  cancelled: { bn: "বাতিল", en: "Cancelled" },
};

function OrderStatus({ status }: { status?: string }) {
  const value = (status || "processing").toLowerCase();
  const copy = ORDER_STATUS[value];
  return copy ? <Lang bn={copy.bn} en={copy.en}/> : <Lang bn={banglaFallback(value.replaceAll("_", " "))} en={value.replaceAll("_", " ")}/>;
}

type TabId = 'overview' | 'orders' | 'track' | 'wishlist' | 'addresses' | 'place-order';

interface AccountTab {
  id: TabId;
  label: ReactNode;
  icon: ReactNode;
  badge?: number | null;
}

export function AccountDashboard() {
  const { token, user, hydrated, logout, wishlist, notify } = useStore();
  const language = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [deleteAddressId, setDeleteAddressId] = useState<number | null>(null);
  const [searchOrderId, setSearchOrderId] = useState("");
  const [searchedOrders, setSearchedOrders] = useState<Order[]>([]);
  const [hasSearchedOrders, setHasSearchedOrders] = useState(false);
  const [accountDataError, setAccountDataError] = useState("");

  // FIX: Fetch districts on component mount (not on every token change)
  useEffect(() => {
    clientApi<CheckoutOptions>("/checkout/options")
      .then((response) => setDistricts(response.data.districts || []))
      .catch(() => console.error("Failed to load districts"));
  }, []);

  // Load account resources once per authenticated session. The orders endpoint is
  // paginated, so unwrap its nested data array instead of treating it as a plain array.
  useEffect(() => {
    if (!token) {
      setOrders([]);
      setAddresses([]);
      setOrdersLoading(false);
      setAddressesLoading(false);
      setAccountDataError("");
      return;
    }

    const controller = new AbortController();

    const loadAccountData = async () => {
      setOrdersLoading(true);
      setAddressesLoading(true);
      setAccountDataError("");

      const [ordersResult, addressesResult] = await Promise.allSettled([
        clientApi<OrderListPayload>("/orders?per_page=20", { signal: controller.signal }, token),
        clientApi<Address[]>("/addresses", { signal: controller.signal }, token),
      ]);

      if (controller.signal.aborted) return;

      if (ordersResult.status === "fulfilled") {
        setOrders(orderRows(ordersResult.value.data));
      } else {
        setOrders([]);
        setAccountDataError(localizedMessage("অ্যাকাউন্টের কিছু তথ্য লোড করা যায়নি। রিফ্রেশ করে আবার চেষ্টা করুন।", "Some account information could not be loaded. Please refresh and try again."));
      }

      if (addressesResult.status === "fulfilled") {
        setAddresses(Array.isArray(addressesResult.value.data) ? addressesResult.value.data : []);
      } else {
        setAddresses([]);
        setAccountDataError(localizedMessage("অ্যাকাউন্টের কিছু তথ্য লোড করা যায়নি। রিফ্রেশ করে আবার চেষ্টা করুন।", "Some account information could not be loaded. Please refresh and try again."));
      }

      setOrdersLoading(false);
      setAddressesLoading(false);
    };

    void loadAccountData();
    return () => controller.abort();
  }, [token]);

  // Preserve deep links such as /account#orders from the existing order-detail page.
  useEffect(() => {
    const syncTabFromHash = () => {
      const hash = window.location.hash.replace("#", "") as TabId;
      if (["overview", "orders", "track", "wishlist", "addresses", "place-order"].includes(hash)) {
        setActiveTab(hash);
      }
    };
    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);

  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    setAddressSaving(true);
    setAddressError("");
    try {
      const response = await clientApi<Address>("/addresses", {
        method: "POST",
        body: JSON.stringify({
          label: String(form.get("label") || "Home").trim() || "Home",
          recipient_name: String(form.get("recipient_name") || ""),
          phone: String(form.get("phone") || ""),
          email: user?.email || null,
          district: String(form.get("district") || ""),
          upazila: String(form.get("upazila") || "").trim() || null,
          full_address: String(form.get("full_address") || ""),
          is_default: Boolean(form.get("is_default")),
        }),
      }, token);
      setAddresses((current) => response.data.is_default ? [response.data, ...current.map((item) => ({ ...item, is_default: false }))] : [response.data, ...current]);
      setAddressFormOpen(false);
      notify(localizedMessage("ডেলিভারি ঠিকানা সংরক্ষণ করা হয়েছে।", "Delivery address saved."));
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : localizedMessage("এই ঠিকানাটি সংরক্ষণ করা যায়নি।", "Could not save this address."));
    } finally {
      setAddressSaving(false);
    }
  }

  async function makeDefault(address: Address) {
    if (!token || address.is_default) return;
    try {
      const response = await clientApi<Address>(`/addresses/${address.id}`, { method: "PUT", body: JSON.stringify({ is_default: true }) }, token);
      setAddresses((current) => current.map((item) => ({ ...item, is_default: item.id === response.data.id })));
      notify(localizedMessage("ডিফল্ট ডেলিভারি ঠিকানা আপডেট হয়েছে।", "Default delivery address updated."));
    } catch (error) {
      notify(error instanceof Error ? error.message : localizedMessage("ডিফল্ট ঠিকানা আপডেট করা যায়নি।", "Could not update the default address."), "error");
    }
  }

  async function removeAddress(addressId: number) {
    if (!token) return;
    try {
      await clientApi(`/addresses/${addressId}`, { method: "DELETE" }, token);
      setAddresses((current) => current.filter((item) => item.id !== addressId));
      setDeleteAddressId(null);
      notify(localizedMessage("ঠিকানাটি সরানো হয়েছে।", "Address removed."), "neutral");
    } catch (error) {
      notify(error instanceof Error ? error.message : localizedMessage("এই ঠিকানাটি সরানো যায়নি।", "Could not remove this address."), "error");
    }
  }

  function handleSearchOrders(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchOrderId.trim().replace(/^#/, "").toLowerCase();
    setHasSearchedOrders(true);
    if (!query) {
      setSearchedOrders([]);
      return;
    }
    setSearchedOrders(orders.filter((order) => {
      const orderNum = (order.order_number || order.order_id || String(order.id)).toLowerCase();
      return orderNum.includes(query);
    }));
  }

  function selectTab(tab: TabId) {
    // Avoid scheduling redundant state updates when the active tab is clicked again.
    // This is not the root cause of the previous render loop (RecentlyViewedRail was),
    // but keeping the handler idempotent makes tab interactions resilient.
    setActiveTab((current) => current === tab ? current : tab);
    setHasSearchedOrders((current) => current ? false : current);
    const nextHash = `#${tab}`;
    if (window.location.hash !== nextHash) window.history.replaceState(null, "", nextHash);
  }

  function selectRecentOrder(order: Order) {
    const number = order.order_number || order.order_id || String(order.id);
    setSearchOrderId(String(number).replace(/^#/, ""));
    setSearchedOrders([order]);
    setHasSearchedOrders(true);
  }

  async function refreshOrderStatuses() {
    if (!token) return;
    setOrdersLoading(true);
    try {
      const response = await clientApi<OrderListPayload>("/orders?per_page=20", {}, token);
      const nextOrders = orderRows(response.data);
      setOrders(nextOrders);
      if (hasSearchedOrders && searchOrderId.trim()) {
        const query = searchOrderId.trim().replace(/^#/, "").toLowerCase();
        setSearchedOrders(nextOrders.filter((order) => {
          const number = (order.order_number || order.order_id || String(order.id)).toLowerCase();
          return number.includes(query);
        }));
      }
      notify(localizedMessage("অর্ডারের অবস্থা রিফ্রেশ হয়েছে।", "Order statuses refreshed."), "neutral");
    } catch (error) {
      notify(error instanceof Error ? error.message : localizedMessage("অর্ডারের অবস্থা রিফ্রেশ করা যায়নি।", "Could not refresh order statuses."), "error");
    } finally {
      setOrdersLoading(false);
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    const nextTab = tabs[nextIndex];
    selectTab(nextTab.id);
    window.requestAnimationFrame(() => document.getElementById(`account-tab-${nextTab.id}`)?.focus());
  }

  const tabs: AccountTab[] = [
    { id: 'overview', label: <Lang bn="সারসংক্ষেপ" en="Overview"/>, icon: <UserIcon size={18} /> },
    { id: 'orders', label: <Lang bn="অর্ডার" en="Orders"/>, icon: <PackageIcon size={18} />, badge: orders.length },
    { id: 'track', label: <Lang bn="অর্ডার ট্র্যাক করুন" en="Track Order"/>, icon: <TrendingUpIcon size={18} /> },
    { id: 'wishlist', label: <Lang bn="পছন্দের তালিকা" en="Wishlist"/>, icon: <HeartIcon size={18} />, badge: wishlist.length },
    { id: 'addresses', label: <Lang bn="ঠিকানা" en="Addresses"/>, icon: <MapPinIcon size={18} /> },
    { id: 'place-order', label: <Lang bn="কেনাকাটা করুন" en="Place Order"/>, icon: <BagIcon size={18} /> },
  ];

  if (!hydrated) return <Skeleton className="min-h-[500px] rounded-[2rem] bg-white" />;
  if (!token || !user) return (
    <div className="rounded-[2rem] bg-white px-6 py-16 text-center">
      <UserIcon size={38} className="mx-auto text-[var(--gold)]" />
      <h2 className="mt-5 font-serif text-4xl"><Lang bn="আপনার হজমার্ট অ্যাকাউন্ট ব্যক্তিগত।" en="Your HajjMart account is private."/></h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]"><Lang bn="অর্ডারের ইতিহাস, সংরক্ষিত পণ্য ও গ্রাহকের তথ্য দেখতে সাইন ইন করুন।" en="Sign in to view order history, saved items and customer details."/></p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/login" className="button-primary"><Lang bn="সাইন ইন" en="Sign in"/></Link>
        <Link href="/register" className="button-quiet"><Lang bn="অ্যাকাউন্ট তৈরি করুন" en="Create account"/></Link>
      </div>
    </div>
  );

  return (
    <div className="account-dashboard grid gap-7 lg:grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <aside className="account-sidebar h-fit overflow-hidden rounded-[1.5rem] bg-[var(--forest)] text-white lg:sticky lg:top-40">
        <div className="account-profile p-6">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white/10 font-serif text-2xl">{(language === "bn" ? user.name_bn || user.name : user.name).charAt(0).toUpperCase()}</div>
          <h2 className="mt-4 font-serif text-2xl"><Lang bn={user.name_bn} en={user.name}/></h2>
          <p className="mt-1 text-xs text-white/50">{user.email}</p>
        </div>
        <nav className="account-tab-list border-t border-white/10 p-3" role="tablist" aria-label="Account sections / অ্যাকাউন্ট বিভাগ">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`account-panel-${tab.id}`}
              id={`account-tab-${tab.id}`}
              className={`account-nav ${activeTab === tab.id ? 'active' : ''} w-full`}
            >
              {tab.icon}
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className="ml-2 rounded-full bg-[var(--gold)] px-2 py-0.5 text-xs font-bold text-[var(--forest)]">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button onClick={logout} className="m-3 mt-0 w-[calc(100%-1.5rem)] rounded-xl border border-white/15 px-4 py-3 text-left text-sm text-white/65 transition hover:bg-white/8 hover:text-white">
          <Lang bn="সাইন আউট" en="Sign out"/>
        </button>
      </aside>

      {/* Main Content */}
      <div className="account-main space-y-7">
        {accountDataError ? <div className="account-data-warning" role="status">{language === "bn" ? "অ্যাকাউন্টের তথ্য লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।" : accountDataError}</div> : null}
        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <section id="account-panel-overview" role="tabpanel" aria-labelledby="account-tab-overview" className="account-tab-content rounded-[1.5rem] bg-white p-6 sm:p-8">
            <p className="eyebrow"><Lang bn="অ্যাকাউন্ট সারসংক্ষেপ" en="Account overview"/></p>
            <h1 className="mt-2 font-serif text-4xl"><Lang bn={<>আসসালামু আলাইকুম, {(user.name_bn || user.name).split(" ")[0]}।</>} en={<>Assalamu Alaikum, {user.name.split(" ")[0]}.</>}/></h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]"><Lang bn="আপনার অর্ডার, সংরক্ষিত পণ্য ও ডেলিভারির তথ্য এখানে থাকবে।" en="Your order details, saved pieces and delivery information live here."/></p>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <div className="account-stat">
                <PackageIcon />
                <strong>{orders.length}</strong>
                <span><Lang bn="মোট অর্ডার" en="Total orders"/></span>
              </div>
              <div className="account-stat">
                <HeartIcon />
                <strong>{wishlist.length}</strong>
                <span><Lang bn="সংরক্ষিত পণ্য" en="Saved items"/></span>
              </div>
              <div className="account-stat">
                <BagIcon />
                <strong>{orders.filter((order) => !["delivered", "cancelled"].includes(order.status || "")).length}</strong>
                <span><Lang bn="সক্রিয় অর্ডার" en="Active orders"/></span>
              </div>
            </div>
          </section>
        )}

        {/* Tab: Orders */}
        {activeTab === 'orders' && (
          <section id="account-panel-orders" role="tabpanel" aria-labelledby="account-tab-orders" className="account-tab-content rounded-[1.5rem] bg-white p-6 sm:p-8">
            <div className="flex items-end justify-between flex-wrap gap-4">
              <div>
                <p className="eyebrow"><Lang bn="অর্ডারের ইতিহাস" en="Order history"/></p>
                <h2 className="mt-2 font-serif text-3xl"><Lang bn="আপনার অর্ডার" en="Your orders"/></h2>
              </div>
              <Link href="/shop" className="text-link"><Lang bn="আবার কিনুন" en="Shop again"/><ArrowRightIcon size={15} /></Link>
            </div>
            {ordersLoading ? (
              <div className="mt-7 space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-xl" />)}</div>
            ) : orders.length ? (
              <div className="mt-6 overflow-hidden rounded-xl border border-black/8">
                {orders.map((order) => {
                  const number = order.order_number || order.order_id || String(order.id);
                  return (
                    <Link
                      href={`/account/orders/${encodeURIComponent(number)}`}
                      key={order.id}
                      className="grid gap-3 border-b border-black/8 p-4 transition last:border-b-0 hover:bg-[var(--paper)] sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                    >
                      <div>
                        <strong className="text-sm">#{number}</strong>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {order.created_at ? new Date(order.created_at).toLocaleDateString(language === "bn" ? "bn-BD" : "en-BD", { day: "numeric", month: "short", year: "numeric" }) : <Lang bn="অর্ডারের তারিখ পাওয়া যায়নি" en="Order date unavailable"/>}
                        </p>
                      </div>
                      <span className="order-status"><OrderStatus status={order.status}/></span>
                      <strong>{formatPrice(order.grand_total || order.total)}</strong>
                      <ArrowRightIcon size={16} className="text-[var(--muted)]" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="mt-7 grid place-items-center rounded-xl bg-[var(--paper)] p-5">
                <EmptyState
                  icon={<PackageIcon size={28} />}
                  title={<Lang bn="এখনও কোনো অর্ডার নেই" en="No orders yet"/>}
                  description={<Lang bn="আপনার সম্পন্ন হজমার্ট অর্ডার এখানে দেখা যাবে।" en="Your completed HajjMart orders will appear here."/>}
                  action={<Link href="/shop" className="button-primary"><Lang bn="কেনাকাটা শুরু করুন" en="Start shopping"/></Link>}
                />
              </div>
            )}
          </section>
        )}

        {/* Tab: Track Order */}
        {activeTab === 'track' && (
          <section id="account-panel-track" role="tabpanel" aria-labelledby="account-tab-track" className="account-tab-content rounded-[1.5rem] bg-white p-6 sm:p-8">
            <div>
              <p className="eyebrow"><Lang bn="অর্ডার ট্র্যাকিং" en="Order tracking"/></p>
              <h2 className="mt-2 font-serif text-3xl"><Lang bn="আপনার অর্ডার ট্র্যাক করুন" en="Track your order"/></h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]"><Lang bn="অর্ডার নম্বর দিয়ে আপনার অ্যাকাউন্টের অর্ডার খুঁজুন, তারপর সর্বশেষ অবস্থা দেখতে অর্ডারের বিস্তারিত খুলুন।" en="Search your account orders by order number, then open the order detail to see the latest status timeline."/></p>
              <button type="button" onClick={() => void refreshOrderStatuses()} disabled={ordersLoading} className="text-link mt-4">
                {ordersLoading ? <Lang bn="রিফ্রেশ হচ্ছে…" en="Refreshing…"/> : <Lang bn="অর্ডারের অবস্থা রিফ্রেশ করুন" en="Refresh order statuses"/>}
              </button>
            </div>

            <form onSubmit={handleSearchOrders} className="mt-6 flex gap-3 sm:gap-4">
              <input
                type="text"
                placeholder={language === "bn" ? "অর্ডার নম্বর (যেমন #12345)" : "Order number (e.g., #12345)"}
                value={searchOrderId}
                onChange={(e) => { setSearchOrderId(e.target.value); setHasSearchedOrders(false); }}
                className="field-input flex-1"
              />
              <button type="submit" className="button-primary px-6 sm:px-8"><Lang bn="খুঁজুন" en="Search"/></button>
            </form>

            {searchedOrders.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-xs font-bold text-[var(--gold)] uppercase tracking-wide"><Lang bn="খোঁজার ফল" en="Search Results"/></p>
                {searchedOrders.map((order) => {
                  const number = order.order_number || order.order_id || String(order.id);
                  return (
                    <Link
                      href={`/account/orders/${encodeURIComponent(number)}`}
                      key={order.id}
                      className="block rounded-xl border border-black/8 p-4 transition hover:bg-[var(--paper)] hover:border-[var(--gold)]/30"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <strong className="text-sm">#{number}</strong>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString(language === "bn" ? "bn-BD" : "en-BD", { day: "numeric", month: "short", year: "numeric" }) : <Lang bn="অর্ডারের তারিখ পাওয়া যায়নি" en="Order date unavailable"/>}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="order-status block mb-1"><OrderStatus status={order.status}/></span>
                          <strong className="text-sm">{formatPrice(order.grand_total || order.total)}</strong>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center text-xs text-[var(--forest)] font-bold"><Lang bn="বিস্তারিত দেখুন" en="View Details"/> <ArrowRightIcon size={12} className="ml-1" /></div>
                    </Link>
                  );
                })}
              </div>
            )}

            {hasSearchedOrders && searchOrderId.trim() && searchedOrders.length === 0 && (
              <div className="mt-6 rounded-xl bg-[var(--paper)] p-8 text-center">
                <PackageIcon size={32} className="mx-auto text-[var(--muted)] mb-3" />
                <p className="text-sm text-[var(--muted)]"><span className="lang-bn">“{searchOrderId}” এর সাথে মেলে এমন অর্ডার পাওয়া যায়নি</span><span className="lang-en">No orders found matching “{searchOrderId}”</span></p>
                <p className="mt-2 text-xs text-[var(--muted)]"><Lang bn="অর্ডার নম্বরটি দেখে আবার চেষ্টা করুন, অথবা সহায়তার জন্য যোগাযোগ করুন।" en="Check the order number and try again, or contact support."/></p>
              </div>
            )}

            {!hasSearchedOrders && orders.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-bold text-[var(--gold)] uppercase tracking-wide mb-3"><Lang bn="সাম্প্রতিক অর্ডার" en="Your Recent Orders"/></p>
                <div className="space-y-2">
                  {orders.slice(0, 5).map((order) => {
                    const number = order.order_number || order.order_id || String(order.id);
                    return (
                      <button
                        key={order.id}
                        onClick={() => selectRecentOrder(order)}
                        className="w-full text-left rounded-lg border border-black/8 p-3 transition hover:bg-[var(--paper)]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm">#{number}</span>
                          <span className="text-xs text-[var(--muted)]"><OrderStatus status={order.status}/></span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tab: Wishlist */}
        {activeTab === 'wishlist' && (
          <section id="account-panel-wishlist" role="tabpanel" aria-labelledby="account-tab-wishlist" className="account-tab-content rounded-[1.5rem] bg-white p-6 sm:p-8">
            <p className="eyebrow"><Lang bn="পরে দেখার জন্য সংরক্ষিত" en="Saved for later"/></p>
            <h2 className="mt-2 font-serif text-3xl"><Lang bn="পছন্দের তালিকা" en="Wishlist"/></h2>
            {wishlist.length ? <>
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                <span className="lang-bn">আপনার {wishlist.length}টি পণ্য সংরক্ষিত আছে। সাইন ইন করা থাকলে সংরক্ষিত পণ্য হজমার্ট অ্যাকাউন্টের সাথে সিঙ্ক হয়, তাই অন্য ডিভাইসেও পাওয়া যাবে।</span>
                <span className="lang-en">You have {wishlist.length} saved {wishlist.length === 1 ? "item" : "items"}. While signed in, saved products are synchronized to your HajjMart account so they follow you across devices.</span>
              </p>
              <Link href="/shop" className="button-quiet mt-6"><Lang bn="আরও পণ্য দেখুন" en="Browse saved possibilities"/></Link>
            </> : <div className="mt-7 rounded-xl bg-[var(--paper)] p-5"><EmptyState icon={<HeartIcon size={28}/>} title={<Lang bn="এখনও কোনো সংরক্ষিত পণ্য নেই" en="No saved items yet"/>} description={<Lang bn="পরে দেখার জন্য পছন্দের পণ্য হৃদয় আইকনে চাপ দিয়ে এখানে রাখুন।" en="Tap the heart on products you want to revisit and they will appear here."/>} action={<Link href="/shop" className="button-primary"><Lang bn="পণ্য দেখুন" en="Browse products"/></Link>}/></div>}
          </section>
        )}

        {/* Tab: Addresses */}
        {activeTab === 'addresses' && (
          <section id="account-panel-addresses" role="tabpanel" aria-labelledby="account-tab-addresses" className="account-tab-content rounded-[1.5rem] bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow"><Lang bn="ডেলিভারির তথ্য" en="Delivery details"/></p>
                <h2 className="mt-2 font-serif text-3xl"><Lang bn="সংরক্ষিত ঠিকানা" en="Saved addresses"/></h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]"><Lang bn="বারবার ব্যবহারের ডেলিভারি ঠিকানা একবার সংরক্ষণ করুন, পরে চেকআউটে পুরো ঠিকানা আবার না লিখে সেটি বেছে নিন।" en="Save repeat delivery details once, then select them during checkout instead of retyping the full address."/></p>
              </div>
              <button
                type="button"
                className="button-quiet"
                onClick={() => setAddressFormOpen((value) => !value)}
              >
                {addressFormOpen ? <Lang bn="ফর্ম বন্ধ করুন" en="Close form"/> : <Lang bn="ঠিকানা যোগ করুন" en="Add address"/>}
              </button>
            </div>
            {addressFormOpen ? (
              <form onSubmit={addAddress} className="address-form mt-6 grid gap-4 rounded-2xl bg-[var(--paper)] p-5 sm:grid-cols-2">
                <label className="field-label"><Lang bn="লেবেল" en="Label"/><input name="label" className="field-input" defaultValue={language === "bn" ? "বাসা" : "Home"} placeholder={language === "bn" ? "বাসা, অফিস…" : "Home, Office…"} /></label>
                <label className="field-label"><Lang bn="গ্রহীতার নাম" en="Recipient name"/><input name="recipient_name" required className="field-input" defaultValue={user.name} /></label>
                <label className="field-label"><Lang bn="মোবাইল নম্বর" en="Mobile number"/><input name="phone" required pattern="(?:\+?88)?01[3-9]\d{8}" className="field-input" defaultValue={user.phone || ""} placeholder="01XXXXXXXXX" /></label>
                <label className="field-label"><Lang bn="জেলা" en="District"/><select name="district" required className="field-input"><option value="">{language === "bn" ? "জেলা বাছুন" : "Select district"}</option>{districts.map((district) => <option key={district} value={district}>{language === "bn" ? banglaPlaceName(district) : district}</option>)}</select></label>
                <label className="field-label"><Lang bn="উপজেলা / থানা" en="Upazila / Thana"/><input name="upazila" className="field-input" placeholder={language === "bn" ? "যেমন: সাভার" : "e.g. Savar"} /></label>
                <label className="field-label sm:col-span-2"><Lang bn="পূর্ণ ঠিকানা" en="Full address"/><textarea name="full_address" required rows={3} className="field-input resize-none" placeholder={language === "bn" ? "এলাকা, রাস্তা, ভবন, কাছের পরিচিত স্থান" : "Area, road, building, nearby landmark"} /></label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="is_default" value="1" /> <Lang bn="এটিকে আমার ডিফল্ট ডেলিভারি ঠিকানা করুন" en="Make this my default delivery address"/></label>
                {addressError ? <p className="text-sm text-[var(--clay)] sm:col-span-2">{language === "bn" ? "ঠিকানাটি সংরক্ষণ করা যায়নি। তথ্য দেখে আবার চেষ্টা করুন।" : addressError}</p> : null}
                <div className="sm:col-span-2"><button type="submit" disabled={addressSaving} className="button-primary">{addressSaving ? <Lang bn="সংরক্ষণ হচ্ছে…" en="Saving…"/> : <Lang bn="ঠিকানা সংরক্ষণ করুন" en="Save address"/>}</button></div>
              </form>
            ) : null}
            {addressesLoading ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">{[1, 2].map((item) => <Skeleton key={item} className="h-36 rounded-2xl" />)}</div>
            ) : addresses.length ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {addresses.map((address) => (
                  <article key={address.id} className={`address-card ${address.is_default ? "is-default" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="eyebrow">{address.label ? <Lang bn={banglaFallback(address.label)} en={address.label}/> : <Lang bn="সংরক্ষিত ঠিকানা" en="Saved address"/>}</span>
                        {address.is_default ? <b className="address-default-badge"><Lang bn="ডিফল্ট" en="Default"/></b> : null}
                      </div>
                      <MapPinIcon size={20} />
                    </div>
                    <strong>{address.recipient_name}</strong>
                    <p>{address.phone}</p>
                    <p>{address.full_address}</p>
                    <p>{address.upazila ? `${address.upazila}, ` : ""}{language === "bn" ? banglaPlaceName(address.district) : address.district}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {!address.is_default ? (
                        <button type="button" className="text-link" onClick={() => makeDefault(address)}><Lang bn="ডিফল্ট করুন" en="Make default"/></button>
                      ) : null}
                      <button type="button" className="text-link text-[var(--clay)]" onClick={() => setDeleteAddressId(address.id)}><Lang bn="সরান" en="Remove"/></button>
                    </div>
                    {deleteAddressId === address.id ? (
                      <div className="mt-4">
                        <InlineConfirm
                          title={<Lang bn="এই ঠিকানাটি সরাবেন?" en="Remove this address?"/>}
                          description={<Lang bn="চেকআউটের সময় এই ঠিকানাটি আর দেখানো হবে না।" en="It will no longer be offered during checkout."/>}
                          confirmLabel={<Lang bn="সরান" en="Remove"/>}
                          cancelLabel={<Lang bn="বাতিল" en="Cancel"/>}
                          tone="danger"
                          onCancel={() => setDeleteAddressId(null)}
                          onConfirm={() => void removeAddress(address.id)}
                        />
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-[var(--paper)] p-5">
                <EmptyState
                  icon={<MapPinIcon size={28} />}
                  title={<Lang bn="এখনও কোনো সংরক্ষিত ঠিকানা নেই" en="No saved addresses yet"/>}
                  description={<Lang bn="আপনার নিয়মিত ডেলিভারি ঠিকানা একবার যোগ করে চেকআউটে বারবার ব্যবহার করুন।" en="Add your usual delivery address once and reuse it at checkout."/>}
                />
              </div>
            )}
          </section>
        )}

        {/* Tab: Place Order */}
        {activeTab === 'place-order' && (
          <section id="account-panel-place-order" role="tabpanel" aria-labelledby="account-tab-place-order" className="account-tab-content rounded-[1.5rem] bg-gradient-to-br from-[var(--forest)] to-[var(--forest-deep)] p-8 sm:p-12 text-white">
            <h2 className="font-serif text-4xl"><Lang bn="কেনাকাটার জন্য প্রস্তুত?" en="Ready to shop?"/></h2>
            <p className="mt-3 max-w-xl text-white/80"><Lang bn="প্রিমিয়াম আতর ও কসমেটিকস থেকে মার্জিত আবায়া এবং প্রিয়জনের উপহার—আমাদের ইসলামিক পণ্যের সংগ্রহ দেখুন।" en="Discover our beautiful collection of Islamic products, from premium attars and cosmetics to elegant abayas and gifts for your loved ones."/></p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link href="/shop" className="button-gold">
                <Lang bn="সব পণ্য দেখুন" en="Browse all products"/>
              </Link>
              <Link href="/shop?category=attar" className="button-outline-light">
                <Lang bn="আতর কিনুন" en="Shop Attars"/>
              </Link>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="rounded-xl bg-white/10 p-6 backdrop-blur-sm">
                <div className="text-2xl mb-2">🌹</div>
                <h3 className="font-serif text-xl mb-2"><Lang bn="প্রিমিয়াম আতর" en="Premium Attars"/></h3>
                <p className="text-sm text-white/70"><Lang bn="সেরা উপাদানের উৎকৃষ্ট সুগন্ধ" en="Exquisite fragrances from the finest ingredients"/></p>
                <Link href="/shop?category=attar" className="text-link mt-3 !text-[var(--gold-light)]"><Lang bn="এখনই কিনুন →" en="Shop now →"/></Link>
              </div>

              <div className="rounded-xl bg-white/10 p-6 backdrop-blur-sm">
                <div className="text-2xl mb-2">👗</div>
                <h3 className="font-serif text-xl mb-2"><Lang bn="মার্জিত আবায়া" en="Elegant Abayas"/></h3>
                <p className="text-sm text-white/70"><Lang bn="শালীন ও সুন্দর ইসলামিক পোশাক" en="Modest and beautiful Islamic fashion"/></p>
                <Link href="/shop?category=abayas" className="text-link mt-3 !text-[var(--gold-light)]"><Lang bn="এখনই কিনুন →" en="Shop now →"/></Link>
              </div>

              <div className="rounded-xl bg-white/10 p-6 backdrop-blur-sm">
                <div className="text-2xl mb-2">🎁</div>
                <h3 className="font-serif text-xl mb-2"><Lang bn="বিশেষ উপহার" en="Special Gifts"/></h3>
                <p className="text-sm text-white/70"><Lang bn="প্রতিটি উপলক্ষের জন্য যত্নে বাছাই করা উপহার" en="Thoughtful presents for every occasion"/></p>
                <Link href="/shop?category=gifts" className="text-link mt-3 !text-[var(--gold-light)]"><Lang bn="এখনই কিনুন →" en="Shop now →"/></Link>
              </div>
            </div>
          </section>
        )}

        {/* Recently Viewed - Show on all tabs except place-order */}
        {activeTab !== 'place-order' && <RecentlyViewedRail />}
      </div>
    </div>
  );
}
