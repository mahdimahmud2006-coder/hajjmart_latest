import Link from "next/link";
import { guides } from "@/lib/guides";
import { AppImage } from "./app-image";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./reveal";

export function EditorialRail() {
  return (
    <section className="editorial-rail-section section-space bg-white">
      <div className="container-wide">
        <Reveal>
          <div className="editorial-rail-heading">
            <div className="max-w-2xl"><p className="eyebrow">Prepare with intention</p><h2 className="section-title mt-3">Useful reading before the journey.</h2><p className="section-copy mt-4">Short, practical preparation notes designed to make decisions clearer before departure.</p></div>
            <Link href="/guides" className="text-link">All preparation guides<ArrowRightIcon size={16}/></Link>
          </div>
        </Reveal>
        <div className="editorial-rail editorial-accordion-rail">
          {guides.map((guide, index) => (
            <Reveal key={guide.slug} delay={index * 85} className="editorial-reveal editorial-accordion-panel">
              <article className="editorial-card group">
                <Link href={`/guides/${guide.slug}`} className="editorial-card-image"><AppImage src={guide.image} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]"/></Link>
                <div className="editorial-card-copy"><p className="eyebrow">{guide.eyebrow}</p><h3><Link href={`/guides/${guide.slug}`}>{guide.title}</Link></h3><p>{guide.summary}</p><span>{guide.readTime}</span></div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
