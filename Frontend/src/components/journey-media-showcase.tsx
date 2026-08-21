import Link from "next/link";
import { sacredGalleryCards } from "@/lib/sacred-media";
import { AppImage } from "./app-image";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./reveal";

export function JourneyMediaShowcase() {
  return (
    <section className="journey-media-section section-space">
      <div className="container-wide">
        <Reveal>
          <div className="journey-media-heading">
            <div className="max-w-2xl">
              <p className="eyebrow">Cinematic storytelling</p>
              <h2 className="section-title mt-3">Bring your sacred references into the storefront, not just the background.</h2>
              <p className="section-copy mt-4">
                Your uploaded Madina, Kaaba, lantern and calligraphy visuals now drive a richer homepage rhythm with autoplay motion reels and editorial image placements.
              </p>
            </div>
            <Link href="/shop" className="text-link">Shop the full catalogue<ArrowRightIcon size={16} /></Link>
          </div>
        </Reveal>

        <div className="journey-media-grid">
          {sacredGalleryCards.map((card, index) => (
            <Reveal key={`${card.title}-${index}`} delay={index * 55}>
              <article className={`journey-media-card ${card.type === "video" ? "is-video" : "is-image"}`}>
                <div className="journey-media-visual">
                  {card.type === "video" ? (
                    <video
                      className="journey-media-video"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      poster={card.poster}
                    >
                      <source src={card.media} type="video/mp4" />
                    </video>
                  ) : (
                    <AppImage src={card.media} alt={card.title} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="journey-media-copy">
                  <span>{card.eyebrow}</span>
                  <h3>{card.title}</h3>
                  <p>{card.copy}</p>
                  <Link href={card.href}>{card.cta}<ArrowRightIcon size={15} /></Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
