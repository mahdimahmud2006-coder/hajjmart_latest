import { Lang } from "./lang";

export function PaymentTrustBadges({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`payment-trust ${compact ? "compact" : ""}`} aria-label="Payment methods: bKash, Nagad, Rocket and Cash on Delivery">
      <span className="payment-trust-label"><Lang bn="পেমেন্ট" en="Payment"/></span>
      <div className="payment-trust-list">
        <span className="payment-brand bkash"><Lang bn="বিকাশ" en="bKash"/></span>
        <span className="payment-brand nagad"><Lang bn="নগদ" en="Nagad"/></span>
        <span className="payment-brand rocket"><Lang bn="রকেট" en="Rocket"/></span>
        <span className="payment-brand cod"><Lang bn="ক্যাশ অন ডেলিভারি" en="COD"/></span>
      </div>
    </div>
  );
}
