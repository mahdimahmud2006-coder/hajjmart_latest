import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuide, guides } from "@/lib/guides";
import { AppImage } from "@/components/app-image";
import { ArrowLeftIcon } from "@/components/icons";

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  return { title: guide ? `${guide.title} | HajjMart` : "Guide | HajjMart", description: guide?.summary || "HajjMart preparation guide." };
}

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  return (
    <main className="bg-[var(--paper)]">
      <article className="guide-detail">
        <header className="container-wide grid gap-8 py-12 sm:py-16 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div><Link href="/guides" className="text-link"><ArrowLeftIcon size={15}/>All guides</Link><p className="eyebrow mt-9">{guide.eyebrow}</p><h1 className="mt-3 font-serif text-5xl leading-[1.03] sm:text-6xl">{guide.title}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">{guide.summary}</p><p className="mt-6 text-xs font-semibold uppercase tracking-[.18em] text-[var(--gold-dark)]">{guide.readTime}</p></div>
          <div className="guide-detail-hero"><AppImage src={guide.image} alt="" className="h-full w-full object-cover"/></div>
        </header>
        <div className="container-narrow pb-16 sm:pb-24">
          <div className="guide-detail-body">
            {guide.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}</section>)}
          </div>
          <aside className="guide-disclaimer"><strong>Preparation note</strong><p>HajjMart&apos;s guides cover practical travel preparation. For ritual rulings, health decisions or official travel requirements, use qualified religious, medical and government guidance appropriate to your journey.</p></aside>
        </div>
      </article>
    </main>
  );
}
