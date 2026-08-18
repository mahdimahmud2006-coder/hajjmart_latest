import { OrderSuccessClient } from "@/components/order-success-client";

export default async function OrderSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string; payment?: string }> }) {
  const params = await searchParams;
  return <OrderSuccessClient orderNumber={params.order} paymentHint={params.payment}/>;
}
