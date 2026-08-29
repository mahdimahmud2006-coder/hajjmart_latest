"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { trackOrder, type TrackingResponse } from "@/lib/api";
import { OrderTimeline } from "@/components/tracking/order-timeline";
import { Button, Card, TextInput, Badge } from "@/components/ui/storefront-primitives";
import { Search, ExternalLink, Package, Truck, CheckCircle2 } from "lucide-react";
import { useStore } from "@/context/store-context";

function TrackOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useStore();

  const initialOrder = searchParams.get("order") || "";
  const initialMobile = searchParams.get("phone") || "";

  const [orderNumber, setOrderNumber] = useState(initialOrder);
  const [mobileNumber, setMobileNumber] = useState(initialMobile);
  const [trackingData, setTrackingData] = useState<TrackingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchTracking = async (mob: string, ord?: string) => {
    if (!mob.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await trackOrder(mob.trim(), ord?.trim());
      setTrackingData(data);
    } catch {
      setTrackingData(null);
      notify("অর্ডার তথ্য পাওয়া যায়নি। অনুগ্রহ করে সঠিক মোবাইল নম্বর এবং প্রযোজ্য হলে অর্ডার নম্বর দিন।", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialMobile) {
      fetchTracking(initialMobile, initialOrder);
    }
  }, [initialOrder, initialMobile]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber.trim()) {
      notify("অনুগ্রহ করে আপনার মোবাইল নম্বর লিখুন।", "error");
      return;
    }
    const params = new URLSearchParams();
    params.set("phone", mobileNumber.trim());
    if (orderNumber.trim()) params.set("order", orderNumber.trim());
    router.push(`/track-order?${params.toString()}`);
    fetchTracking(mobileNumber, orderNumber);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 w-full">
      {/* Page Title Context */}
      <div className="text-center max-w-xl mx-auto mb-8">
        <h1 className="text-[28px] sm:text-[36px] font-bold text-[#1A1A1A] flex items-center justify-center gap-2">
          <Truck className="w-8 h-8 text-[#1F5D42]" />
          <span>অর্ডার ট্র্যাকিং (Order Tracker)</span>
        </h1>
        <p className="text-[18px] text-[#5B5650] mt-1">
          আপনার মোবাইল নম্বর এবং চাইলে অর্ডার নম্বর দিয়ে লাইভ পার্সেল স্ট্যাটাস ট্র্যাক করুন
        </p>
      </div>

      {/* Search Form Card */}
      <Card bordered className="p-6 bg-[#FFFDF8] mb-8 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-5">
            <TextInput
              label="অর্ডার নম্বর (Order ID, ঐচ্ছিক)"
              placeholder="যেমন: HM-2026-88401"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
          </div>

          <div className="sm:col-span-4">
            <TextInput
              label="মোবাইল নম্বর"
              type="tel"
              placeholder="01711000111"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              required
            />
          </div>

          <div className="sm:col-span-3">
            <Button
              variant="primary"
              size="md"
              type="submit"
              loading={loading}
              fullWidth
              icon={<Search className="w-5 h-5" />}
            >
              ট্র্যাক করুন
            </Button>
          </div>
        </form>
      </Card>

      {/* Tracking Results View */}
      {searched && (
        <>
          {loading ? (
            <Card bordered className="p-8 text-center bg-[#FFFDF8] animate-pulse">
              <p className="text-[18px] text-[#5B5650]">ট্র্যাকিং ডাটা লোড করা হচ্ছে...</p>
            </Card>
          ) : trackingData ? (
            <Card bordered className="p-6 sm:p-8 bg-[#FFFDF8] shadow-xs flex flex-col gap-6">
              {/* Header Info */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DDD6C7] pb-4">
                <div>
                  <span className="text-[14px] text-[#5B5650] block">অর্ডার ইনভয়েস:</span>
                  <span className="text-[22px] font-bold text-[#1F5D42] font-mono">
                    {trackingData.order_number}
                  </span>
                </div>

                {trackingData.courier_name && (
                  <div className="text-right">
                    <span className="text-[14px] text-[#5B5650] block">ডেলিভারি কুরিয়ার:</span>
                    <Badge variant="primary-tint" icon={<Package className="w-4 h-4" />}>
                      {trackingData.courier_name} ({trackingData.consignment_id || "প্রসেসিং"})
                    </Badge>
                  </div>
                )}
              </div>

              {/* Pathao Official Direct Link */}
              {trackingData.tracking_url && (
                <div className="p-4 bg-[#E4EFE8] border border-[#C4DFC3] rounded-[8px] flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-[#1F5D42] font-bold text-[18px]">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>পাঠাও কুরিয়ার লাইভ ট্র্যাকিং সক্রিয়</span>
                  </div>
                  <a
                    href={trackingData.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1F5D42] text-white rounded-[6px] font-bold text-[16px] hover:bg-[#164430] transition-colors"
                  >
                    <span>পাঠাও পোর্টালে লাইভ ট্র্যাক করুন</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {/* Progress Timeline */}
              <div className="mt-2">
                <h3 className="text-[20px] font-bold text-[#1A1A1A] mb-4">
                  পার্সেল ট্র্যাকিং টাইমলাইন:
                </h3>
                <OrderTimeline timeline={trackingData.timeline} />
              </div>
            </Card>
          ) : (
            <Card bordered className="p-8 text-center bg-[#FFFDF8]">
              <p className="text-[18px] text-[#B3261E] font-bold">
                ⚠️ দুঃখিত, প্রদত্ত তথ্যের জন্য কোনো অর্ডার পাওয়া যায়নি।
              </p>
              <p className="text-[16px] text-[#5B5650] mt-1">
                আপনার মোবাইল নম্বর এবং প্রযোজ্য হলে অর্ডার নম্বর পুনরায় চেক করুন।
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[18px]">লোড হচ্ছে...</div>}>
      <TrackOrderContent />
    </Suspense>
  );
}
