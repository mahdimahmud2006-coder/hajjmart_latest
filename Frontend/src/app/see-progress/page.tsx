import type { Metadata } from "next";
import { SeeProgressClient } from "@/components/see-progress-client";

export const metadata: Metadata = { title: "See order progress | HajjMart", description: "Check the latest progress of a HajjMart website order using the mobile number used at checkout." };

export default function SeeProgressPage() { return <SeeProgressClient/>; }
