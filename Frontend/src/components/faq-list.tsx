"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon } from "./icons";

const FAQs = [
  ["What should I buy first for Umrah?", "Begin with the non-negotiables: suitable Ihram or modest clothing, comfortable footwear, a secure document bag and fragrance-free personal care. A complete package can simplify the first draft of your list."],
  ["Do you deliver outside Dhaka?", "Yes. HajjMart delivers across Bangladesh. Final delivery charge and estimated timing are confirmed during checkout and order verification."],
  ["How do I choose the correct Ihram?", "Consider climate, weight, absorbency and your own comfort. A lighter fabric is easier in hot weather, while towel Ihram can feel secure and absorbent. Our care team can help you compare options."],
  ["Can I exchange a size or variation?", "Eligible unused products can be exchanged under the HajjMart return and exchange policy. Keep the packaging and contact the team quickly after delivery."],
  ["Are all cosmetics suitable during Ihram?", "Only use products that fit your own religious guidance and personal requirements. Many pilgrims choose fragrance-free products during Ihram; always verify the ingredient and scent information before use."],
  ["Can I order without creating an account?", "Yes. Guest checkout is available. Creating an account makes order tracking, saved addresses and future purchases easier."],
  ["How can I talk to someone before ordering?", "Call 01720 601515 or visit the Mirpur store. Product guidance is available during business hours."],
];

export function FaqList() {
  const [open, setOpen] = useState(0);
  return <div className="divide-y divide-black/10 border-y border-black/10">{FAQs.map(([question, answer], index) => <div key={question}><button onClick={() => setOpen(open === index ? -1 : index)} className="flex w-full items-center justify-between gap-5 py-5 text-left sm:py-6"><span className="font-serif text-xl sm:text-2xl">{question}</span><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/12">{open === index ? <MinusIcon size={16}/> : <PlusIcon size={16}/>}</span></button><div className={`faq-answer ${open === index ? "open" : ""}`}><p className="max-w-3xl pb-6 text-sm leading-7 text-[var(--muted)]">{answer}</p></div></div>)}</div>;
}
