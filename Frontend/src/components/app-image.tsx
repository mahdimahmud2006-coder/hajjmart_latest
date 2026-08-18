"use client";

import { useState } from "react";

type AppImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallback?: string;
};

export function AppImage({ src, alt = "", fallback = "/images/products/ihram-package.svg", ...props }: AppImageProps) {
  const [failed, setFailed] = useState(false);
  const source = failed || !src ? fallback : src;
  return (
    // Dynamic commerce images can originate from the Laravel media store or the source catalogue.
    // A normal img keeps the frontend compatible with both without hard-coding remote hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={source} alt={alt} onError={() => setFailed(true)} {...props} />
  );
}
