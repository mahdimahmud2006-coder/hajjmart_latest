import React from "react";
import Link from "next/link";
import { getProduct, getProducts } from "@/lib/api";
import { PDPClient } from "./pdp-client";
import { notFound } from "next/navigation";

interface PDPPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PDPPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug).catch(() => null);
  if (!product) return { title: "পণ্য পাওয়া যায়নি" };
  return {
    title: `${product.name} — হাজ্জমার্ট`,
    description: product.short_description || `${product.name} ক্রয় করুন হাজ্জমার্ট থেকে।`,
  };
}

export default async function PDPPage({ params }: PDPPageProps) {
  const { slug } = await params;

  const [product, relatedProducts] = await Promise.all([
    getProduct(slug).catch(() => null),
    getProducts({ per_page: 4 }).catch(() => []),
  ]);

  if (!product) {
    notFound();
  }

  return <PDPClient product={product} relatedProducts={relatedProducts} />;
}
