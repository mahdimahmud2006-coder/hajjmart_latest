import Link from "next/link";
import { FacebookIcon, InstagramIcon, MailIcon, MapPinIcon, PhoneIcon } from "./icons";

export function SiteFooter() {
  return (
    <footer className="footer-shell">
      <div className="footer-ornament" aria-hidden="true" />
      <div className="container-wide relative z-10 py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_.75fr_.75fr_1.15fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/brand/hajjmart-logo.svg" alt="HajjMart" className="h-14 w-auto brightness-0 invert" />
            <p className="mt-5 max-w-md text-[15px] leading-7 text-white/62">Bangladesh&apos;s considered destination for Hajj and Umrah preparation—bringing quality essentials, practical guidance and caring support into one place.</p>
            <div className="mt-6 flex gap-2">
              <a href="https://www.facebook.com/hajjmartbd" target="_blank" rel="noreferrer" className="footer-social" aria-label="Facebook"><FacebookIcon size={18}/></a>
              <a href="https://www.instagram.com" target="_blank" rel="noreferrer" className="footer-social" aria-label="Instagram"><InstagramIcon size={18}/></a>
              <a href="mailto:hajjmartbd@gmail.com" className="footer-social" aria-label="Email"><MailIcon size={18}/></a>
            </div>
          </div>
          <div>
            <h3 className="footer-heading">Explore</h3>
            <div className="footer-links"><Link href="/shop">Shop all</Link><Link href="/category/ihram-packages">Ihram & packages</Link><Link href="/category/travel-essentials">Travel essentials</Link><Link href="/faq">Pilgrim guide</Link></div>
          </div>
          <div>
            <h3 className="footer-heading">Care</h3>
            <div className="footer-links"><Link href="/account">My account</Link><Link href="/contact">Contact us</Link><Link href="/returns">Returns & exchange</Link><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms & conditions</Link></div>
          </div>
          <div>
            <h3 className="footer-heading">Visit HajjMart</h3>
            <div className="space-y-4 text-sm leading-6 text-white/65">
              <p className="flex gap-3"><MapPinIcon className="mt-1 shrink-0 text-[var(--gold-light)]" size={18}/><span>Section-11, Block-B, Road-12, Lane-6, Pallabi, Mirpur, Dhaka 1216</span></p>
              <p className="flex gap-3"><PhoneIcon className="mt-1 shrink-0 text-[var(--gold-light)]" size={18}/><a href="tel:+8801720601515">01720 601515</a></p>
              <p className="flex gap-3"><MailIcon className="mt-1 shrink-0 text-[var(--gold-light)]" size={18}/><a href="mailto:hajjmartbd@gmail.com">hajjmartbd@gmail.com</a></p>
            </div>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 HajjMart. Prepared with care in Bangladesh.</p>
          <p>Trade Licence: DNCC/021873/2024</p>
        </div>
      </div>
    </footer>
  );
}
