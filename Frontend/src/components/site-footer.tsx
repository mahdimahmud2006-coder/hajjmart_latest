import Link from "next/link";
import { FacebookIcon, InstagramIcon, MailIcon, MapPinIcon, PhoneIcon } from "./icons";

export function SiteFooter() {
  return (
    <footer className="sunnah-footer">
      <div className="container-wide sunnah-footer-top">
        <div className="sunnah-footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/brand/hajjmart-logo.svg" alt="HajjMart" />
          <p>Considered Hajj and Umrah essentials, practical guidance and caring support for pilgrims across Bangladesh.</p>
          <div className="sunnah-footer-contact">
            <a href="tel:+8801720601515"><PhoneIcon size={15}/>01720 601515</a>
            <a href="mailto:hajjmartbd@gmail.com"><MailIcon size={15}/>hajjmartbd@gmail.com</a>
            <span><MapPinIcon size={15}/>Mirpur &amp; Hajj Camp, Dhaka</span>
          </div>
        </div>

        <div className="sunnah-footer-columns">
          <div><h3>Shop</h3><Link href="/shop">Shop all</Link><Link href="/shop?sort=best_selling">Best sellers</Link><Link href="/category/ihram-packages">Ihram &amp; packages</Link><Link href="/category/travel-essentials">Travel essentials</Link></div>
          <div><h3>Information</h3><Link href="/about">Our story</Link><Link href="/guides">Pilgrim journal</Link><Link href="/faq">FAQs</Link><Link href="/contact">Contact &amp; stores</Link></div>
          <div><h3>Support</h3><Link href="/see-progress">Track an order</Link><Link href="/returns">Returns &amp; exchange</Link><Link href="/account">My account</Link><Link href="/account#wishlist">Saved items</Link></div>
          <div><h3>Legal</h3><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms &amp; conditions</Link><Link href="/returns">Return policy</Link><span>Trade Licence: DNCC/021873/2024</span></div>
        </div>
      </div>

      <div className="container-wide sunnah-footer-bottom">
        <p>© 2026 HajjMart. Prepared with care in Bangladesh.</p>
        <div className="sunnah-footer-socials"><a href="https://www.facebook.com/hajjmartbd" target="_blank" rel="noreferrer" aria-label="Facebook"><FacebookIcon size={17}/></a><a href="https://www.instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><InstagramIcon size={17}/></a><a href="mailto:hajjmartbd@gmail.com" aria-label="Email"><MailIcon size={17}/></a></div>
      </div>
    </footer>
  );
}
