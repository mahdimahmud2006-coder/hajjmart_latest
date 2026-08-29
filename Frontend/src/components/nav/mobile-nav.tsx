"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SearchBar } from "./search-bar";
import { CategoryNav } from "./category-menu";
import { useLanguage } from "@/context/language-context";
import { useStore } from "@/context/store-context";
import { Home, Search, ShoppingBag, User, Menu, Globe, X, Heart, Bell, Truck } from "lucide-react";

export function MobileNav() {
  const pathname = usePathname();
  const { language, toggleLanguage, t } = useLanguage();
  const { cartCount, cartOpen, setCartOpen, wishlist, unreadNotificationCount, token } = useStore();
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);

  useEffect(() => {
    setIsCategoryDrawerOpen(false);
    setIsSearchOverlayOpen(false);
    setCartOpen(false);
  }, [pathname, setCartOpen]);

  const closeMobilePanels = () => {
    setIsCategoryDrawerOpen(false);
    setIsSearchOverlayOpen(false);
    setCartOpen(false);
  };

  return (
    <div className="lg:hidden">
      {/* Top Mobile Sticky Header (Height 56px) */}
      <header className="sticky top-0 z-40 bg-[#FFFDF8] border-b border-[#DDD6C7] min-h-[56px] px-2 sm:px-4 flex items-center justify-between gap-1 shadow-xs">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsCategoryDrawerOpen(true)}
            className="p-1.5 text-[#1F5D42] focus:outline-none w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0"
            aria-label="Open categories menu"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <Link href="/" className="flex items-center shrink-0" aria-label="Hajj Mart home">
            <Image
              src="/images/brand/hajjmart-logo.png"
              alt="Hajj Mart"
              width={1200}
              height={625}
              priority
              className="h-[36px] sm:h-[40px] w-auto max-w-[64px] sm:max-w-[92px] object-contain"
            />
          </Link>
        </div>

        <div className="flex items-center gap-0 sm:gap-1 shrink-0">
          {token && (
            <>
              <Link
                href="/notifications"
                onClick={closeMobilePanels}
                className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-[#1A1A1A] hover:bg-[#E4EFE8] hover:text-[#1F5D42]"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#1F5D42] text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                )}
              </Link>
              <Link
                href="/wishlist"
                onClick={closeMobilePanels}
                className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-[#1A1A1A] hover:bg-[#FEE2E2] hover:text-[#B3261E]"
                aria-label="Wishlist"
              >
                <Heart className="w-5 h-5" />
                {wishlist.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#B3261E] text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
                    {wishlist.length > 99 ? "99+" : wishlist.length}
                  </span>
                )}
              </Link>
            </>
          )}

          <Link
            href="/track-order"
            onClick={closeMobilePanels}
            className={`h-8 sm:h-9 px-1.5 sm:px-2 flex items-center justify-center gap-1 rounded-full text-[10px] sm:text-[12px] font-bold whitespace-nowrap hover:bg-[#E4EFE8] hover:text-[#1F5D42] ${
              pathname?.startsWith("/track-order") ? "text-[#1F5D42] bg-[#E4EFE8]" : "text-[#1A1A1A]"
            }`}
            aria-label={t("nav.track_order")}
            title={t("nav.track_order")}
          >
            <Truck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span>{t("nav.track_order")}</span>
          </Link>

          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-3 py-1.5 bg-[#E4EFE8] text-[#1F5D42] text-[11px] sm:text-[14px] font-bold rounded-full focus:outline-none whitespace-nowrap"
            aria-label="Toggle language"
          >
            <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{language === "bn" ? "বাং / EN" : "EN / বাং"}</span>
          </button>
        </div>
      </header>

      {/* Pinned Mobile Search Bar */}
      <div className="bg-[#FBF8F1] px-4 py-2 border-b border-[#DDD6C7]">
        <SearchBar />
      </div>

      {/* Mobile Category Drawer */}
      <CategoryNav
        isOpenMobile={isCategoryDrawerOpen}
        onCloseMobile={() => setIsCategoryDrawerOpen(false)}
      />

      {/* Mobile Search Full Overlay */}
      {isSearchOverlayOpen && (
        <div className="fixed inset-x-0 top-0 bottom-[60px] bg-[#FFFDF8] z-50 p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[#DDD6C7] pb-3">
            <span className="text-[20px] font-bold text-[#1F5D42]">পণ্য খুঁজুন</span>
            <button
              type="button"
              onClick={() => setIsSearchOverlayOpen(false)}
              className="p-2 text-[#5B5650] hover:text-[#1A1A1A]"
              aria-label="Close search overlay"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <SearchBar onSearchSubmit={() => setIsSearchOverlayOpen(false)} />
        </div>
      )}

      {/* Bottom Fixed Navigation Bar (Height 60px) */}
      <nav className="fixed bottom-0 left-0 right-0 z-[60] bg-[#FFFDF8] border-t border-[#DDD6C7] h-[60px] flex items-center justify-around shadow-[0_-4px_6px_rgba(0,0,0,0.06)]">
        {/* Anchor 1: Home */}
        <Link
          href="/"
          onClick={closeMobilePanels}
          className={`flex flex-col items-center justify-center w-full h-full text-[14px] font-bold min-w-[48px] min-h-[48px] ${
            pathname === "/" ? "text-[#1F5D42]" : "text-[#5B5650]"
          }`}
        >
          <Home className="w-6 h-6" />
          <span>{t("nav.home")}</span>
        </Link>

        {/* Anchor 2: Search */}
        <button
          type="button"
          onClick={() => {
            setCartOpen(false);
            setIsCategoryDrawerOpen(false);
            setIsSearchOverlayOpen(true);
          }}
          className={`flex flex-col items-center justify-center w-full h-full text-[14px] font-bold hover:text-[#1F5D42] focus:outline-none min-w-[48px] min-h-[48px] ${
            isSearchOverlayOpen || pathname?.startsWith("/search") ? "text-[#1F5D42]" : "text-[#5B5650]"
          }`}
        >
          <Search className="w-6 h-6" />
          <span>{t("nav.search")}</span>
        </button>

        {/* Anchor 3: Cart with Live Badge */}
        <button
          type="button"
          onClick={() => {
            setIsSearchOverlayOpen(false);
            setIsCategoryDrawerOpen(false);
            setCartOpen(true);
          }}
          className={`relative flex flex-col items-center justify-center w-full h-full text-[14px] font-bold hover:text-[#1F5D42] focus:outline-none min-w-[48px] min-h-[48px] ${
            cartOpen || pathname?.startsWith("/cart") ? "text-[#1F5D42]" : "text-[#5B5650]"
          }`}
        >
          <div className="relative">
            <ShoppingBag className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#1F5D42] text-white text-[12px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </div>
          <span>{t("nav.cart")}</span>
        </button>

        {/* Anchor 4: Account */}
        <Link
          href="/profile"
          onClick={closeMobilePanels}
          className={`flex flex-col items-center justify-center w-full h-full text-[14px] font-bold min-w-[48px] min-h-[48px] ${
            pathname?.startsWith("/profile") ? "text-[#1F5D42]" : "text-[#5B5650]"
          }`}
        >
          <User className="w-6 h-6" />
          <span>{t("nav.account")}</span>
        </Link>
      </nav>
    </div>
  );
}
