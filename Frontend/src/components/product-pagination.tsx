import Link from "next/link";
import { Lang } from "./lang";

type SearchParams = Record<string, string | string[] | undefined>;

function pageHref(basePath: string, searchParams: SearchParams, page: number) {
  const next = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === "page" || value === undefined) return;
    (Array.isArray(value) ? value : [value]).forEach((item) => next.append(key, item));
  });
  if (page > 1) next.set("page", String(page));
  return `${basePath}${next.size ? `?${next.toString()}` : ""}`;
}

export function ProductPagination({ basePath, currentPage, lastPage, searchParams = {} }: { basePath: string; currentPage: number; lastPage: number; searchParams?: SearchParams }) {
  if (lastPage <= 1) return null;

  const pages = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, lastPage])]
    .filter((page) => page >= 1 && page <= lastPage)
    .sort((a, b) => a - b);

  return (
    <nav className="mt-12 flex flex-wrap items-center justify-center gap-2" aria-label="Product pages">
      {currentPage > 1 ? <Link href={pageHref(basePath, searchParams, currentPage - 1)} className="button-quiet"><Lang bn="← আগের" en="← Previous"/></Link> : null}
      {pages.map((page, index) => (
        <span key={page} className="contents">
          {index > 0 && page - pages[index - 1] > 1 ? <span className="px-1 text-[var(--muted)]">…</span> : null}
          <Link
            href={pageHref(basePath, searchParams, page)}
            aria-current={page === currentPage ? "page" : undefined}
            className={`grid h-10 min-w-10 place-items-center rounded-full border px-3 text-sm font-semibold transition ${page === currentPage ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-black/10 bg-white text-[var(--ink)] hover:border-[var(--forest)]"}`}
          >
            {page}
          </Link>
        </span>
      ))}
      {currentPage < lastPage ? <Link href={pageHref(basePath, searchParams, currentPage + 1)} className="button-quiet"><Lang bn="পরের →" en="Next →"/></Link> : null}
    </nav>
  );
}
