"use client";

import React from "react";
import Link from "next/link";
import { SearchBar } from "./search-bar";
import { useLanguage } from "@/context/language-context";
import { useStore } from "@/context/store-context";
import { Heart, ShoppingBag, User, Truck, Globe, Bell } from "lucide-react";

export function DesktopHeader() {
  const { language, toggleLanguage, t } = useLanguage();
  const { cartCount, wishlist, setCartOpen } = useStore();

  const wishlistCount = wishlist.length;

  return (
    <header className="hidden lg:flex items-center justify-between h-[72px] px-8 bg-[#FFFDF8] border-b border-[#DDD6C7] sticky top-0 z-40 shadow-xs">
      {/* Brand Logo */}
      <Link href="/" className="flex items-center gap-2 text-[#1F5D42] text-[24px] font-bold tracking-tight">
        <span className="bg-[#1F5D42] text-[#FFFDF8] w-10 h-10 rounded-[8px] flex items-center justify-center font-serif text-[22px]">
          হ
        </span>
        <span>হাজ্জমার্ট</span>
      </Link>

      {/* Prominent Search Bar (min-width 480px) */}
      <div className="w-[520px]">
        <SearchBar />
      </div>

      {/* Action Links & Controls */}
      <div className="flex items-center gap-6 text-[18px] font-bold text-[#1A1A1A]">
        {/* Language Toggle Pill Switch */}
        <button
          type="button"
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E4EFE8] text-[#1F5D42] rounded-full hover:bg-[#1F5D42] hover:text-white transition-colors focus:outline-none text-[16px]"
          aria-label="Toggle language"
        >
          <Globe className="w-4 h-4" />
          <span>{language === "bn" ? "বাং / EN" : "EN / বাং"}</span>
        </button>

        {/* Track Order */}
        <Link
          href="/track-order"
          className="flex items-center gap-1.5 hover:text-[#1F5D42] transition-colors"
        >
          <Truck className="w-5 h-5 text-[#1F5D42]" />
          <span>{t("nav.track_order")}</span>
        </Link>

        {/* Notifications Icon */}
        <Link
          href="/notifications"
          className="relative p-2 text-[#1A1A1A] hover:text-[#1F5D42] transition-colors flex items-center gap-1"
          aria-label="Notifications"
        >
          <Bell className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 bg-[#1F5D42] text-white text-[12px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
            1
          </span>
        </Link>

        {/* Wishlist Icon + Count Badge */}
        <Link
          href="/wishlist"
          className="relative p-2 text-[#1A1A1A] hover:text-[#1F5D42] transition-colors flex items-center gap-1"
          aria-label="Wishlist"
        >
          <Heart className="w-6 h-6" />
          {wishlistCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#B3261E] text-white text-[12px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {wishlistCount}
            </span>
          )}
        </Link>

        {/* Cart Icon + Live Count Badge */}
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="relative flex items-center gap-2.5 px-4 py-2 bg-[#1F5D42] text-white rounded-[8px] hover:bg-[#164A34] transition-colors focus:outline-none min-h-[48px]"
          aria-label="Open cart"
        >
          <ShoppingBag className="w-5 h-5" />
          <span>{t("nav.cart")}</span>
          <span className="bg-[#B8860B] text-white text-[14px] font-bold px-2 py-0.5 rounded-full">
            {cartCount}
          </span>
        </button>

        {/* Account Menu */}
        <Link
          href="/profile"
          className="flex items-center gap-1.5 hover:text-[#1F5D42] transition-colors"
        >
          <User className="w-6 h-6 text-[#1F5D42]" />
          <span>{t("nav.account")}</span>
        </Link>
      </div>
    </header>
  );
}
