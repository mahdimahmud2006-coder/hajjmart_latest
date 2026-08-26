import Link from "next/link";
import { Lang } from "./lang";

type Copy = { bn: string; en: string };
type PolicySection = { title: Copy; paragraphs: Copy[]; bullets?: Copy[] };

export function PolicyPage({ eyebrow, title, intro, sections }: { eyebrow: Copy; title: Copy; intro: Copy; sections: PolicySection[] }) {
  return <main className="policy-page">
    <section className="policy-hero-strip">
      <div className="policy-hero-pattern"/>
      <div className="container-narrow relative z-10 py-10 sm:py-12">
        <p className="eyebrow"><Lang bn={eyebrow.bn} en={eyebrow.en}/></p>
        <h1 className="mt-3 font-serif text-5xl leading-tight sm:text-6xl"><Lang bn={title.bn} en={title.en}/></h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)]"><Lang bn={intro.bn} en={intro.en}/></p>
      </div>
    </section>
    <section className="container-narrow py-12 sm:py-16">
      <div className="policy-body">{sections.map((section)=><section key={section.title.en}><h2><Lang bn={section.title.bn} en={section.title.en}/></h2>{section.paragraphs.map(paragraph=><p key={paragraph.en}><Lang bn={paragraph.bn} en={paragraph.en}/></p>)}{section.bullets ? <ul>{section.bullets.map(item=><li key={item.en}><Lang bn={item.bn} en={item.en}/></li>)}</ul> : null}</section>)}</div>
      <div className="mt-12 rounded-2xl bg-white p-6 text-sm leading-6 text-[var(--muted)]"><Lang bn="কোনো বিষয় পরিষ্কার করতে চান? যোগাযোগ করুন" en="Need clarification? Contact"/> <a href="mailto:hajjmartbd@gmail.com" className="font-semibold text-[var(--forest)]">hajjmartbd@gmail.com</a> <Lang bn="অথবা" en="or"/> <Link href="/contact" className="font-semibold text-[var(--forest)] underline"><Lang bn="বার্তা পাঠান" en="send a message"/></Link>।</div>
    </section>
  </main>;
}
