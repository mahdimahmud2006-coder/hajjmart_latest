"use client";

import { useState } from "react";
import Link from "next/link";
import { CloseIcon, HeadsetIcon, PhoneIcon } from "./icons";

export function SupportBubble() {
  const [open, setOpen] = useState(false);
  return (
    <div className={`support-bubble ${open ? "is-open" : ""}`}>
      {open ? <div className="support-bubble-card" role="dialog" aria-label="HajjMart support options">
        <div><p className="eyebrow">HajjMart care</p><strong>Need help choosing or ordering?</strong><span>Talk to a real person every day, 10:00 AM–9:00 PM.</span></div>
        <a href="tel:+8801720601515"><PhoneIcon size={17}/>Call 01720 601515</a>
        <Link href="/contact">Send a message →</Link>
      </div> : null}
      <button type="button" className="support-bubble-button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={open ? "Close HajjMart support" : "Open HajjMart support"}>{open ? <CloseIcon size={20}/> : <HeadsetIcon size={22}/>}</button>
    </div>
  );
}
