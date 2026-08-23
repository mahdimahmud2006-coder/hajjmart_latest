import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require("typescript");
} catch {
  ts = require(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "typescript"));
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const files = [
  "src/components/admin/admin-shell.tsx",
  "src/components/admin/customer-lookup.tsx",
  "src/app/admin/(panel)/customers/page.tsx",
  "src/app/admin/(panel)/social-commerce/page.tsx",
  "src/app/admin/(panel)/products/page.tsx",
  "src/app/admin/(panel)/orders/page.tsx",
  "src/lib/admin-demo.ts",
  "src/lib/admin-types.ts",
  "src/lib/admin-i18n.ts",
];

for (const relative of files) {
  const source = read(relative);
  const result = ts.transpileModule(source, {
    fileName: relative,
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const errors = (result.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  assert(errors.length === 0, `${relative} has TypeScript syntax diagnostics.`);
}

const shell = read("src/components/admin/admin-shell.tsx");
assert(shell.includes("Promise.all(["), "Global search must fan out concurrently.");
for (const endpoint of ["/orders", "/customers", "/products"]) assert(shell.includes(endpoint), `Global search is missing ${endpoint}.`);
for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) assert(shell.includes(key), `Global search is missing ${key} keyboard behavior.`);
assert(shell.includes('event.key === "/"') && shell.includes('event.key.toLowerCase() === "k"'), "Global search shortcuts are missing.");
assert(shell.includes("/admin/orders?order="), "Order search results must deep-link to a real order.");
assert(shell.includes("/admin/customers?customer="), "Customer search results must deep-link to a real customer.");
assert(shell.includes("/admin/products?product="), "Product search results must deep-link to a real product.");
assert(shell.includes("AbortController"), "Global search must cancel stale requests.");

const lookup = read("src/components/admin/customer-lookup.tsx");
assert(lookup.includes("275"), "Customer lookup debounce should stay within the PRD target.");
assert(lookup.includes('inputMode="numeric"') && lookup.includes('type="tel"'), "Customer lookup must use the phone keypad path.");
assert(lookup.includes("/customers") && lookup.includes("AbortController"), "Customer lookup must use the customer endpoint and cancel stale requests.");
assert(lookup.includes('t("lookup.error")'), "Customer lookup failure must remain plain-language and non-blocking.");

const customers = read("src/app/admin/(panel)/customers/page.tsx");
for (const contract of ["<DataList", "<Sheet", "<SearchField", "/admin/social-commerce?customer=", "?customer"]) assert(customers.includes(contract), `Customers page is missing ${contract}.`);
assert(customers.includes('desktop={') && customers.includes('mobile={'), "Customers page must use responsive desktop/mobile data views.");

const social = read("src/app/admin/(panel)/social-commerce/page.tsx");
assert(social.includes('searchParams.get("customer")'), "Social Order must accept a customer deep link.");
assert(social.includes("<CustomerLookup") && social.includes("customer_id"), "Social Order must use shared lookup and preserve registered customer ID when selected.");

const products = read("src/app/admin/(panel)/products/page.tsx");
assert(products.includes('searchParams.get("product")'), "Products must support global-search deep links.");

const orders = read("src/app/admin/(panel)/orders/page.tsx");
assert(orders.includes('searchParams.get("open")') && orders.includes('`/orders/${id}`'), "Orders must fetch a deep-linked result even when it is outside the current list page.");

const i18n = read("src/lib/admin-i18n.ts");
for (const key of ["customers.title", "customers.detailError", "customers.createForCustomer", "search.placeholder", "search.error", "lookup.error"]) {
  const occurrences = i18n.split(`"${key}"`).length - 1;
  assert(occurrences === 2, `${key} must exist in both English and Bangla dictionaries.`);
}

console.log("PRD-02 customers/global-search frontend contracts: PASS");
