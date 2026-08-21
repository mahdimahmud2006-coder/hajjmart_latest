import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/lib/guides";
import { AppImage } from "@/components/app-image";
import { ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Preparation guides | HajjMart",
  description: "Practical Hajj and Umrah preparation notes from HajjMart: packing, footwear, travel organisation and comfort.",
};

export default function GuidesPage() {
  return (
    <main className="bg-[var(--paper)]">
      <section className="container-wide py-14 sm:py-20">
        <div className="max-w-3xl"><p className="eyebrow">Prepare with intention</p><h1 className="mt-3 font-serif text-5xl leading-tight sm:text-7xl">Practical guidance for a clearer journey.</h1><p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">Short reads on packing, travel readiness and everyday comfort. For ritual-specific rulings, always follow reliable religious guidance and your official Hajj or Umrah operator.</p></div>
        <div className="guide-index-grid mt-12">
          {guides.map((guide) => <article key={guide.slug} className="guide-index-card group"><Link href={`/guides/${guide.slug}`} className="guide-index-image"><AppImage src={guide.image} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]"/></Link><div><p className="eyebrow">{guide.eyebrow}</p><h2><Link href={`/guides/${guide.slug}`}>{guide.title}</Link></h2><p>{guide.summary}</p><Link href={`/guides/${guide.slug}`} className="text-link mt-5">Read guide<ArrowRightIcon size={15}/></Link></div></article>)}
        </div>
      </section>
    </main>
  );
}
