"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/store-context";
import { CheckoutHeader } from "@/components/checkout/checkout-header";
import { CheckoutForm, type CheckoutFormData } from "@/components/checkout/checkout-form";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";
import { quoteCheckout, placeGuestOrder, initiatePayment, type CheckoutQuoteResponse } from "@/lib/api";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, couponCode, district, clearCart, notify } = useStore();

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
  const [quote, setQuote] = useState<CheckoutQuoteResponse | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load saved form data from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hajjmart_checkout_form");
      if (saved) {
        setFormData(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Sync form district changes with store
  const handleFormChange = (updated: Partial<CheckoutFormData>) => {
    const next = { ...formData, ...updated };
    setFormData(next);
    try {
      localStorage.setItem("hajjmart_checkout_form", JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  // Redirect if cart is empty
  useEffect(() => {
    if (cart.length === 0) {
      router.push("/cart");
    }
  }, [cart, router]);

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
    })
      .then((q) => setQuote(q))
      .catch(() => setQuote(null))
      .finally(() => setLoadingQuote(false));
  }, [cart, formData.district, formData.thana, formData.paymentMethod, couponCode]);

  // Submit Order
  const handleSubmitOrder = async () => {
    // 1. Validate Required Fields
    if (!formData.customerName.trim()) {
      notify("অনুগ্রহ করে আপনার নাম লিখুন।", "error");
      return;
    }

    // 2. Validate 11-Digit BD Phone Number
    const cleanPhone = formData.mobileNumber.trim().replace(/\D/g, "");
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith("01")) {
      setPhoneError("সঠিক ১১ ডিজিটের মোবাইল নম্বর লিখুন (যেমন: 01711000111)");
      notify("সঠিক ১১ ডিজিটের মোবাইল নম্বর লিখুন।", "error");
      return;
    }
    setPhoneError(undefined);

    if (!formData.shippingAddress.trim()) {
      notify("অনুগ্রহ করে আপনার বিস্তারিত ঠিকানা লিখুন।", "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await placeGuestOrder({
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
      });

      // Clear Cart & Form Storage
      clearCart();
      try {
        localStorage.removeItem("hajjmart_checkout_form");
      } catch {
        // Ignore
      }

      if (formData.paymentMethod === "sslcommerz" || formData.paymentMethod === "stripe") {
        notify("পেমেন্ট গেটওয়েতে রিডাইরেক্ট করা হচ্ছে...", "neutral");
        try {
          const payRes = await initiatePayment(res.order_number, formData.paymentMethod);
          if (payRes.redirect_url) {
            window.location.href = payRes.redirect_url;
            return;
          }
        } catch {
          // If initiate fails, redirect to payment failed page with retry
          router.push(`/checkout/payment-failed?order=${res.order_number}&total=${res.grand_total}`);
          return;
        }
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
          <div className="lg:col-span-5 sticky top-20">
            <CheckoutSummary
              quote={quote}
              loading={loadingQuote}
              submitting={submitting}
              onSubmitOrder={handleSubmitOrder}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
