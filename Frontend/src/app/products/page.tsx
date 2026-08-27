import React, { Suspense } from "react";
import { CatalogView } from "@/components/catalog/catalog-view";

export const metadata = {
  title: "সকল হজ্জ ও ওমরাহ সামগ্রী",
  description: "হাজ্জমার্ট — বাংলাদেশে হজ্জ ও ওমরাহ সামগ্রী, ইহরাম কাপড়, বেল্ট, জুতা ও ইসলামিক পণ্য।",
};

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[18px]">লোড হচ্ছে...</div>}>
      <CatalogView />
    </Suspense>
  );
}
