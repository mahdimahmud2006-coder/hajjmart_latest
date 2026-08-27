"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/store-context";
import {
  getCustomerOrders,
  getCustomerAddresses,
  type CustomerOrder,
  type CustomerAddress,
} from "@/lib/api";
import { Button, Card, Badge, TextInput } from "@/components/ui/storefront-primitives";
import {
  User as UserIcon,
  Package,
  MapPin,
  Heart,
  Settings,
  LogOut,
  Repeat,
  Truck,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
} from "lucide-react";

export default function ProfileDashboardPage() {
  const router = useRouter();
  const { user, token, logout, addToCart, notify } = useStore();

  const [activeTab, setActiveTab] = useState<"orders" | "addresses" | "wishlist" | "settings">("orders");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit profile state
  const [name, setName] = useState(user?.name || "রহিম আহমেদ");
  const [email, setEmail] = useState(user?.email || "rahim@example.com");
  const [phone, setPhone] = useState(user?.phone || "01711000111");

  useEffect(() => {
    setLoading(true);
    Promise.all([getCustomerOrders(token), getCustomerAddresses(token)])
      .then(([ordList, addrList]) => {
        setOrders(ordList);
        setAddresses(addrList);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // "Buy Again" (পুনরায় অর্ডার করুন) One-Tap Action
  const handleBuyAgain = (order: CustomerOrder) => {
    order.items.forEach((item) => {
      addToCart(
        {
          id: item.product_id,
          name: item.name,
          slug: `product-${item.product_id}`,
          retail_price: item.unit_price,
        },
        item.variant_id ? { id: item.variant_id, retail_price: item.unit_price } : null,
        item.quantity
      );
    });

    notify(`"${order.order_number}" এর পণ্যসমূহ কার্টে যোগ করা হয়েছে!`, "success");
    router.push("/checkout");
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    notify("প্রোফাইল তথ্য সফলভাবে সংরক্ষণ করা হয়েছে।", "success");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      {/* Profile Header Summary */}
      <div className="bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] p-6 mb-8 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#E4EFE8] rounded-full flex items-center justify-center text-[#1F5D42] text-[24px] font-bold">
            {user?.name?.[0] || "র"}
          </div>
          <div>
            <h1 className="text-[24px] sm:text-[28px] font-bold text-[#1A1A1A]">
              {user?.name || "রহিম আহমেদ"}
            </h1>
            <p className="text-[16px] text-[#5B5650]">
              {user?.email || "rahim@example.com"} • {user?.phone || "01711000111"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="gold-tint">সম্মানিত গ্রাহক (Verified Member)</Badge>
          <button
            type="button"
            onClick={() => {
              logout();
              notify("আপনি লগআউট করেছেন।", "neutral");
              router.push("/");
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-[16px] font-bold text-[#B3261E] hover:bg-[#FEE2E2] rounded-[6px] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>লগআউট</span>
          </button>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sidebar Nav */}
        <aside className="lg:col-span-3 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] p-2 flex flex-col gap-1 sticky top-24">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`w-full text-left px-4 py-3 text-[18px] font-bold rounded-[8px] flex items-center gap-3 transition-colors ${
              activeTab === "orders"
                ? "bg-[#E4EFE8] text-[#1F5D42]"
                : "text-[#5B5650] hover:bg-[#FBF8F1]"
            }`}
          >
            <Package className="w-5 h-5" />
            <span>আমার অর্ডারসমূহ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("addresses")}
            className={`w-full text-left px-4 py-3 text-[18px] font-bold rounded-[8px] flex items-center gap-3 transition-colors ${
              activeTab === "addresses"
                ? "bg-[#E4EFE8] text-[#1F5D42]"
                : "text-[#5B5650] hover:bg-[#FBF8F1]"
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span>ঠিকানা বই (Address)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("wishlist")}
            className={`w-full text-left px-4 py-3 text-[18px] font-bold rounded-[8px] flex items-center gap-3 transition-colors ${
              activeTab === "wishlist"
                ? "bg-[#E4EFE8] text-[#1F5D42]"
                : "text-[#5B5650] hover:bg-[#FBF8F1]"
            }`}
          >
            <Heart className="w-5 h-5" />
            <span>পছন্দের তালিকা</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`w-full text-left px-4 py-3 text-[18px] font-bold rounded-[8px] flex items-center gap-3 transition-colors ${
              activeTab === "settings"
                ? "bg-[#E4EFE8] text-[#1F5D42]"
                : "text-[#5B5650] hover:bg-[#FBF8F1]"
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>প্রোফাইল সেটিং</span>
          </button>
        </aside>

        {/* Right Tab Content */}
        <main className="lg:col-span-9">
          {/* Tab 1: Orders */}
          {activeTab === "orders" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-[24px] font-bold text-[#1A1A1A] mb-2">
                আমার অর্ডার ইতিহাস ({orders.length})
              </h2>

              {loading ? (
                <div className="p-8 text-center text-[#5B5650]">অর্ডার লোড হচ্ছে...</div>
              ) : orders.length === 0 ? (
                <Card bordered className="p-8 text-center bg-[#FFFDF8]">
                  <p className="text-[18px] text-[#5B5650]">আপনার কোনো পূর্ববর্তী অর্ডার পাওয়া যায়নি।</p>
                </Card>
              ) : (
                orders.map((order) => (
                  <Card key={order.order_number} bordered className="p-6 bg-[#FFFDF8] flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDD6C7] pb-3">
                      <div>
                        <span className="text-[14px] text-[#5B5650] block">অর্ডার নম্বর:</span>
                        <span className="text-[20px] font-bold text-[#1F5D42] font-mono">
                          {order.order_number}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {order.order_status === "delivered" ? (
                          <Badge variant="success" icon={<CheckCircle2 className="w-4 h-4" />}>
                            ডেলিভারি সম্পন্ন
                          </Badge>
                        ) : (
                          <Badge variant="warning" icon={<Clock className="w-4 h-4" />}>
                            প্রসেসিং চলছে
                          </Badge>
                        )}
                        <span className="text-[18px] font-bold text-[#1A1A1A]">
                          ৳{order.grand_total.toLocaleString("en-US")}
                        </span>
                      </div>
                    </div>

                    {/* Order Line Items */}
                    <div className="flex flex-col gap-3">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <img
                            src={item.image || "/placeholder.jpg"}
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded border border-[#DDD6C7]"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[16px] font-bold text-[#1A1A1A] truncate">{item.name}</h4>
                            <span className="text-[14px] text-[#5B5650]">
                              {item.quantity}টি × ৳{item.unit_price}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#DDD6C7] flex-wrap gap-2">
                      <div className="flex items-center gap-4">
                        <Link
                          href={`/track-order?order=${order.order_number}`}
                          className="text-[16px] font-bold text-[#1F5D42] hover:underline flex items-center gap-1"
                        >
                          <Truck className="w-4 h-4" />
                          <span>ট্র্যাক করুন</span>
                        </Link>

                        {order.order_status === "delivered" && (
                          <Link
                            href={`/orders/${order.order_number}/return`}
                            className="text-[16px] font-bold text-[#B8860B] hover:underline flex items-center gap-1"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>রিটার্ন বা এক্সচেঞ্জ</span>
                          </Link>
                        )}
                      </div>

                      {/* "Buy Again" One-Tap Button */}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleBuyAgain(order)}
                        icon={<Repeat className="w-4 h-4" />}
                      >
                        পুনরায় অর্ডার করুন (Buy Again)
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Addresses */}
          {activeTab === "addresses" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[24px] font-bold text-[#1A1A1A]">ঠিকানা বই (Saved Addresses)</h2>
                <Button variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />}>
                  নতুন ঠিকানা যোগ করুন
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <Card key={addr.id || addr.title} bordered className="p-5 bg-[#FFFDF8]">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[18px] font-bold text-[#1F5D42]">{addr.title}</h3>
                      {addr.is_default && <Badge variant="primary-tint">ডিফল্ট</Badge>}
                    </div>
                    <p className="font-bold text-[#1A1A1A]">{addr.recipient_name}</p>
                    <p className="text-[16px] text-[#5B5650] mt-1">{addr.phone}</p>
                    <p className="text-[16px] text-[#5B5650] mt-1">{addr.address_line}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Wishlist */}
          {activeTab === "wishlist" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[24px] font-bold text-[#1A1A1A]">পছন্দের তালিকা (Wishlist)</h2>
                <Link href="/wishlist">
                  <Button variant="secondary" size="sm">পূর্ণ তালিকা দেখুন</Button>
                </Link>
              </div>

              <Card bordered className="p-8 text-center bg-[#FFFDF8]">
                <Heart className="w-12 h-12 text-[#B3261E] fill-[#B3261E] mx-auto mb-2" />
                <h3 className="text-[20px] font-bold text-[#1A1A1A]">আপনার পছন্দের তালিকা অ্যাক্সেস করুন</h3>
                <p className="text-[18px] text-[#5B5650] mt-1">
                  সংরক্ষিত পণ্যগুলো দেখতে এবং কার্টে সরাতে নিচের বাটনে ক্লিক করুন।
                </p>
                <Link href="/wishlist" className="inline-block mt-4">
                  <Button variant="primary" size="md">পছন্দের তালিকায় যান</Button>
                </Link>
              </Card>
            </div>
          )}

          {/* Tab 4: Settings */}
          {activeTab === "settings" && (
            <Card bordered className="p-6 bg-[#FFFDF8]">
              <h2 className="text-[24px] font-bold text-[#1A1A1A] mb-6">প্রোফাইল সেটিং (Profile Settings)</h2>
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 max-w-md">
                <TextInput
                  label="আপনার নাম"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <TextInput
                  label="ইমেইল ঠিকানা"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextInput
                  label="মোবাইল নম্বর"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <Button variant="primary" size="md" type="submit" className="w-fit mt-2">
                  তথ্য সংরক্ষণ করুন
                </Button>
              </form>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
