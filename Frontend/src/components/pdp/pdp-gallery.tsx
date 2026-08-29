"use client";

import React, { useState } from "react";
import { ZoomIn, X } from "lucide-react";

interface PDPGalleryProps {
  primaryImage?: string | null;
  galleryImages?: string[];
  selectedVariationImage?: string | null;
  productName: string;
}

export function PDPGallery({
  primaryImage,
  galleryImages = [],
  selectedVariationImage,
  productName,
}: PDPGalleryProps) {
  // Combine variation image + primary image + gallery images into unique list
  const allImages = Array.from(
    new Set(
      [
        selectedVariationImage,
        primaryImage,
        ...galleryImages,
      ].filter(Boolean) as string[]
    )
  );

  const defaultImage =
    selectedVariationImage ||
    primaryImage ||
    allImages[0] ||
    "/placeholder.jpg";

  const [activeImage, setActiveImage] = useState<string>(defaultImage);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Update active image if selectedVariationImage changes
  React.useEffect(() => {
    if (selectedVariationImage) {
      setActiveImage(selectedVariationImage);
    }
  }, [selectedVariationImage]);

  const displayImage = activeImage || defaultImage;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Main Image Canvas (Aspect 1:1 or 4:5) */}
      <div className="relative w-full aspect-square bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] overflow-hidden group shadow-xs">
        <img
          src={displayImage}
          alt={productName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-250 cursor-pointer"
          onClick={() => setIsLightboxOpen(true)}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=800&q=80";
          }}
        />

        <button
          type="button"
          onClick={() => setIsLightboxOpen(true)}
          className="absolute bottom-3 right-3 p-2 bg-white/90 rounded-full shadow-md text-[#1A1A1A] hover:text-[#1F5D42] focus:outline-none transition-colors"
          aria-label="Zoom Image"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
      </div>

      {/* Thumbnails Row */}
      {allImages.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
          {allImages.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveImage(img)}
              className={`w-20 h-20 rounded-[8px] border-2 overflow-hidden shrink-0 transition-all focus:outline-none ${
                displayImage === img
                  ? "border-[#1F5D42] ring-2 ring-[#1F5D42]/20"
                  : "border-[#DDD6C7] opacity-70 hover:opacity-100"
              }`}
            >
              <img src={img} alt={`${productName} thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Modal Overlay */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white focus:outline-none transition-colors"
            aria-label="Close modal"
          >
            <X className="w-8 h-8" />
          </button>
          <div className="max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img
              src={displayImage}
              alt={productName}
              className="max-w-full max-h-full object-contain rounded-[8px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
