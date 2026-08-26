import type { Metadata } from "next";
import Link from "next/link";
import { AppImage } from "@/components/app-image";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { Lang } from "@/components/lang";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = { title: "Our story | HajjMart", description: "Learn how HajjMart supports Hajj and Umrah preparation in Bangladesh." };

const VALUES = [
  { number: "01", titleBn: "ভেবে-চিন্তে পণ্য নির্বাচন", titleEn: "Considered selection", copyBn: "ব্যবহারিক প্রয়োজন, আরাম ও ভ্রমণের উপযোগিতা দেখে পণ্য বাছাই করা হয়।", copyEn: "Products are reviewed for usefulness, comfort and travel practicality." },
  { number: "02", titleBn: "মানুষের সরাসরি সহায়তা", titleEn: "Human guidance", copyBn: "সিদ্ধান্ত নেওয়ার আগে বিকল্পগুলো তুলনা করতে আমাদের দল ক্রেতাদের সাহায্য করে।", copyEn: "Our team helps customers compare options before they make a decision." },
  { number: "03", titleBn: "সম্মানজনক সেবা", titleEn: "Respectful service", copyBn: "পরিষ্কার যোগাযোগ, যত্নশীল প্যাকেজিং ও ডেলিভারির পরেও সহায়তা।", copyEn: "Clear communication, thoughtful packaging and support after delivery." },
];

const STANDARDS = [
  { bn: "পণ্যের পরিষ্কার তথ্য ও স্বচ্ছ মূল্য", en: "Clear product information and transparent pricing" },
  { bn: "পুরুষ, নারী, শিশু ও পরিবারের জন্য উপযোগী পণ্য", en: "Selections for men, women, children and family groups" },
  { bn: "সারা দেশে ডেলিভারি ও ঢাকায় দুইটি যোগাযোগের স্থান", en: "Nationwide delivery and two Dhaka touchpoints" },
  { bn: "বাস্তব প্রস্তুতির প্রয়োজন অনুযায়ী ব্যবহারিক নির্দেশনা", en: "Guidance grounded in practical preparation" },
];

export default function AboutPage() {
  return <main>
    <section className="about-hero"><div className="about-pattern"/><div className="container-wide relative z-10 grid min-h-[620px] items-center gap-10 py-14 lg:grid-cols-[1fr_.9fr]">
      <div><p className="eyebrow text-[var(--gold-light)]"><Lang bn="আমাদের গল্প" en="Our story"/></p><h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[1.04] text-white sm:text-6xl lg:text-7xl"><Lang bn="পবিত্র যাত্রার প্রস্তুতি হোক আরও শান্ত ও সহজ।" en="A calmer way to prepare for a sacred journey."/></h1><p className="mt-6 max-w-xl text-base leading-8 text-white/65"><Lang bn="বাংলাদেশের হজ ও উমরাহ যাত্রীদের জন্য নির্ভরযোগ্য পণ্য, ব্যবহারিক তথ্য ও মানুষের সরাসরি সহায়তা এক জায়গায় নিয়ে আসে হজমার্ট।" en="HajjMart brings dependable products, practical knowledge and human support together for pilgrims across Bangladesh."/></p></div>
      <div className="relative h-[430px] overflow-hidden rounded-[2rem] bg-white/8"><AppImage src="/images/decor/madina-watercolor.jpg" alt="Madina watercolor" className="h-full w-full object-cover mix-blend-screen"/><div className="absolute inset-0 bg-gradient-to-t from-[var(--forest)]/40 to-transparent"/></div>
    </div></section>

    <section className="section-space bg-white"><div className="container-narrow"><Reveal><p className="eyebrow"><Lang bn="হজমার্ট কেন তৈরি হয়েছে" en="Why HajjMart exists"/></p><h2 className="section-title mt-3"><Lang bn="প্রস্তুতি অর্থপূর্ণ হোক—চাপের নয়।" en="Preparation should feel meaningful—not overwhelming."/></h2><div className="mt-8 grid gap-7 text-[15px] leading-8 text-[var(--muted)] md:grid-cols-2"><p><Lang bn="হজ ও উমরাহর প্রস্তুতি অনেক সময় ছড়ানো তালিকা, পণ্যের মান নিয়ে সন্দেহ এবং শেষ মুহূর্তের অসংখ্য সিদ্ধান্ত দিয়ে শুরু হয়। এই প্রক্রিয়াকে পরিষ্কার ও সহজ করতে হজমার্ট তৈরি হয়েছে—যেখানে প্রয়োজনীয় বিষয়গুলো বোঝানো ও গুছিয়ে দেওয়া হয়।" en="Hajj and Umrah preparation often begins with scattered lists, uncertain product quality and too many last-minute decisions. HajjMart was created to bring clarity to that process: one considered destination where practical needs are understood and explained."/></p><p><Lang bn="গরম, ভিড়, দীর্ঘ হাঁটা, সীমিত লাগেজ এবং গুরুত্বপূর্ণ জিনিস নিরাপদে রাখার বাস্তব প্রয়োজন বিবেচনা করে আমরা পণ্য বাছাই করি। লক্ষ্য বেশি বিক্রি করা নয়; বরং প্রতিটি যাত্রীকে সত্যিই কাজে লাগে এমন জিনিস নিতে সাহায্য করা।" en="We select products around real journey conditions—heat, crowds, long walking days, limited luggage and the need to keep important items secure. The goal is not to sell more. It is to help every pilgrim carry what genuinely helps."/></p></div></Reveal></div></section>

    <section className="section-space bg-[var(--paper)]"><div className="container-wide grid gap-8 lg:grid-cols-3">{VALUES.map(({ number, titleBn, titleEn, copyBn, copyEn }, index)=><Reveal key={number} delay={index*80}><div className="about-value"><span>{number}</span><h3><Lang bn={titleBn} en={titleEn}/></h3><p><Lang bn={copyBn} en={copyEn}/></p></div></Reveal>)}</div></section>

    <section className="section-space bg-[var(--forest)] text-white"><div className="container-wide grid items-center gap-10 lg:grid-cols-2"><Reveal><div className="relative h-[450px] overflow-hidden rounded-[2rem]"><AppImage src="/images/decor/mosque-collage.jpg" alt="Islamic architectural illustration" className="h-full w-full object-cover"/><div className="absolute inset-0 bg-[var(--forest)]/20"/></div></Reveal><Reveal delay={100}><p className="eyebrow text-[var(--gold-light)]"><Lang bn="হজমার্টের মানদণ্ড" en="The HajjMart standard"/></p><h2 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl"><Lang bn="ব্যবহারিক, সৎ এবং বাস্তব ভ্রমণের জন্য প্রস্তুত।" en="Useful, honest and ready for the reality of travel."/></h2><div className="mt-7 space-y-4">{STANDARDS.map((item)=><p key={item.en} className="flex gap-3 text-sm leading-6 text-white/68"><CheckIcon size={18} className="mt-1 shrink-0 text-[var(--gold-light)]"/><Lang bn={item.bn} en={item.en}/></p>)}</div><Link href="/shop" className="button-gold mt-9"><Lang bn="সব পণ্য দেখুন" en="Explore the collection"/><ArrowRightIcon size={17}/></Link></Reveal></div></section>
  </main>;
}
