export const LANGUAGE_KEY = "hajjmart-language-v1";
export const LANGUAGE_EVENT = "hajjmart:language";

export type Language = "bn" | "en";
export type BilingualText = { bn: string; en: string };

export const COPY: {
  personas: Record<string, BilingualText>;
  allProducts: BilingualText;
  viewAll: BilingualText;
  sort: BilingualText;
} = {
  personas: {
    men: { bn: "পুরুষ", en: "Men" },
    women: { bn: "নারী", en: "Women" },
    kids: { bn: "শিশু", en: "Kids" },
  },
  allProducts: { bn: "সব পণ্য", en: "All products" },
  viewAll: { bn: "সব দেখুন", en: "View all" },
  sort: { bn: "সাজান", en: "Sort" },
};

const EXACT_BN: Record<string, string> = {
  "HajjMart": "হজমার্ট",
  "HajjMart | Hajj & Umrah Essentials in Bangladesh": "হজমার্ট | বাংলাদেশে হজ ও উমরাহর প্রয়োজনীয় পণ্য",
  "Our story | HajjMart": "আমাদের গল্প | হজমার্ট",
  "Checkout | HajjMart": "চেকআউট | হজমার্ট",
  "Privacy policy | HajjMart": "গোপনীয়তা নীতি | হজমার্ট",
  "Contact & stores | HajjMart": "যোগাযোগ ও দোকান | হজমার্ট",
  "Shop Hajj & Umrah Essentials | HajjMart": "হজ ও উমরাহর প্রয়োজনীয় পণ্য | হজমার্ট",
  "See order progress | HajjMart": "অর্ডারের অগ্রগতি দেখুন | হজমার্ট",
  "Terms & conditions | HajjMart": "শর্তাবলি | হজমার্ট",
  "Sign in | HajjMart": "সাইন ইন | হজমার্ট",
  "My account | HajjMart": "আমার অ্যাকাউন্ট | হজমার্ট",
  "Order detail | HajjMart": "অর্ডারের বিস্তারিত | হজমার্ট",
  "Forgot password | HajjMart": "পাসওয়ার্ড ভুলে গেছেন | হজমার্ট",
  "Pilgrim guide & FAQs | HajjMart": "হজ ও উমরাহ গাইড ও প্রশ্ন | হজমার্ট",
  "Create account | HajjMart": "অ্যাকাউন্ট তৈরি করুন | হজমার্ট",
  "Sale & Offers | HajjMart": "সেল ও অফার | হজমার্ট",
  "Returns & exchange | HajjMart": "রিটার্ন ও এক্সচেঞ্জ | হজমার্ট",
  "Reset password | HajjMart": "পাসওয়ার্ড রিসেট | হজমার্ট",
  "Build your package | HajjMart": "নিজের প্যাকেজ বানান | হজমার্ট",
  "Collection | HajjMart": "সংগ্রহ | হজমার্ট",
  "Product | HajjMart": "পণ্য | হজমার্ট",
  "Prepare with confidence": "আত্মবিশ্বাসের সাথে প্রস্তুতি নিন",
  "HajjMart curated section 06": "হজমার্টের বাছাই করা সংগ্রহ ০৬",
  "Premium essentials selected for Bangladeshi Hajj and Umrah pilgrims.": "বাংলাদেশি হজ ও উমরাহ যাত্রীদের জন্য বাছাই করা প্রিমিয়াম প্রয়োজনীয় সামগ্রী।",
  "SHOP NOW": "এখনই কিনুন",
  "Shop Now": "এখনই কিনুন",
  "Shop now": "এখনই কিনুন",
  "Shop essentials": "প্রয়োজনীয় পণ্য দেখুন",
  "Easy preparation": "সহজ প্রস্তুতি",
  "Pilgrim guide": "হজ প্রস্তুতি গাইড",
  "Attar": "আতর",
  "Bags and Travel": "ব্যাগ ও ভ্রমণ সামগ্রী",
  "Bags & Travel": "ব্যাগ ও ভ্রমণ সামগ্রী",
  "Capsule Umbrella": "ক্যাপসুল ছাতা",
  "Hajj Accessories": "হজের আনুষঙ্গিক সামগ্রী",
  "Hajj Cosmetics": "হজের প্রসাধনী",
  "Hajj Item Package": "হজ সামগ্রীর প্যাকেজ",
  "Hajj Sun Cap": "হজের রোদ-সুরক্ষা টুপি",
  "Ihram & Packages": "ইহরাম ও প্যাকেজ",
  "Travel Essentials": "ভ্রমণের প্রয়োজনীয় সামগ্রী",
  "Footwear": "জুতা ও স্যান্ডেল",
  "Bags & Organisers": "ব্যাগ ও অর্গানাইজার",
  "Prayer Essentials": "নামাজের প্রয়োজনীয় সামগ্রী",
  "Sun & Weather": "রোদ ও আবহাওয়া",
  "Male Umrah Ihram Essential Package": "পুরুষদের উমরাহ ইহরাম প্রয়োজনীয় প্যাকেজ",
  "Women Umrah Premium Ihram Package": "নারীদের প্রিমিয়াম উমরাহ ইহরাম প্যাকেজ",
  "Premium Umrah Essential Package": "প্রিমিয়াম উমরাহ প্রয়োজনীয় প্যাকেজ",
  "Al Safa Royal Towel Ihram": "আল সাফা রয়্যাল তোয়ালে ইহরাম",
  "Lightweight Ihram Sandal": "হালকা ইহরাম স্যান্ডেল",
  "Anti-Theft Hajj Neck Bag": "চুরি-প্রতিরোধী হজ নেক ব্যাগ",
  "Travel Care Kit": "ভ্রমণ পরিচর্যা কিট",
  "UV50+ Head Umbrella": "UV50+ মাথার ছাতা",
  "Pocket Prayer Mat": "পকেট জায়নামাজ",
  "Foldable Travel Bottle": "ভাঁজযোগ্য ভ্রমণ বোতল",
  "Product": "পণ্য",
  "Order item": "অর্ডারের পণ্য",
  "Customer": "ক্রেতা",
  "Home": "হোম",
  "Shop": "পণ্য",
  "Bag": "কার্ট",
  "Checkout": "চেকআউট",
  "Brand": "ব্র্যান্ড",
  "Weight": "ওজন",
  "Color": "রং",
  "Colour": "রং",
  "Size": "সাইজ",
  "Material": "উপাদান",
  "Option": "অপশন",
  "Payment": "পেমেন্ট",
  "Delivery": "ডেলিভারি",
  "Subtotal": "পণ্যের মোট",
  "Discount": "ছাড়",
  "Total": "মোট",
  "Pending": "অপেক্ষমাণ",
  "Confirmed": "নিশ্চিত",
  "Processing": "প্রস্তুত হচ্ছে",
  "Shipped": "পাঠানো হয়েছে",
  "Delivered": "ডেলিভারি হয়েছে",
  "Cancelled": "বাতিল",
  "Failed": "ব্যর্থ",
  "Paid": "পরিশোধিত",
  "Unpaid": "অপরিশোধিত",
  "Cash on Delivery": "ক্যাশ অন ডেলিভারি",
  "COD": "ক্যাশ অন ডেলিভারি",
  "Nagad": "নগদ",
  "Rocket": "রকেট",
  "WhatsApp": "হোয়াটসঅ্যাপ",
  "Facebook": "ফেসবুক",
  "Instagram": "ইনস্টাগ্রাম",
  "Email": "ইমেইল",
  "SKU": "পণ্য কোড",
  "Polyester": "পলিয়েস্টার",
  "Nylon": "নাইলন",
  "Plastic": "প্লাস্টিক",
  "Rubber": "রাবার",
  "Microfiber": "মাইক্রোফাইবার",
  "Stainless steel": "স্টেইনলেস স্টিল",
  "Stainless Steel": "স্টেইনলেস স্টিল",
};

const PHRASE_BN: Array<[RegExp, string]> = [
  [/\bHajjMart\b/gi, "হজমার্ট"],
  [/\bStainless Steel\b/gi, "স্টেইনলেস স্টিল"],
  [/\bPolyester\b/gi, "পলিয়েস্টার"],
  [/\bNylon\b/gi, "নাইলন"],
  [/\bPlastic\b/gi, "প্লাস্টিক"],
  [/\bRubber\b/gi, "রাবার"],
  [/\bMicrofiber\b/gi, "মাইক্রোফাইবার"],
  [/\bBackpack\b/gi, "ব্যাকপ্যাক"],
  [/\bPillow\b/gi, "বালিশ"],
  [/\bTissue\b/gi, "টিস্যু"],
  [/\bPerfume\b/gi, "সুগন্ধি"],
  [/\bFragrance\b/gi, "সুগন্ধি"],
  [/\bComb\b/gi, "চিরুনি"],
  [/\bScissors\b/gi, "কাঁচি"],
  [/\bNail Clipper\b/gi, "নখ কাটার"],
  [/\bToiletry\b/gi, "প্রসাধন সামগ্রী"],
  [/\bwith\b/gi, "সাথে"],
  [/\bfor\b/gi, "জন্য"],
  [/\bof\b/gi, "এর"],
  [/\bHolder\b/gi, "হোল্ডার"],
  [/\bCover\b/gi, "কভার"],
  [/\bPassport\b/gi, "পাসপোর্ট"],
  [/\bDocument\b/gi, "কাগজপত্র"],
  [/\bMobile\b/gi, "মোবাইল"],
  [/\bPhone\b/gi, "ফোন"],
  [/\bNeck\b/gi, "গলার"],
  [/\bMoney\b/gi, "টাকা"],
  [/\bPersonal\b/gi, "ব্যক্তিগত"],
  [/\bCare\b/gi, "পরিচর্যা"],
  [/\bFabric\b/gi, "কাপড়"],
  [/\bReady[- ]Made\b/gi, "প্রস্তুত"],
  [/\bCash on Delivery\b/gi, "ক্যাশ অন ডেলিভারি"],
  [/\bPrayer Mat\b/gi, "জায়নামাজ"],
  [/\bNeck Bag\b/gi, "নেক ব্যাগ"],
  [/\bHead Umbrella\b/gi, "মাথার ছাতা"],
  [/\bTravel Bottle\b/gi, "ভ্রমণ বোতল"],
  [/\bTravel Care Kit\b/gi, "ভ্রমণ পরিচর্যা কিট"],
  [/\bAnti[- ]Theft\b/gi, "চুরি-প্রতিরোধী"],
  [/\bFragrance[- ]Free\b/gi, "সুগন্ধিবিহীন"],
  [/\bShoe Bag\b/gi, "জুতার ব্যাগ"],
  [/\bLuggage Bag\b/gi, "লাগেজ ব্যাগ"],
  [/\bWater Spray Bottle\b/gi, "পানি স্প্রে বোতল"],
  [/\bGuide Book\b/gi, "গাইড বই"],
  [/\bDua Booklet\b/gi, "দোয়ার বই"],
  [/\bMale\b/gi, "পুরুষদের"],
  [/\bMen(?:'s)?\b/gi, "পুরুষদের"],
  [/\bFemale\b/gi, "নারীদের"],
  [/\bWomen(?:'s)?\b/gi, "নারীদের"],
  [/\bWoman\b/gi, "নারী"],
  [/\bLadies\b/gi, "নারীদের"],
  [/\bKids?\b/gi, "শিশুদের"],
  [/\bChildren\b/gi, "শিশুদের"],
  [/\bChild\b/gi, "শিশু"],
  [/\bUnisex\b/gi, "সবার জন্য"],
  [/\bPremium\b/gi, "প্রিমিয়াম"],
  [/\bCurated\b/gi, "বাছাই করা"],
  [/\bSection\b/gi, "সংগ্রহ"],
  [/\bCollection\b/gi, "সংগ্রহ"],
  [/\bPrepare\b/gi, "প্রস্তুতি"],
  [/\bConfidence\b/gi, "আত্মবিশ্বাস"],
  [/\bDeluxe\b/gi, "ডিলাক্স"],
  [/\bClassic\b/gi, "ক্লাসিক"],
  [/\bBasic\b/gi, "সাধারণ"],
  [/\bRoyal\b/gi, "রয়্যাল"],
  [/\bLightweight\b/gi, "হালকা"],
  [/\bFoldable\b/gi, "ভাঁজযোগ্য"],
  [/\bHajj\b/gi, "হজ"],
  [/\bUmrah\b/gi, "উমরাহ"],
  [/\bIhram\b/gi, "ইহরাম"],
  [/\bEssential(?:s)?\b/gi, "প্রয়োজনীয়"],
  [/\bPackage(?:s)?\b/gi, "প্যাকেজ"],
  [/\bBundle(?:s)?\b/gi, "প্যাকেজ"],
  [/\bKit(?:s)?\b/gi, "কিট"],
  [/\bAccessories\b/gi, "আনুষঙ্গিক সামগ্রী"],
  [/\bCosmetics\b/gi, "প্রসাধনী"],
  [/\bItems?\b/gi, "সামগ্রী"],
  [/\bProducts?\b/gi, "পণ্য"],
  [/\bAttar\b/gi, "আতর"],
  [/\bCapsule\b/gi, "ক্যাপসুল"],
  [/\bUmbrella\b/gi, "ছাতা"],
  [/\bSun\b/gi, "রোদ"],
  [/\bCap\b/gi, "টুপি"],
  [/\bBags?\b/gi, "ব্যাগ"],
  [/\bTravel\b/gi, "ভ্রমণ"],
  [/\bOrganisers?\b/gi, "অর্গানাইজার"],
  [/\bOrganizers?\b/gi, "অর্গানাইজার"],
  [/\bFootwear\b/gi, "জুতা ও স্যান্ডেল"],
  [/\bSandals?\b/gi, "স্যান্ডেল"],
  [/\bSlippers?\b/gi, "স্লিপার"],
  [/\bShoes?\b/gi, "জুতা"],
  [/\bPrayer\b/gi, "নামাজের"],
  [/\bTowel\b/gi, "তোয়ালে"],
  [/\bBelt\b/gi, "বেল্ট"],
  [/\bCotton\b/gi, "কটন"],
  [/\bWhite\b/gi, "সাদা"],
  [/\bBlack\b/gi, "কালো"],
  [/\bLeather\b/gi, "চামড়া"],
  [/\bLuggage\b/gi, "লাগেজ"],
  [/\bBottle\b/gi, "বোতল"],
  [/\bSoap\b/gi, "সাবান"],
  [/\bVaseline\b/gi, "ভ্যাসলিন"],
  [/\bMiswak\b/gi, "মিসওয়াক"],
  [/\bTasbih\b/gi, "তাসবিহ"],
  [/\bDua\b/gi, "দোয়া"],
  [/\bBooklet\b/gi, "বই"],
  [/\bGuide\b/gi, "গাইড"],
  [/\bWater\b/gi, "পানি"],
  [/\bSpray\b/gi, "স্প্রে"],
  [/\bStickers?\b/gi, "স্টিকার"],
  [/\bSet\b/gi, "সেট"],
  [/\bGift\b/gi, "উপহার"],
  [/\bMask\b/gi, "মাস্ক"],
  [/\bSocks?\b/gi, "মোজা"],
  [/\bWaist\b/gi, "কোমরের"],
  [/\bPouch\b/gi, "থলি"],
  [/\bkg\b/gi, "কেজি"],
  [/\bpcs?\b/gi, "টি"],
  [/\bpieces?\b/gi, "টি"],
  [/\bSize\b/gi, "সাইজ"],
  [/\bColor\b/gi, "রং"],
  [/\bColour\b/gi, "রং"],
  [/\bBrand\b/gi, "ব্র্যান্ড"],
];

const DISTRICTS_BN: Record<string, string> = {
  Bagerhat: "বাগেরহাট", Bandarban: "বান্দরবান", Barguna: "বরগুনা", Barishal: "বরিশাল", Bhola: "ভোলা", Bogura: "বগুড়া", Brahmanbaria: "ব্রাহ্মণবাড়িয়া", Chandpur: "চাঁদপুর", "Chapai Nawabganj": "চাঁপাইনবাবগঞ্জ", Chattogram: "চট্টগ্রাম", Chuadanga: "চুয়াডাঙ্গা", Comilla: "কুমিল্লা", "Cox's Bazar": "কক্সবাজার", Dhaka: "ঢাকা", Dinajpur: "দিনাজপুর", Faridpur: "ফরিদপুর", Feni: "ফেনী", Gaibandha: "গাইবান্ধা", Gazipur: "গাজীপুর", Gopalganj: "গোপালগঞ্জ", Habiganj: "হবিগঞ্জ", Jamalpur: "জামালপুর", Jashore: "যশোর", Jhalokati: "ঝালকাঠি", Jhenaidah: "ঝিনাইদহ", Joypurhat: "জয়পুরহাট", Khagrachhari: "খাগড়াছড়ি", Khulna: "খুলনা", Kishoreganj: "কিশোরগঞ্জ", Kurigram: "কুড়িগ্রাম", Kushtia: "কুষ্টিয়া", Lakshmipur: "লক্ষ্মীপুর", Lalmonirhat: "লালমনিরহাট", Madaripur: "মাদারীপুর", Magura: "মাগুরা", Manikganj: "মানিকগঞ্জ", Meherpur: "মেহেরপুর", Moulvibazar: "মৌলভীবাজার", Munshiganj: "মুন্সিগঞ্জ", Mymensingh: "ময়মনসিংহ", Naogaon: "নওগাঁ", Narail: "নড়াইল", Narayanganj: "নারায়ণগঞ্জ", Narsingdi: "নরসিংদী", Natore: "নাটোর", Netrokona: "নেত্রকোনা", Nilphamari: "নীলফামারী", Noakhali: "নোয়াখালী", Pabna: "পাবনা", Panchagarh: "পঞ্চগড়", Patuakhali: "পটুয়াখালী", Pirojpur: "পিরোজপুর", Rajbari: "রাজবাড়ী", Rajshahi: "রাজশাহী", Rangamati: "রাঙামাটি", Rangpur: "রংপুর", Satkhira: "সাতক্ষীরা", Shariatpur: "শরীয়তপুর", Sherpur: "শেরপুর", Sirajganj: "সিরাজগঞ্জ", Sunamganj: "সুনামগঞ্জ", Sylhet: "সিলেট", Tangail: "টাঙ্গাইল", Thakurgaon: "ঠাকুরগাঁও",
};

export function banglaPlaceName(value: string): string {
  return DISTRICTS_BN[value] || value;
}

export function hasBangla(value: string): boolean {
  return /[\u0980-\u09FF]/.test(value);
}

export function banglaFallback(value: string): string {
  const source = value.trim();
  if (!source || hasBangla(source)) return source;
  const exact = EXACT_BN[source] || EXACT_BN[source.replace(/\s+/g, " ")];
  if (exact) return exact;

  // Product/category names are short, noun-heavy strings. Translating common HajjMart
  // vocabulary here prevents an incomplete API `*_bn` field from leaking English into
  // Bangla mode, while deliberately avoiding pretend machine-translation of long prose.
  if (source.length > 120 || /[.!?]\s/.test(source)) return source;

  let translated = source;
  for (const [pattern, replacement] of PHRASE_BN) translated = translated.replace(pattern, replacement);
  translated = translated.replace(/\s*&\s*/g, " ও ").replace(/\s+and\s+/gi, " ও ").replace(/\s{2,}/g, " ").trim();
  if (translated !== source && hasBangla(translated)) translated = translated.replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);
  return translated;
}

export function currentLanguage(): Language {
  if (typeof document === "undefined") return "bn";
  return document.documentElement.dataset.language === "en" ? "en" : "bn";
}

export function localizedField<T>(bn: T | null | undefined, en: T): T {
  if (currentLanguage() !== "bn") return en;
  if (bn != null && !(typeof bn === "string" && (!bn.trim() || !hasBangla(bn) || (typeof en === "string" && bn.trim() === en.trim())))) return bn;
  return (typeof en === "string" ? banglaFallback(en) : en) as T;
}
