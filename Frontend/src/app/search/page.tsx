import React, { Suspense } from "react";
import { CatalogView } from "@/components/catalog/catalog-view";

export const metadata = {
  title: "পণ্য অনুসন্ধান — হাজ্জমার্ট",
  description: "হাজ্জমার্ট — অনুসন্ধানের ফলাফল",
};

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[18px]">লোড হচ্ছে...</div>}>
      <CatalogView />
    </Suspense>
  );
}
