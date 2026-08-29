"use client";

import React from "react";
import { DesktopHeader } from "./desktop-header";
import { MobileNav } from "./mobile-nav";
import { CategoryNav } from "./category-menu";

export function StorefrontHeader() {
  return (
    <>
      {/* Desktop Navigation Header */}
      <DesktopHeader />
      <CategoryNav />

      {/* Mobile Navigation Header & Bottom Fixed Bar */}
      <MobileNav />
    </>
  );
}
