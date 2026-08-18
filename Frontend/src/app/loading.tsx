import { Skeleton } from "@/components/interaction-kit";

export default function Loading() {
  return <main className="min-h-screen bg-[var(--paper)]">
    <Skeleton className="h-[620px] bg-[var(--forest)]" />
    <div className="container-wide grid grid-cols-2 gap-5 py-16 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => <div key={index}>
        <Skeleton className="aspect-[4/5] rounded-2xl" />
        <Skeleton className="mt-4 h-4 w-3/4 rounded" />
        <Skeleton className="mt-2 h-4 w-1/3 rounded" />
      </div>)}
    </div>
  </main>;
}
