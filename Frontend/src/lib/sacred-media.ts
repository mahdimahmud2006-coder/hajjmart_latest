export type SacredHeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  poster: string;
  video: string;
  thumb: string;
  meta: string[];
};

export const sacredHeroSlides: SacredHeroSlide[] = [
  {
    id: "passage",
    eyebrow: "HajjMart · prepared with intention",
    title: "Preparation that moves with the journey.",
    description:
      "A more cinematic way to shop Hajj and Umrah essentials — grounded in useful products, clear guidance and the same dependable HajjMart checkout, account and order-tracking experience.",
    ctaLabel: "Shop essentials",
    ctaHref: "/shop",
    secondaryLabel: "Explore the journal",
    secondaryHref: "/guides",
    poster: "/images/motion-v2/kaaba-birds.jpg",
    video: "/videos/motion-v2/sacred-passage.mp4",
    thumb: "/images/motion-v2/pilgrim-passage.jpg",
    meta: ["Nationwide delivery", "Retail & wholesale", "Support before and after purchase"],
  },
  {
    id: "architecture",
    eyebrow: "Sacred places · practical preparation",
    title: "A storefront with atmosphere, not clutter.",
    description:
      "Rich imagery, motion and editorial pacing now sit around your real catalogue — so browsing feels considered while product discovery, wishlist, cart and checkout stay familiar.",
    ctaLabel: "Browse best sellers",
    ctaHref: "/shop?sort=best_selling",
    secondaryLabel: "See order progress",
    secondaryHref: "/see-progress",
    poster: "/images/motion-v2/madina-sunset.jpg",
    video: "/videos/motion-v2/sacred-architecture.mp4",
    thumb: "/images/motion-v2/clocktower-clouds.jpg",
    meta: ["Motion-led storytelling", "Fast catalogue access", "Faithful HajjMart functionality"],
  },
];

export const sacredQuickLinks = [
  { label: "Ihram essentials", href: "/shop?q=ihram", image: "/images/motion-v2/pilgrim-passage.jpg", caption: "Comfort, simplicity and ritual readiness" },
  { label: "Travel & luggage", href: "/shop?q=travel", image: "/images/motion-v2/clocktower-clouds.jpg", caption: "For airports, transfers and long days" },
  { label: "Prayer & reflection", href: "/shop?q=dua", image: "/images/motion-v2/prayer-hall-sunlight.jpg", caption: "Books, tasbih and thoughtful devotional pieces" },
  { label: "Homecoming gifts", href: "/shop?q=gift", image: "/images/motion-v2/madina-golden-hour.webp", caption: "Meaningful pieces to bring home" },
];

export const sacredGalleryCards = [
  {
    eyebrow: "Motion study 01",
    title: "The passage",
    copy: "A cinematic sequence built from your Kaaba, pilgrim and Madina references, designed to create movement without overwhelming the commerce experience.",
    type: "video" as const,
    media: "/videos/motion-v2/sacred-passage.mp4",
    poster: "/images/motion-v2/kaaba-birds.jpg",
    href: "/shop?sort=best_selling",
    cta: "Shop the HajjMart edit",
  },
  {
    eyebrow: "Quiet detail",
    title: "Light, architecture and reflection",
    copy: "Editorial imagery breaks up product blocks and creates a slower visual rhythm between buying decisions.",
    type: "image" as const,
    media: "/images/motion-v2/prayer-hall-sunlight.jpg",
    poster: "",
    href: "/guides",
    cta: "Read preparation guides",
  },
  {
    eyebrow: "Motion study 02",
    title: "Sacred architecture",
    copy: "Clocktower mist, Madina sunset and prayer-space light are sequenced into a second ambient motion chapter.",
    type: "video" as const,
    media: "/videos/motion-v2/sacred-architecture.mp4",
    poster: "/images/motion-v2/madina-sunset.jpg",
    href: "/shop",
    cta: "Browse all essentials",
  },
  {
    eyebrow: "Thresholds",
    title: "A visual pause before the next decision",
    copy: "Rich doorway and textile detail becomes a visual reset between catalogue sections, rather than decorative noise.",
    type: "image" as const,
    media: "/images/motion-v2/kaaba-door-stairs.webp",
    poster: "",
    href: "/about",
    cta: "Discover HajjMart",
  },
];
