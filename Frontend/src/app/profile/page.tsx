"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/store-context";
import {
  getCustomerOrders,
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  updateCustomerProfile,
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
} from "lucide-react";

const BANGLADESH_DISTRICTS = [
  "Bagerhat", "Bandarban", "Barguna", "Barishal", "Bhola", "Bogura", "Brahmanbaria",
  "Chandpur", "Chapai Nawabganj", "Chattogram", "Chuadanga", "Comilla", "Cox's Bazar",
  "Dhaka", "Dinajpur", "Faridpur", "Feni", "Gaibandha", "Gazipur", "Gopalganj",
  "Habiganj", "Jamalpur", "Jashore", "Jhalokati", "Jhenaidah", "Joypurhat", "Khagrachhari",
  "Khulna", "Kishoreganj", "Kurigram", "Kushtia", "Lakshmipur", "Lalmonirhat", "Madaripur",
  "Magura", "Manikganj", "Meherpur", "Moulvibazar", "Munshiganj", "Mymensingh", "Naogaon",
  "Narail", "Narayanganj", "Narsingdi", "Natore", "Netrokona", "Nilphamari", "Noakhali",
  "Pabna", "Panchagarh", "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi", "Rangamati",
  "Rangpur", "Satkhira", "Shariatpur", "Sherpur", "Sirajganj", "Sunamganj", "Sylhet",
  "Tangail", "Thakurgaon",
];

export default function ProfileDashboardPage() {
  const router = useRouter();
  const { user, token, logout, addToCart, notify, hydrated, setSession } = useStore();

  const [activeTab, setActiveTab] = useState<"orders" | "addresses" | "wishlist" | "settings">("orders");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [settingDefaultAddressId, setSettingDefaultAddressId] = useState<number | null>(null);
  const [addressLabel, setAddressLabel] = useState("বাসা");
  const [addressRecipient, setAddressRecipient] = useState("");
  const [addressPhone, setAddressPhone] = useState("");
  const [addressDistrict, setAddressDistrict] = useState("Dhaka");
  const [addressLine, setAddressLine] = useState("");
  const [addressDefault, setAddressDefault] = useState(false);

  // Edit profile state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (hydrated && !token) {
      router.push("/auth/login");
    }
  }, [hydrated, token, router]);

  // Sync user profile state
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  useEffect(() => {
    if (!showAddressForm) return;
    setAddressRecipient((current) => current || user?.name || "");
    setAddressPhone((current) => current || user?.phone || "");
    setAddressDefault((current) => current || addresses.length === 0);
  }, [showAddressForm, user, addresses.length]);

  useEffect(() => {
    if (token) {
      setLoading(true);
      Promise.all([getCustomerOrders(token), getCustomerAddresses(token)])
        .then(([ordList, addrList]) => {
          setOrders(ordList);
          setAddresses(addrList);
        })
        .catch(() => {
          setOrders([]);
          setAddresses([]);
          notify("অ্যাকাউন্টের তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।", "error");
        })
        .finally(() => setLoading(false));
    }
  }, [token]);

  if (!hydrated || !token) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 w-full flex items-center justify-center min-h-[400px]">
        <div className="text-center text-[#5B5650] text-[18px]">
          লোড হচ্ছে...
        </div>
      </div>
    );
  }

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
        item.quantity,
        { silent: true }
      );
    });

    router.push("/checkout");
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const updated = await updateCustomerProfile({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      }, token);
      setSession(token, updated);
      notify("প্রোফাইল তথ্য সফলভাবে সংরক্ষণ করা হয়েছে।", "success");
    } catch {
      notify("প্রোফাইল তথ্য সংরক্ষণ করা যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।", "error");
    }
  };

  const resetAddressForm = () => {
    setShowAddressForm(false);
    setAddressLabel("বাসা");
    setAddressRecipient("");
    setAddressPhone("");
    setAddressDistrict("Dhaka");
    setAddressLine("");
    setAddressDefault(false);
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || savingAddress) return;
    setSavingAddress(true);
    try {
      const created = await createCustomerAddress({
        label: addressLabel.trim() || null,
        recipient_name: addressRecipient.trim(),
        phone: addressPhone.trim(),
        district: addressDistrict,
        full_address: addressLine.trim(),
        is_default: addressDefault || addresses.length === 0,
      }, token);

      setAddresses((current) => [
        created,
        ...current.map((address) => created.is_default ? { ...address, is_default: false } : address),
      ]);
      resetAddressForm();
      notify("নতুন ঠিকানা সংরক্ষণ করা হয়েছে।", "success");
    } catch {
      notify("ঠিকানা সংরক্ষণ করা যায়নি। মোবাইল নম্বর, জেলা ও বিস্তারিত ঠিকানা যাচাই করে আবার চেষ্টা করুন।", "error");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleMakeDefaultAddress = async (address: CustomerAddress) => {
    if (!token || !address.id || address.is_default || settingDefaultAddressId) return;

    setSettingDefaultAddressId(address.id);
    try {
      const updated = await updateCustomerAddress(address.id, { is_default: true }, token);
      setAddresses((current) => [
        updated,
        ...current
          .filter((item) => item.id !== updated.id)
          .map((item) => ({ ...item, is_default: false })),
      ]);
      notify("ডিফল্ট ডেলিভারি ঠিকানা আপডেট করা হয়েছে।", "success");
    } catch {
      notify("ডিফল্ট ঠিকানা পরিবর্তন করা যায়নি। আবার চেষ্টা করুন।", "error");
    } finally {
      setSettingDefaultAddressId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 w-full">
      {/* Profile Header Summary */}
      <div className="bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] p-4 sm:p-6 mb-5 sm:mb-8 flex flex-wrap items-center justify-between gap-4 shadow-xs overflow-hidden">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 bg-[#E4EFE8] rounded-full flex items-center justify-center text-[#1F5D42] text-[24px] font-bold">
            {user?.name?.[0] || "গ"}
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[28px] font-bold text-[#1A1A1A] break-words">
              {user?.name || "গ্রাহক"}
            </h1>
            <p className="text-[15px] sm:text-[16px] text-[#5B5650] break-words">
              {user?.email || "ইমেইল নেই"} • {user?.phone || "মোবাইল নেই"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
        <aside className="lg:col-span-3 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] p-2 flex flex-col gap-1 lg:sticky lg:top-24 overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`w-full min-w-0 text-left px-3 sm:px-4 py-3 text-[16px] sm:text-[18px] leading-snug font-bold rounded-[8px] flex items-center gap-2 sm:gap-3 transition-colors ${
              activeTab === "orders"
                ? "bg-[#E4EFE8] text-[#1F5D42]"
                : "text-[#5B5650] hover:bg-[#FBF8F1]"
            }`}
          >
            <Package className="w-5 h-5 shrink-0" />
            <span className="min-w-0 break-words">আমার অর্ডারসমূহ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("addresses")}
            className={`w-full min-w-0 text-left px-3 sm:px-4 py-3 text-[16px] sm:text-[18px] leading-snug font-bold rounded-[8px] flex items-center gap-2 sm:gap-3 transition-colors ${
              activeTab === "addresses"
                ? "bg-[#E4EFE8] text-[#1F5D42]"
                : "text-[#5B5650] hover:bg-[#FBF8F1]"
            }`}
          >
            <MapPin className="w-5 h-5 shrink-0" />
            <span className="min-w-0 break-words">ঠিকানা বই (Address)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("wishlist")}
            className={`w-full min-w-0 text-left px-3 sm:px-4 py-3 text-[16px] sm:text-[18px] leading-snug font-bold rounded-[8px] flex items-center gap-2 sm:gap-3 transition-colors ${
              activeTab === "wishlist"
                ? "bg-[#E4EFE8] text-[#1F5D42]"
                : "text-[#5B5650] hover:bg-[#FBF8F1]"
            }`}
          >
            <Heart className="w-5 h-5 shrink-0" />
            <span className="min-w-0 break-words">পছন্দের তালিকা</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`w-full min-w-0 text-left px-3 sm:px-4 py-3 text-[16px] sm:text-[18px] leading-snug font-bold rounded-[8px] flex items-center gap-2 sm:gap-3 transition-colors ${
              activeTab === "settings"
                ? "bg-[#E4EFE8] text-[#1F5D42]"
                : "text-[#5B5650] hover:bg-[#FBF8F1]"
            }`}
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span className="min-w-0 break-words">প্রোফাইল সেটিং</span>
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
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h2 className="text-[24px] font-bold text-[#1A1A1A]">ঠিকানা বই (Saved Addresses)</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowAddressForm(true)}
                  className="shrink-0"
                >
                  নতুন ঠিকানা যোগ করুন
                </Button>
              </div>

              {showAddressForm && (
                <Card bordered className="p-5 bg-[#FFFDF8]">
                  <form onSubmit={handleAddAddress} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextInput
                      label="ঠিকানার নাম"
                      value={addressLabel}
                      onChange={(e) => setAddressLabel(e.target.value)}
                      placeholder="বাসা / অফিস"
                    />
                    <TextInput
                      label="প্রাপকের নাম"
                      value={addressRecipient}
                      onChange={(e) => setAddressRecipient(e.target.value)}
                      required
                    />
                    <TextInput
                      label="মোবাইল নম্বর"
                      value={addressPhone}
                      onChange={(e) => setAddressPhone(e.target.value)}
                      inputMode="tel"
                      placeholder="01XXXXXXXXX"
                      pattern="(?:\+?88)?01[3-9][0-9]{8}"
                      required
                    />
                    <div className="flex flex-col gap-1.5 w-full">
                      <label htmlFor="saved-address-district" className="text-[18px] font-bold text-[#1A1A1A]">
                        জেলা <span className="text-[#B3261E] font-normal">*</span>
                      </label>
                      <select
                        id="saved-address-district"
                        value={addressDistrict}
                        onChange={(e) => setAddressDistrict(e.target.value)}
                        className="min-h-[48px] px-4 py-3 text-[18px] text-[#1A1A1A] bg-[#FFFDF8] border border-[#DDD6C7] rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#1F5D42]"
                        required
                      >
                        {BANGLADESH_DISTRICTS.map((district) => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <TextInput
                        label="বিস্তারিত ঠিকানা"
                        value={addressLine}
                        onChange={(e) => setAddressLine(e.target.value)}
                        placeholder="বাড়ি, রাস্তা, এলাকা"
                        required
                      />
                    </div>
                    <label className="md:col-span-2 flex items-center gap-3 text-[17px] font-medium text-[#1A1A1A] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addressDefault || addresses.length === 0}
                        onChange={(e) => setAddressDefault(e.target.checked)}
                        disabled={addresses.length === 0}
                        className="w-5 h-5 accent-[#1F5D42]"
                      />
                      ডিফল্ট ডেলিভারি ঠিকানা হিসেবে ব্যবহার করুন
                    </label>
                    <div className="md:col-span-2 flex flex-wrap gap-3">
                      <Button type="submit" variant="primary" size="sm" loading={savingAddress}>
                        ঠিকানা সংরক্ষণ করুন
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={resetAddressForm} disabled={savingAddress}>
                        বাতিল
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <Card key={addr.id || addr.title} bordered className="p-5 bg-[#FFFDF8]">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[18px] font-bold text-[#1F5D42]">{addr.title}</h3>
                      {addr.is_default && <Badge variant="primary-tint">ডিফল্ট</Badge>}
                    </div>
                    <p className="font-bold text-[#1A1A1A]">{addr.recipient_name}</p>
                    <p className="text-[16px] text-[#5B5650] mt-1">{addr.phone}</p>
                    <p className="text-[16px] text-[#5B5650] mt-1">{addr.district}</p>
                    <p className="text-[16px] text-[#5B5650] mt-1">{addr.address_line}</p>
                    {!addr.is_default && addr.id && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-4"
                        loading={settingDefaultAddressId === addr.id}
                        disabled={settingDefaultAddressId !== null}
                        onClick={() => void handleMakeDefaultAddress(addr)}
                      >
                        ডিফল্ট ঠিকানা করুন
                      </Button>
                    )}
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
