import fs from "node:fs";

const api = fs.readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const profile = fs.readFileSync(new URL("../src/app/profile/page.tsx", import.meta.url), "utf8");

for (const [name, source, expected] of [
  ["address POST API", api, 'clientApi<CustomerAddressApi>("/addresses"'],
  ["add-address button", profile, 'onClick={() => setShowAddressForm(true)}'],
  ["address submit", profile, 'onSubmit={handleAddAddress}'],
  ["district field", profile, 'id="saved-address-district"'],
]) {
  if (!source.includes(expected)) throw new Error(`Missing ${name}`);
}

console.log("Address book add flow is wired.");
