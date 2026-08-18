import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/admin-api.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

async function callAdminRequest(payload) {
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    require(id) {
      if (id === "./api") return { clientApi: async () => payload };
      throw new Error(`Unexpected dependency in admin-api contract check: ${id}`);
    },
    FormData: globalThis.FormData,
    URLSearchParams,
    console,
  };

  vm.runInNewContext(compiled, context, { filename: "admin-api.js" });
  return module.exports.adminRequest("/contract-check", { token: "test-token" });
}

const paginated = await callAdminRequest({
  success: true,
  message: "OK",
  data: [{ id: 1 }, { id: 2 }],
  meta: { current_page: 2, per_page: 25, total: 52, last_page: 3 },
});

if (
  !Array.isArray(paginated.data) ||
  paginated.data.length !== 2 ||
  paginated.current_page !== 2 ||
  paginated.per_page !== 25 ||
  paginated.total !== 52 ||
  paginated.last_page !== 3
) {
  throw new Error("Paginated admin API responses are not being rehydrated correctly.");
}

const plain = await callAdminRequest({
  success: true,
  message: "OK",
  data: { rows: [], totals: { debit: 0, credit: 0, balanced: true } },
});

if (plain?.totals?.balanced !== true) {
  throw new Error("Non-paginated admin API responses were modified unexpectedly.");
}

console.log("Admin pagination contract: PASS");
