import Link from "next/link";
import { FacebookIcon, InstagramIcon, MailIcon, MapPinIcon, PhoneIcon } from "./icons";
import { PaymentTrustBadges } from "./payment-trust-badges";
import { Lang } from "./lang";

export function SiteFooter() {
  return (
    <footer className="footer-shell">
      <div className="footer-ornament" aria-hidden="true" />
      <div className="container-wide relative z-10 py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_.75fr_.75fr_1.15fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/brand/hajjmart-logo.svg" alt="HajjMart" className="h-14 w-auto brightness-0 invert" />
            <p className="mt-5 max-w-md text-[15px] leading-7 text-white/68"><span className="lang-bn">হজ ও উমরাহর প্রয়োজনীয় পণ্য, ব্যবহারিক তথ্য ও অর্ডার সহায়তা—বাংলাদেশের ক্রেতাদের জন্য এক জায়গায়।</span><span className="lang-en">Hajj and Umrah essentials, practical guidance and human ordering support for shoppers across Bangladesh.</span></p>
            <PaymentTrustBadges />
            <div className="mt-6 flex gap-2">
              <a href="https://www.facebook.com/hajjmartbd" target="_blank" rel="noreferrer" className="footer-social" aria-label="Facebook"><FacebookIcon size={18}/></a>
              <a href="https://www.instagram.com" target="_blank" rel="noreferrer" className="footer-social" aria-label="Instagram"><InstagramIcon size={18}/></a>
              <a href="mailto:hajjmartbd@gmail.com" className="footer-social" aria-label="Email"><MailIcon size={18}/></a>
            </div>
          </div>
          <div>
            <h3 className="footer-heading"><span className="lang-bn">কেনাকাটা</span><span className="lang-en">Explore</span></h3>
            <div className="footer-links"><Link href="/shop"><span className="lang-bn">সব পণ্য</span><span className="lang-en">Shop all</span></Link><Link href="/sale"><span className="lang-bn">সেল ও অফার</span><span className="lang-en">Sale & offers</span></Link><Link href="/category/ihram-packages"><span className="lang-bn">ইহরাম ও প্যাকেজ</span><span className="lang-en">Ihram & packages</span></Link><Link href="/build-your-package"><span className="lang-bn">নিজের হজ কিট বানান</span><span className="lang-en">Build your Hajj kit</span></Link><Link href="/faq"><span className="lang-bn">হজ গাইড</span><span className="lang-en">Pilgrim guide</span></Link></div>
          </div>
          <div>
            <h3 className="footer-heading"><span className="lang-bn">সহায়তা</span><span className="lang-en">Care</span></h3>
            <div className="footer-links"><Link href="/account"><span className="lang-bn">আমার অ্যাকাউন্ট</span><span className="lang-en">My account</span></Link><Link href="/contact"><span className="lang-bn">যোগাযোগ</span><span className="lang-en">Contact us</span></Link><Link href="/returns"><span className="lang-bn">রিটার্ন ও এক্সচেঞ্জ</span><span className="lang-en">Returns & exchange</span></Link><Link href="/privacy"><span className="lang-bn">গোপনীয়তা</span><span className="lang-en">Privacy policy</span></Link><Link href="/terms"><span className="lang-bn">শর্তাবলি</span><span className="lang-en">Terms & conditions</span></Link></div>
          </div>
          <div>
            <h3 className="footer-heading"><span className="lang-bn">হজমার্টে যোগাযোগ</span><span className="lang-en">Contact HajjMart</span></h3>
            <div className="space-y-4 text-sm leading-6 text-white/68">
              <p className="flex gap-3"><MapPinIcon className="mt-1 shrink-0 text-[var(--gold-light)]" size={18}/><span><Lang bn="সেকশন-১১, ব্লক-বি, রোড-১২, লেন-৬, পল্লবী, মিরপুর, ঢাকা ১২১৬" en="Section-11, Block-B, Road-12, Lane-6, Pallabi, Mirpur, Dhaka 1216"/></span></p>
              <p className="flex gap-3"><PhoneIcon className="mt-1 shrink-0 text-[var(--gold-light)]" size={18}/><a href="tel:+8801720601515">01720 601515</a></p>
              <p className="flex gap-3"><MailIcon className="mt-1 shrink-0 text-[var(--gold-light)]" size={18}/><a href="mailto:hajjmartbd@gmail.com">hajjmartbd@gmail.com</a></p>
              <div className="footer-support-actions"><a href="tel:+8801720601515"><span className="lang-bn">ফোনে অর্ডার</span><span className="lang-en">Call to order</span></a><a href="https://wa.me/8801720601515" target="_blank" rel="noreferrer"><Lang bn="হোয়াটসঅ্যাপ" en="WhatsApp"/></a></div>
            </div>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p><span className="lang-bn">© ২০২৬ হজমার্ট · ১৪৪৮ হিজরি · বাংলাদেশে যত্নসহকারে প্রস্তুত</span><span className="lang-en">© 2026 HajjMart · 1448H · Prepared with care in Bangladesh</span></p>
          <p><Lang bn="ট্রেড লাইসেন্স: DNCC/021873/2024" en="Trade Licence: DNCC/021873/2024"/></p>
        </div>
      </div>
    </footer>
  );
}
