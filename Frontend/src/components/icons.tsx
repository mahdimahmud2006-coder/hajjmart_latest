import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = 20, children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const SearchIcon = (props: IconProps) => <IconBase {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/></IconBase>;
export const UserIcon = (props: IconProps) => <IconBase {...props}><circle cx="12" cy="8" r="4"/><path d="M4.8 21c.8-4 3.2-6 7.2-6s6.4 2 7.2 6"/></IconBase>;
export const BagIcon = (props: IconProps) => <IconBase {...props}><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></IconBase>;
export const HeartIcon = (props: IconProps) => <IconBase {...props}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></IconBase>;
export const MenuIcon = (props: IconProps) => <IconBase {...props}><path d="M4 7h16M4 12h16M4 17h16"/></IconBase>;
export const CloseIcon = (props: IconProps) => <IconBase {...props}><path d="m5 5 14 14M19 5 5 19"/></IconBase>;
export const ChevronLeftIcon = (props: IconProps) => <IconBase {...props}><path d="m15 18-6-6 6-6"/></IconBase>;
export const ChevronRightIcon = (props: IconProps) => <IconBase {...props}><path d="m9 18 6-6-6-6"/></IconBase>;
export const ChevronDownIcon = (props: IconProps) => <IconBase {...props}><path d="m6 9 6 6 6-6"/></IconBase>;
export const ArrowRightIcon = (props: IconProps) => <IconBase {...props}><path d="M5 12h14M14 7l5 5-5 5"/></IconBase>;
export const TrendingUpIcon = (props: IconProps) => <IconBase {...props}><path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/></IconBase>;
export const ArrowLeftIcon = (props: IconProps) => <IconBase {...props}><path d="M19 12H5M10 7l-5 5 5 5"/></IconBase>;
export const PlusIcon = (props: IconProps) => <IconBase {...props}><path d="M12 5v14M5 12h14"/></IconBase>;
export const MinusIcon = (props: IconProps) => <IconBase {...props}><path d="M5 12h14"/></IconBase>;
export const TrashIcon = (props: IconProps) => <IconBase {...props}><path d="M4 7h16M9 7V4h6v3M8 10v8M12 10v8M16 10v8M6 7l1 14h10l1-14"/></IconBase>;
export const TruckIcon = (props: IconProps) => <IconBase {...props}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></IconBase>;
export const ShieldIcon = (props: IconProps) => <IconBase {...props}><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></IconBase>;
export const RotateIcon = (props: IconProps) => <IconBase {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></IconBase>;
export const StarIcon = (props: IconProps) => <IconBase {...props}><path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.7-4.6 6.5-.9L12 2.5Z"/></IconBase>;
export const CheckIcon = (props: IconProps) => <IconBase {...props}><path d="m5 12 4 4L19 6"/></IconBase>;
export const PhoneIcon = (props: IconProps) => <IconBase {...props}><path d="M6.6 3.5 9 7.8 6.8 10c1.4 3 3.8 5.4 6.8 6.8l2.2-2.2 4.3 2.4c.3.2.5.6.4 1-.5 2-2.1 3-4.2 3C9 21 3 15 3 7.7c0-2.1 1-3.7 3-4.2.3-.1.5 0 .6 0Z"/></IconBase>;
export const MailIcon = (props: IconProps) => <IconBase {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></IconBase>;
export const MapPinIcon = (props: IconProps) => <IconBase {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></IconBase>;
export const FilterIcon = (props: IconProps) => <IconBase {...props}><path d="M4 6h16M7 12h10M10 18h4"/></IconBase>;
export const GridIcon = (props: IconProps) => <IconBase {...props}><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></IconBase>;
export const EyeIcon = (props: IconProps) => <IconBase {...props}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></IconBase>;
export const FacebookIcon = (props: IconProps) => <IconBase {...props}><path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v6h4v-6h3l1-4h-4V9c0-.7.3-1 1-1Z"/></IconBase>;
export const InstagramIcon = (props: IconProps) => <IconBase {...props}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".7" fill="currentColor" stroke="none"/></IconBase>;
export const LockIcon = (props: IconProps) => <IconBase {...props}><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></IconBase>;
export const PackageIcon = (props: IconProps) => <IconBase {...props}><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 7 9 5 9-5v10l-9 5-9-5V7Z"/><path d="M12 12v10"/></IconBase>;
export const HeadsetIcon = (props: IconProps) => <IconBase {...props}><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H5a1 1 0 0 1-1-1v-5ZM20 14h-3v6h2a1 1 0 0 0 1-1v-5Z"/><path d="M17 20c-1 1-2.5 1.5-4.5 1.5"/></IconBase>;
