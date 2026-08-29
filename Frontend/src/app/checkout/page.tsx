"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/store-context";
import { CheckoutHeader } from "@/components/checkout/checkout-header";
import { CheckoutForm, type CheckoutFormData } from "@/components/checkout/checkout-form";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";
import {
  getCustomerAddresses,
  quoteCheckout,
  placeCustomerOrder,
  placeGuestOrder,
  type CheckoutQuoteResponse,
} from "@/lib/api";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, district, clearCart, notify, token, user, hydrated } = useStore();

  const [formData, setFormData] = useState<CheckoutFormData>({
    customerName: "",
    mobileNumber: "",
    email: "",
    district: district || "Dhaka",
    thana: "Dhanmondi",
    shippingAddress: "",
    paymentMethod: "cod",
  });

  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [quote, setQuote] = useState<CheckoutQuoteResponse | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const prefilledSession = useRef<string | null>(null);

  // Address data is account-scoped. Signed-in customers start from their saved
  // default address; guests keep only their own browser checkout draft.
  useEffect(() => {
    if (!hydrated) return;

    const sessionKey = user && token ? `user:${user.id}` : "guest";
    if (prefilledSession.current === sessionKey) return;
    prefilledSession.current = sessionKey;

    if (!user || !token) {
      try {
        const saved = localStorage.getItem("hajjmart_checkout_form_guest") || localStorage.getItem("hajjmart_checkout_form");
        if (saved) setFormData(JSON.parse(saved));
      } catch {
        // Ignore storage errors.
      }
      return;
    }

    void getCustomerAddresses(token)
      .then((addresses) => {
        const defaultAddress = addresses.find((address) => address.is_default);
        if (defaultAddress) {
          setFormData((current) => ({
            ...current,
            customerName: defaultAddress.recipient_name || user.name || current.customerName,
            mobileNumber: defaultAddress.phone || user.phone || current.mobileNumber,
            email: user.email || current.email,
            district: defaultAddress.district || current.district,
            thana: defaultAddress.thana || current.thana,
            shippingAddress: defaultAddress.address_line || current.shippingAddress,
          }));
          return;
        }

        let draft: Partial<CheckoutFormData> = {};
        try {
          const saved = localStorage.getItem(`hajjmart_checkout_form_${user.id}`);
          if (saved) draft = JSON.parse(saved);
        } catch {
          // Ignore storage errors.
        }
        setFormData((current) => ({
          ...current,
          ...draft,
          customerName: draft.customerName || user.name || current.customerName,
          mobileNumber: draft.mobileNumber || user.phone || current.mobileNumber,
          email: draft.email || user.email || current.email,
        }));
      })
      .catch(() => {
        setFormData((current) => ({
          ...current,
          customerName: user.name || current.customerName,
          mobileNumber: user.phone || current.mobileNumber,
          email: user.email || current.email,
        }));
      });
  }, [hydrated, token, user]);

  // Sync form district changes with store
  const handleFormChange = (updated: Partial<CheckoutFormData>) => {
    const next = { ...formData, ...updated };
    setFormData(next);
    try {
      const key = user ? `hajjmart_checkout_form_${user.id}` : "hajjmart_checkout_form_guest";
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  // Redirect if cart is empty
  useEffect(() => {
    if (hydrated && cart.length === 0) {
      router.push("/cart");
    }
  }, [hydrated, cart, router]);

  // Fetch real-time server quote
  useEffect(() => {
    if (cart.length === 0) return;

    setLoadingQuote(true);
    quoteCheckout({
      items: cart.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
      })),
      district: formData.district,
      thana: formData.thana,
      coupon_code: couponCode,
      payment_method: formData.paymentMethod,
    }, token)
      .then((q) => setQuote(q))
      .catch(() => setQuote(null))
      .finally(() => setLoadingQuote(false));
  }, [cart, formData.district, formData.thana, formData.paymentMethod, couponCode, token]);

  const handleApplyCoupon = (code: string) => {
    const normalized = code.trim().toUpperCase();
    if (normalized) setCouponCode(normalized);
  };

  const handleRemoveCoupon = () => setCouponCode(null);

  // Submit Order
  const handleSubmitOrder = async () => {
    if (couponCode && quote?.coupon_applied !== true) {
      notify("কুপন কোডটি বৈধ নয় বা এই অর্ডারে প্রযোজ্য নয়।", "error");
      return;
    }
    // 1. Validate Required Fields
    if (!formData.customerName.trim()) {
      notify("অনুগ্রহ করে আপনার নাম লিখুন।", "error");
      return;
    }

    // 2. Validate 11-Digit BD Phone Number
    let cleanPhone = formData.mobileNumber.trim().replace(/\D/g, "");
    if (cleanPhone.length === 13 && cleanPhone.startsWith("88")) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.length !== 11 || !/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setPhoneError("সঠিক ১১ ডিজিটের মোবাইল নম্বর লিখুন (যেমন: 01711000111)");
      notify("সঠিক ১১ ডিজিটের মোবাইল নম্বর লিখুন।", "error");
      return;
    }
    setPhoneError(undefined);

    if (!formData.thana.trim()) {
      notify("অনুগ্রহ করে থানা / উপজেলা লিখুন।", "error");
      return;
    }

    if (!formData.shippingAddress.trim()) {
      notify("অনুগ্রহ করে আপনার বিস্তারিত ঠিকানা লিখুন।", "error");
      return;
    }

    try {
      setSubmitting(true);
      const orderPayload = {
        name: formData.customerName.trim(),
        customer_name: formData.customerName.trim(),
        mobile_number: cleanPhone,
        email: formData.email.trim() || undefined,
        district: formData.district,
        thana: formData.thana,
        upazila_thana: formData.thana,
        full_address: formData.shippingAddress.trim(),
        shipping_address: formData.shippingAddress.trim(),
        payment_method: formData.paymentMethod,
        allocation_token: quote?.allocation_token,
        items: cart.map((item) => ({
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
        })),
        coupon_code: couponCode,
        terms_accepted: true,
      };

      // This is the core fix: authenticated customers use /orders so the
      // backend stores customer_id. Guests still use the guest checkout route.
      const res = token
        ? await placeCustomerOrder(orderPayload, token)
        : await placeGuestOrder(orderPayload);

      // Clear Cart & Form Storage
      clearCart();
      try {
        localStorage.removeItem(user ? `hajjmart_checkout_form_${user.id}` : "hajjmart_checkout_form_guest");
        localStorage.removeItem("hajjmart_checkout_form");
      } catch {
        // Ignore
      }

      if (formData.paymentMethod === "sslcommerz" || formData.paymentMethod === "stripe") {
        notify("পেমেন্ট গেটওয়েতে রিডাইরেক্ট করা হচ্ছে...", "neutral");
        if (res.redirect_url) {
          window.location.href = res.redirect_url;
          return;
        }
        router.push(`/checkout/payment-failed?order=${res.order_number}&total=${res.grand_total}`);
        return;
      }

      notify("আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে!", "success");

      // Redirect to Order Success Page for COD
      router.push(
        `/checkout/success?order=${res.order_number}&total=${res.grand_total}&method=${res.payment_method}`
      );
    } catch {
      notify("অর্ডার প্রক্রিয়াকরণে সমস্যা হয়েছে। আবার চেষ্টা করুন।", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!hydrated) {
    return <div className="min-h-[400px] flex items-center justify-center text-[18px] text-[#5B5650]">লোড হচ্ছে...</div>;
  }
  if (cart.length === 0) return null;

  return (
    <div className="min-h-screen bg-[#FBF8F1] flex flex-col font-sans">
      {/* Checkout Safety Header */}
      <CheckoutHeader />

      <main className="max-w-7xl mx-auto px-4 py-8 w-full flex-1">
        <div className="mb-6">
          <h1 className="text-[26px] sm:text-[32px] font-bold text-[#1A1A1A]">
            চেকআউট — নিরাপদ অর্ডার সম্পন্ন করুন
          </h1>
          <p className="text-[18px] text-[#5B5650] mt-1">
            আপনার নাম, ঠিকানা ও পেমেন্ট পদ্ধতি দিয়ে অর্ডার নিশ্চিত করুন
          </p>
        </div>

        {/* 2-Column Grid (Left: Checkout Form, Right: Order Summary Sidebar) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form (7 Cols) */}
          <div className="lg:col-span-7">
            <CheckoutForm
              formData={formData}
              onChange={handleFormChange}
              phoneError={phoneError}
            />
          </div>

          {/* Right Summary Sidebar (5 Cols) */}
          <div className="lg:col-span-5 lg:sticky lg:top-20">
            <CheckoutSummary
              quote={quote}
              loading={loadingQuote}
              submitting={submitting}
              couponCode={couponCode}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={handleRemoveCoupon}
              onSubmitOrder={handleSubmitOrder}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
