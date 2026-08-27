"use client";

import React, { forwardRef } from "react";

/* ==========================================================================
   Storefront Design Tokens (PRD 01 & UI/UX Design Guideline)
   Colors:
   - bg-base: #FBF8F1 (Ivory)
   - bg-surface: #FFFDF8 (Warm Off-White)
   - primary: #1F5D42 (Deep Green)
   - primary-hover: #164A34
   - primary-tint: #E4EFE8
   - gold: #B8860B (Muted Matte Gold)
   - gold-tint: #F5EEDD
   - success: #16A34A
   - warning: #B45309
   - error: #B3261E
   - neutral-900: #1A1A1A (Near-Black Text)
   - neutral-600: #5B5650
   - neutral-300: #DDD6C7
   - neutral-100: #F1ECE0
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. Button Primitive Component
// --------------------------------------------------------------------------
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "urgency" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      loading = false,
      icon,
      children,
      disabled,
      className = "",
      style,
      ...props
    },
    ref
  ) => {
    // Height & touch target sizing
    const sizeClasses = {
      sm: "min-h-[44px] px-4 py-2 text-[16px]",
      md: "min-h-[48px] px-5 py-3 text-[18px]",
      lg: "min-h-[56px] px-6 py-4 text-[18px]",
    }[size];

    // Visual variants
    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: "#1F5D42",
        color: "#FFFFFF",
        border: "1px solid #1F5D42",
      },
      secondary: {
        backgroundColor: "transparent",
        color: "#1F5D42",
        border: "1.5px solid #1F5D42",
      },
      urgency: {
        backgroundColor: "#B8860B",
        color: "#1A1A1A",
        border: "1px solid #B8860B",
      },
      destructive: {
        backgroundColor: "transparent",
        color: "#B3261E",
        border: "1.5px solid #B3261E",
      },
      ghost: {
        backgroundColor: "transparent",
        color: "#1F5D42",
        border: "1px solid transparent",
      },
    };

    const baseStyle: React.CSSProperties = {
      ...variantStyles[variant],
      borderRadius: "8px", // radius-md
      fontWeight: 700,
      display: fullWidth ? "flex" : "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      width: fullWidth ? "100%" : "auto",
      cursor: disabled || loading ? "not-allowed" : "pointer",
      opacity: disabled || loading ? 0.65 : 1,
      transition: "background-color 150ms ease-out, border-color 150ms ease-out, transform 150ms ease-out",
      boxSizing: "border-box",
      ...style,
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`select-none focus:outline-none focus:ring-2 focus:ring-[#1F5D42] focus:ring-offset-2 ${sizeClasses} ${className}`}
        style={baseStyle}
        {...props}
      >
        {loading ? (
          <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin me-2" />
        ) : icon ? (
          <span className="inline-flex shrink-0">{icon}</span>
        ) : null}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";

// --------------------------------------------------------------------------
// 2. Badge & Chip Primitive Component
// --------------------------------------------------------------------------
export interface BadgeProps {
  variant?: "success" | "warning" | "error" | "primary-tint" | "gold-tint" | "neutral";
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onRemove?: () => void;
}

export function Badge({
  variant = "primary-tint",
  icon,
  children,
  className = "",
  onRemove,
}: BadgeProps) {
  const badgeStyles: Record<string, React.CSSProperties> = {
    success: {
      backgroundColor: "#E8F5E9",
      color: "#16A34A",
      border: "1px solid #C8E6C9",
    },
    warning: {
      backgroundColor: "#FEF3C7",
      color: "#B45309",
      border: "1px solid #FDE68A",
    },
    error: {
      backgroundColor: "#FEE2E2",
      color: "#B3261E",
      border: "1px solid #FCA5A5",
    },
    "primary-tint": {
      backgroundColor: "#E4EFE8",
      color: "#1F5D42",
      border: "1px solid #C4DFC3",
    },
    "gold-tint": {
      backgroundColor: "#F5EEDD",
      color: "#B8860B",
      border: "1px solid #EADEB8",
    },
    neutral: {
      backgroundColor: "#F1ECE0",
      color: "#5B5650",
      border: "1px solid #DDD6C7",
    },
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-[16px] font-medium rounded-full ${className}`}
      style={{
        ...badgeStyles[variant],
        borderRadius: "999px", // radius-full
      }}
    >
      {icon && <span className="inline-flex shrink-0 text-current">{icon}</span>}
      <span>{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ms-1 p-0.5 hover:opacity-75 focus:outline-none"
          aria-label="Remove filter"
        >
          ✕
        </button>
      )}
    </span>
  );
}

// --------------------------------------------------------------------------
// 3. Card Primitive Component
// --------------------------------------------------------------------------
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  bordered?: boolean;
  children: React.ReactNode;
}

export function Card({
  elevated = false,
  bordered = true,
  children,
  className = "",
  style,
  ...props
}: CardProps) {
  const cardStyle: React.CSSProperties = {
    backgroundColor: "#FFFDF8", // bg-surface
    borderRadius: "8px", // radius-md
    border: bordered ? "1px solid #DDD6C7" : "none", // neutral-300
    boxShadow: elevated ? "0 4px 6px rgba(0,0,0,0.10)" : "0 1px 2px rgba(0,0,0,0.06)",
    padding: "16px",
    ...style,
  };

  return (
    <div className={`overflow-hidden ${className}`} style={cardStyle} {...props}>
      {children}
    </div>
  );
}

// --------------------------------------------------------------------------
// 4. TextInput & Form Select Primitives
// --------------------------------------------------------------------------
export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, helperText, id, className = "", style, ...props }, ref) => {
    const inputId = id || `input-${label.replace(/\s+/g, "-").toLowerCase()}`;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        <label
          htmlFor={inputId}
          className="text-[18px] font-bold text-[#1A1A1A] flex items-center justify-between"
        >
          <span>{label}</span>
          {props.required && <span className="text-[#B3261E] font-normal ms-1">*</span>}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`min-h-[48px] px-4 py-3 text-[18px] text-[#1A1A1A] bg-[#FFFDF8] border rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#1F5D42] ${
            error ? "border-[#B3261E]" : "border-[#DDD6C7]"
          } ${className}`}
          style={{
            borderRadius: "4px", // radius-sm
            ...style,
          }}
          {...props}
        />
        {error && <span className="text-[16px] text-[#B3261E] font-medium">{error}</span>}
        {!error && helperText && <span className="text-[16px] text-[#5B5650]">{helperText}</span>}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";

// --------------------------------------------------------------------------
// 5. Price Display Primitive Component
// --------------------------------------------------------------------------
export interface PriceDisplayProps {
  price: number;
  regularPrice?: number;
  currency?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PriceDisplay({
  price,
  regularPrice,
  currency = "৳",
  size = "md",
  className = "",
}: PriceDisplayProps) {
  const isDiscounted = regularPrice && regularPrice > price;
  const savings = isDiscounted ? regularPrice - price : 0;
  const discountPercent = isDiscounted ? Math.round((savings / regularPrice) * 100) : 0;

  const fontSizes = {
    sm: "text-[18px]",
    md: "text-[20px]",
    lg: "text-[26px]",
  }[size];

  // Helper to format currency number in standard 0-9 digits with commas
  const formatPrice = (val: number) => {
    return val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  return (
    <div className={`flex items-baseline flex-wrap gap-2 ${className}`}>
      <span className={`font-bold text-[#1A1A1A] ${fontSizes}`}>
        {currency}{formatPrice(price)}
      </span>

      {isDiscounted && (
        <>
          <span className="text-[16px] text-[#5B5650] line-through">
            {currency}{formatPrice(regularPrice)}
          </span>
          <Badge variant="gold-tint">
            {currency}{formatPrice(savings)} ছাড় ({discountPercent}% Off)
          </Badge>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 6. Quantity Stepper Component
// --------------------------------------------------------------------------
export interface QuantityStepperProps {
  value: number;
  onChange: (newVal: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  disabled = false,
}: QuantityStepperProps) {
  return (
    <div className="inline-flex items-center border border-[#DDD6C7] rounded-[8px] bg-[#FFFDF8]">
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-12 h-12 flex items-center justify-center text-[20px] font-bold text-[#1A1A1A] hover:bg-[#E4EFE8] disabled:opacity-40 disabled:hover:bg-transparent rounded-s-[8px] focus:outline-none focus:ring-1 focus:ring-[#1F5D42]"
        aria-label="Decrease quantity"
      >
        -
      </button>
      <span className="w-12 text-center text-[18px] font-bold text-[#1A1A1A] select-none">
        {value}
      </span>
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-12 h-12 flex items-center justify-center text-[20px] font-bold text-[#1A1A1A] hover:bg-[#E4EFE8] disabled:opacity-40 disabled:hover:bg-transparent rounded-e-[8px] focus:outline-none focus:ring-1 focus:ring-[#1F5D42]"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
