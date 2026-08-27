"use client";

import React from "react";
import type { TrackingTimelineStep } from "@/lib/api";
import { CheckCircle2, Circle, Clock, PackageCheck, Truck, Home, Check } from "lucide-react";

interface OrderTimelineProps {
  timeline: TrackingTimelineStep[];
}

export function OrderTimeline({ timeline }: OrderTimelineProps) {
  const getIcon = (status: string, completed: boolean) => {
    if (completed) {
      return <Check className="w-5 h-5 text-white" />;
    }
    switch (status) {
      case "placed":
        return <Clock className="w-5 h-5 text-[#5B5650]" />;
      case "processing":
        return <PackageCheck className="w-5 h-5 text-[#5B5650]" />;
      case "shipped":
        return <Truck className="w-5 h-5 text-[#5B5650]" />;
      case "out_for_delivery":
        return <Home className="w-5 h-5 text-[#5B5650]" />;
      case "delivered":
        return <CheckCircle2 className="w-5 h-5 text-[#5B5650]" />;
      default:
        return <Circle className="w-5 h-5 text-[#5B5650]" />;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full py-4">
      {timeline.map((step, idx) => {
        const isLast = idx === timeline.length - 1;

        return (
          <div key={idx} className="flex items-start gap-4 relative">
            {/* Connecting Vertical Line */}
            {!isLast && (
              <div
                className={`absolute left-[19px] top-10 w-0.5 h-full ${
                  step.completed ? "bg-[#1F5D42]" : "bg-[#DDD6C7]"
                }`}
              />
            )}

            {/* Step Icon Badge */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${
                step.completed
                  ? "bg-[#1F5D42] text-white ring-4 ring-[#E4EFE8]"
                  : "bg-[#FFFDF8] border-2 border-[#DDD6C7] text-[#5B5650]"
              }`}
            >
              {getIcon(step.status, step.completed)}
            </div>

            {/* Step Details */}
            <div className="flex-1 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4
                  className={`text-[18px] font-bold ${
                    step.completed ? "text-[#1F5D42]" : "text-[#1A1A1A]"
                  }`}
                >
                  {step.title}
                </h4>
                {step.timestamp && (
                  <span className="text-[14px] text-[#5B5650] bg-[#FBF8F1] px-2 py-0.5 rounded border border-[#DDD6C7]">
                    {step.timestamp}
                  </span>
                )}
              </div>

              {step.description && (
                <p className="text-[16px] text-[#5B5650] mt-1">{step.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
