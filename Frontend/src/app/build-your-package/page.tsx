import type { Metadata } from "next";
import { PackageBuilder } from "@/components/package-builder";
import { getProducts } from "@/lib/api";

export const metadata: Metadata = {
  title: "Build Your Hajj Kit | HajjMart",
  description: "Build a practical Hajj or Umrah kit step by step with guided product choices and phone support.",
};

export default async function BuildYourPackagePage() {
  const products = await getProducts({ per_page: 48, sort: "best_selling" });
  return (
    <main className="package-builder-page">
      <section className="package-builder-hero">
        <div className="container-wide py-14 sm:py-20">
          <p className="eyebrow text-[var(--gold-light)]"><span className="lang-bn">কী কী লাগবে?</span><span className="lang-en">What do I need?</span></p>
          <h1><span className="lang-bn">নিজের হজ কিট ধাপে ধাপে তৈরি করুন।</span><span className="lang-en">Build your Hajj kit, one simple step at a time.</span></h1>
          <p><span className="lang-bn">পণ্যের নাম জানা দরকার নেই। প্রতিটি ধাপে সহজ প্রশ্নের উত্তর দিন, প্রয়োজনীয় জিনিস বাছুন, আর সন্দেহ হলে এক ট্যাপে ফোন করুন।</span><span className="lang-en">You do not need to know product jargon. Follow the simple questions, choose what fits, and call us any time you are unsure.</span></p>
        </div>
      </section>
      <section className="container-wide py-10 sm:py-14"><PackageBuilder products={products}/></section>
    </main>
  );
}
