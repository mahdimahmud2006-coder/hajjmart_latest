"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon } from "./icons";
import { Lang } from "./lang";
import { Reveal } from "./reveal";

const FAQs = [
  { qBn: "উমরাহর জন্য প্রথমে কী কিনব?", qEn: "What should I buy first for Umrah?", aBn: "প্রথমে অপরিহার্য জিনিসগুলো নিন: উপযুক্ত ইহরাম বা শালীন পোশাক, আরামদায়ক জুতা, নিরাপদ ডকুমেন্ট ব্যাগ এবং সুগন্ধিমুক্ত ব্যক্তিগত যত্নের পণ্য। সম্পূর্ণ প্যাকেজ আপনার প্রাথমিক তালিকা সহজ করতে পারে।", aEn: "Begin with the non-negotiables: suitable Ihram or modest clothing, comfortable footwear, a secure document bag and fragrance-free personal care. A complete package can simplify the first draft of your list." },
  { qBn: "ঢাকার বাইরে ডেলিভারি করেন?", qEn: "Do you deliver outside Dhaka?", aBn: "হ্যাঁ। HajjMart সারা বাংলাদেশে ডেলিভারি করে। চূড়ান্ত ডেলিভারি চার্জ ও আনুমানিক সময় চেকআউট ও অর্ডার যাচাইয়ের সময় নিশ্চিত করা হয়।", aEn: "Yes. HajjMart delivers across Bangladesh. Final delivery charge and estimated timing are confirmed during checkout and order verification." },
  { qBn: "সঠিক ইহরাম কীভাবে বাছাই করব?", qEn: "How do I choose the correct Ihram?", aBn: "আবহাওয়া, ওজন, শোষণক্ষমতা ও নিজের আরাম বিবেচনা করুন। গরমে হালকা কাপড় সহজ লাগে, আর টাওয়েল ইহরাম বেশি শোষণক্ষম ও স্থির মনে হতে পারে। অপশন তুলনা করতে আমাদের কেয়ার টিম সাহায্য করতে পারে।", aEn: "Consider climate, weight, absorbency and your own comfort. A lighter fabric is easier in hot weather, while towel Ihram can feel secure and absorbent. Our care team can help you compare options." },
  { qBn: "সাইজ বা ভ্যারিয়েশন বদলাতে পারি?", qEn: "Can I exchange a size or variation?", aBn: "HajjMart-এর রিটার্ন ও এক্সচেঞ্জ নীতির অধীনে যোগ্য, অব্যবহৃত পণ্য বদলানো যেতে পারে। প্যাকেজিং সংরক্ষণ করুন এবং ডেলিভারির পর দ্রুত দলের সাথে যোগাযোগ করুন।", aEn: "Eligible unused products can be exchanged under the HajjMart return and exchange policy. Keep the packaging and contact the team quickly after delivery." },
  { qBn: "সব কসমেটিকস কি ইহরামের সময় উপযোগী?", qEn: "Are all cosmetics suitable during Ihram?", aBn: "নিজের ধর্মীয় নির্দেশনা ও ব্যক্তিগত প্রয়োজনের সাথে মানানসই পণ্যই ব্যবহার করুন। অনেক হাজি ইহরামের সময় সুগন্ধিমুক্ত পণ্য বেছে নেন; ব্যবহারের আগে উপাদান ও সুগন্ধের তথ্য যাচাই করুন।", aEn: "Only use products that fit your own religious guidance and personal requirements. Many pilgrims choose fragrance-free products during Ihram; always verify the ingredient and scent information before use." },
  { qBn: "অ্যাকাউন্ট ছাড়া অর্ডার করা যাবে?", qEn: "Can I order without creating an account?", aBn: "হ্যাঁ। গেস্ট চেকআউট আছে। অ্যাকাউন্ট তৈরি করলে অর্ডার ট্র্যাকিং, সংরক্ষিত ঠিকানা ও ভবিষ্যতের কেনাকাটা আরও সহজ হয়।", aEn: "Yes. Guest checkout is available. Creating an account makes order tracking, saved addresses and future purchases easier." },
  { qBn: "অর্ডারের আগে কারও সাথে কথা বলব কীভাবে?", qEn: "How can I talk to someone before ordering?", aBn: "01720 601515 নম্বরে কল করুন বা মিরপুর স্টোরে আসুন। ব্যবসার সময় পণ্য বাছাইয়ে সহায়তা পাওয়া যায়।", aEn: "Call 01720 601515 or visit the Mirpur store. Product guidance is available during business hours." },
];

export function FaqList() {
  const [open, setOpen] = useState(0);
  return <div className="divide-y divide-black/10 border-y border-black/10">{FAQs.map((item, index) => <Reveal key={item.qEn} delay={index * 45}><div><button aria-expanded={open === index} onClick={() => setOpen(open === index ? -1 : index)} className="flex w-full items-center justify-between gap-5 py-5 text-left sm:py-6"><span className="font-serif text-xl sm:text-2xl"><Lang bn={item.qBn} en={item.qEn}/></span><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/12">{open === index ? <MinusIcon size={16}/> : <PlusIcon size={16}/>}</span></button><div className={`faq-answer ${open === index ? "open" : ""}`}><p className="max-w-3xl pb-6 text-sm leading-7 text-[var(--muted)]"><Lang bn={item.aBn} en={item.aEn}/></p></div></div></Reveal>)}</div>;
}
