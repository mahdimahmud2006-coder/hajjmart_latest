import Link from "next/link";
import { Lang } from "@/components/lang";

export default function NotFound(){
  return <main className="grid min-h-[70vh] place-items-center bg-[var(--paper)] px-5 text-center"><div><p className="font-serif text-8xl text-[var(--gold)]">404</p><h1 className="mt-4 font-serif text-4xl"><Lang bn="এই পথটি আমাদের যাত্রার অংশ নয়।" en="This path is not part of the journey."/></h1><p className="mt-3 text-sm text-[var(--muted)]"><Lang bn="পাতাটি সরানো হয়ে থাকতে পারে, অথবা পণ্যটি এখন আর পাওয়া যাচ্ছে না।" en="The page may have moved, or the product is no longer available."/></p><Link href="/shop" className="button-primary mt-7"><Lang bn="পণ্যের পাতায় ফিরুন" en="Return to the shop"/></Link></div></main>;
}
