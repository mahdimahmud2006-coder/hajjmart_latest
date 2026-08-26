import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const files = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) walk(full);
  else if (entry.name.endsWith(".tsx") && !full.includes(`${path.sep}admin${path.sep}`) && !full.endsWith(`${path.sep}language-toggle.tsx`)) files.push(full);
});
walk(root);

// Bengali letters only; ignore currency/punctuation such as ৳.
const bangla = /[\u0985-\u09B9\u09CE\u09DC-\u09DF]/;
const problems = [];
for (const file of files) {
  fs.readFileSync(file, "utf8").split("\n").forEach((line, index) => {
    if (!bangla.test(line)) return;
    const cleaned = line
      .replace(/<([A-Za-z][\w.-]*)[^>]*className=["'][^"']*lang-bn[^"']*["'][^>]*>.*?<\/\1>/g, "")
      .replace(/<Lang\b[^>]*\/>/g, "")
      .replace(/localizedMessage\([^)]*\)/g, "");
    const rawJsxText = />[^<{]*[\u0985-\u09B9\u09CE\u09DC-\u09DF][^<{]*</.test(cleaned);
    const rawPlaceholder = /placeholder\s*=\s*["'][^"']*[\u0985-\u09B9\u09CE\u09DC-\u09DF]/.test(cleaned);
    if (rawJsxText || rawPlaceholder) problems.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
  });
}


// Regression guard for catalogue/home strings seen with missing *_bn API fields.
const i18nSource = fs.readFileSync(path.resolve("src/lib/i18n.ts"), "utf8");
const requiredFallbacks = {
  "Attar": "আতর",
  "Bags and Travel": "ব্যাগ ও ভ্রমণ সামগ্রী",
  "Capsule Umbrella": "ক্যাপসুল ছাতা",
  "Hajj Accessories": "হজের আনুষঙ্গিক সামগ্রী",
  "Hajj Cosmetics": "হজের প্রসাধনী",
  "Hajj Item Package": "হজ সামগ্রীর প্যাকেজ",
  "Hajj Sun Cap": "হজের রোদ-সুরক্ষা টুপি",
  "Male Umrah Ihram Essential Package": "পুরুষদের উমরাহ ইহরাম প্রয়োজনীয় প্যাকেজ",
  "Women Umrah Premium Ihram Package": "নারীদের প্রিমিয়াম উমরাহ ইহরাম প্যাকেজ",
  "Prepare with confidence": "আত্মবিশ্বাসের সাথে প্রস্তুতি নিন",
  "HajjMart curated section 06": "হজমার্টের বাছাই করা সংগ্রহ ০৬",
  "Premium essentials selected for Bangladeshi Hajj and Umrah pilgrims.": "বাংলাদেশি হজ ও উমরাহ যাত্রীদের জন্য বাছাই করা প্রিমিয়াম প্রয়োজনীয় সামগ্রী।",
};
for (const [en, bn] of Object.entries(requiredFallbacks)) {
  const mapping = `${JSON.stringify(en)}: ${JSON.stringify(bn)}`;
  if (!i18nSource.includes(mapping)) problems.push(`missing Bangla fallback: ${en}`);
}

if (problems.length) {
  console.error(`Unwrapped Bangla UI text found:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`Translation guard passed (${files.length} customer TSX files checked).`);
