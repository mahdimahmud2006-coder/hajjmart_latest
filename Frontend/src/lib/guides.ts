export type GuideArticle = {
  slug: string;
  eyebrow: string;
  title: string;
  summary: string;
  readTime: string;
  image: string;
  sections: Array<{ heading: string; paragraphs: string[]; bullets?: string[] }>;
};

export const guides: GuideArticle[] = [
  {
    slug: "packing-for-hajj-and-umrah-with-less-clutter",
    eyebrow: "Packing",
    title: "Pack for movement, heat and long days — not for every possibility.",
    summary: "A calmer way to build your luggage around repeat-use essentials, documents and a small comfort kit.",
    readTime: "6 min read",
    image: "/images/motion-v2/madina-golden-hour.webp",
    sections: [
      { heading: "Start with the non-negotiables", paragraphs: ["Build the bag around travel documents, prescribed medication, comfortable clothing, footwear and the items you know you will use every day. Everything else should earn its space."], bullets: ["Keep documents and essential medication in your hand luggage.", "Choose pieces that can serve more than one purpose.", "Leave room for purchases and gifts on the return journey."] },
      { heading: "Make comfort easy to reach", paragraphs: ["Crowded travel days are easier when water, a small care pouch, charging cable and a spare layer are reachable without opening the main suitcase."], bullets: ["Use one small pouch for personal care.", "Keep a refillable bottle and simple snacks accessible where permitted.", "Label luggage clearly inside and outside."] },
      { heading: "Use your official guidance", paragraphs: ["Packing is practical; ritual requirements are different. For rulings or ritual-specific questions, follow your Hajj operator, qualified scholars and the official guidance provided for your journey."] },
    ],
  },
  {
    slug: "choosing-footwear-for-long-pilgrimage-days",
    eyebrow: "Footwear",
    title: "Choose footwear for the hours you will actually spend on your feet.",
    summary: "Fit, breathability and familiarity matter more than novelty when walking becomes part of every day.",
    readTime: "4 min read",
    image: "/images/motion-v2/clocktower-clouds.jpg",
    sections: [
      { heading: "Break footwear in before travel", paragraphs: ["A comfortable pair at home can still create pressure points after several hours. Wear new footwear repeatedly before departure so you know exactly how it behaves."], bullets: ["Test it on longer walks.", "Check straps and seams for rubbing.", "Pack a familiar backup pair when possible."] },
      { heading: "Prioritise simple care", paragraphs: ["Clean, dry feet and quick attention to irritation are more useful than carrying a large collection of footwear. A small care pouch can prevent a minor problem from becoming a distraction."] },
    ],
  },
  {
    slug: "build-a-small-unscented-care-kit",
    eyebrow: "Comfort",
    title: "A compact care kit for hot, crowded travel days.",
    summary: "Keep the essentials together so small comfort needs do not turn into a search through your luggage.",
    readTime: "5 min read",
    image: "/images/motion-v2/prayer-hall-sunlight.jpg",
    sections: [
      { heading: "Keep it small and specific", paragraphs: ["A useful care kit is not a miniature bathroom cabinet. Think about what you actually reach for during heat, walking and long transfers."], bullets: ["Tissues and small wipes appropriate for your needs.", "Personal medication and basic first-aid items.", "Simple skin and foot-care items suited to your travel plan."] },
      { heading: "Check ritual-specific requirements separately", paragraphs: ["During Ihram, product suitability can matter. Confirm ritual-specific product requirements with reliable religious guidance rather than relying on packaging claims alone."] },
    ],
  },
  {
    slug: "organise-documents-before-airport-day",
    eyebrow: "Travel readiness",
    title: "Put every important document in one predictable place.",
    summary: "A simple document system reduces last-minute searching at airports, hotels and group check-ins.",
    readTime: "4 min read",
    image: "/images/motion-v2/kaaba-door-stairs.webp",
    sections: [
      { heading: "Create one travel document home", paragraphs: ["Choose one secure pouch or organiser for passports, visas, tickets, operator documents and emergency contact details. Return every document to the same place after use."], bullets: ["Keep digital copies in a secure account you can access abroad.", "Share essential itinerary details with a trusted family member.", "Carry a printed emergency contact list in case your phone is unavailable."] },
      { heading: "Separate originals from convenience copies", paragraphs: ["Originals should stay secure. Keep the copies you expect to show frequently in a separate sleeve so you do not expose or misplace the originals unnecessarily."] },
    ],
  },
];

export function getGuide(slug: string) {
  return guides.find((guide) => guide.slug === slug) || null;
}
