"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchBar } from "./search-bar";
import { CategoryNav } from "./category-menu";
import { useLanguage } from "@/context/language-context";
import { useStore } from "@/context/store-context";
import { Home, Search, ShoppingBag, User, Menu, Globe, X } from "lucide-react";

export function MobileNav() {
  const pathname = usePathname();
  const { language, toggleLanguage, t } = useLanguage();
  const { cartCount, setCartOpen } = useStore();
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);

  return (
    <div className="lg:hidden">
      {/* Top Mobile Sticky Header (Height 56px) */}
      <header className="sticky top-0 z-40 bg-[#FFFDF8] border-b border-[#DDD6C7] h-[56px] px-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCategoryDrawerOpen(true)}
            className="p-2 text-[#1F5D42] focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Open categories menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <Link href="/" className="flex items-center gap-1.5 text-[#1F5D42] font-bold text-[20px]">
            <span className="bg-[#1F5D42] text-white w-8 h-8 rounded-[6px] flex items-center justify-center font-serif text-[18px]">
              হ
            </span>
            <span>হাজ্জমার্ট</span>
          </Link>
        </div>

        {/* Language Switcher */}
        <button
          type="button"
          onClick={toggleLanguage}
          className="flex items-center gap-1 px-3 py-1 bg-[#E4EFE8] text-[#1F5D42] text-[14px] font-bold rounded-full focus:outline-none"
          aria-label="Toggle language"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{language === "bn" ? "বাং / EN" : "EN / বাং"}</span>
        </button>
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
        <div className="fixed inset-0 bg-[#FFFDF8] z-50 p-4 flex flex-col gap-4">
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
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFFDF8] border-t border-[#DDD6C7] h-[60px] flex items-center justify-around shadow-[0_-4px_6px_rgba(0,0,0,0.06)]">
        {/* Anchor 1: Home */}
        <Link
          href="/"
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
          onClick={() => setIsSearchOverlayOpen(true)}
          className="flex flex-col items-center justify-center w-full h-full text-[14px] font-bold text-[#5B5650] hover:text-[#1F5D42] focus:outline-none min-w-[48px] min-h-[48px]"
        >
          <Search className="w-6 h-6" />
          <span>{t("nav.search")}</span>
        </button>

        {/* Anchor 3: Cart with Live Badge */}
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="relative flex flex-col items-center justify-center w-full h-full text-[14px] font-bold text-[#5B5650] hover:text-[#1F5D42] focus:outline-none min-w-[48px] min-h-[48px]"
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
