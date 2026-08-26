export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

export type ProductImage = {
  id?: number;
  path?: string | null;
  source_url?: string | null;
  downloaded_url?: string | null;
  alt_text?: string | null;
  is_primary?: boolean;
  sort_order?: number;
};

export type Inventory = {
  quantity?: number;
  reserved?: number;
  available?: number;
};

export type ProductVariant = {
  id: number;
  sku?: string | null;
  price?: string | number | null;
  sale_price?: string | number | null;
  regular_price?: string | number | null;
  attributes_json?: Record<string, string> | null;
  attribute_labels?: string[] | null;
  attribute_values?: string[] | Record<string, string> | null;
  image_json?: unknown;
  in_stock?: boolean;
  purchasable?: boolean;
  is_active?: boolean;
  inventory?: Inventory | null;
};

export type ProductAudience = "men" | "women" | "kids" | "unisex";
export type ProductKind = "package" | "single";
export type PackageType = "umrah" | "hajj";

export type ProductPackageItem = {
  name: string;
  name_bn?: string | null;
  quantity?: number | null;
  product_id?: number | null;
  product_slug?: string | null;
};

export type ProductReview = {
  id?: number | string;
  author: string;
  rating?: number | string | null;
  title?: string | null;
  comment: string;
  comment_bn?: string | null;
  created_at?: string | null;
};

export type Category = {
  id: number;
  name: string;
  name_bn?: string | null;
  slug: string;
  description?: string | null;
  description_bn?: string | null;
  image?: string | null | { image_url?: string | null };
  icon?: string | null;
  sort_order?: number;
  is_active?: boolean;
  children?: Category[];
  products_count?: number;
};

export type Product = {
  id: number;
  name: string;
  name_bn?: string | null;
  slug: string;
  sku?: string | null;
  brand?: string | null;
  selling_price?: string | number | null;
  regular_price?: string | number | null;
  sale_price?: string | number | null;
  price_min?: string | number | null;
  price_max?: string | number | null;
  price_text?: string | null;
  short_description?: string | null;
  short_description_bn?: string | null;
  short_description_html?: string | null;
  story_intro?: string | null;
  story_intro_bn?: string | null;
  story_intro_html?: string | null;
  description?: string | null;
  description_bn?: string | null;
  description_html?: string | null;
  long_description?: string | null;
  long_description_bn?: string | null;
  additional_information?: unknown;
  additional_information_rows?: Array<{ label?: string; name?: string; value?: string }> | null;
  specifications?: Record<string, string> | Array<{ label?: string; value?: string }> | null;
  stock_status?: string | null;
  available_stock?: number;
  is_featured?: boolean;
  average_rating?: string | number | null;
  review_count?: number;
  sold_count?: number;
  image_src?: string[] | null;
  product_images?: ProductImage[];
  productImages?: ProductImage[];
  product_variants?: ProductVariant[];
  productVariants?: ProductVariant[];
  categories?: Category[];
  primary_category?: Category | null;
  primaryCategory?: Category | null;
  inventory?: Inventory | null;
  package_contents?: ProductPackageItem[] | null;
  packageContents?: ProductPackageItem[] | null;
  audience?: ProductAudience | null;
  package_type?: PackageType | null;
  product_kind?: ProductKind | null;
  item_count?: number | null;
  package_weight?: string | null;
  package_disclaimer?: string | null;
  package_disclaimer_bn?: string | null;
  reviews?: ProductReview[] | null;
};

export type HomepageSection = {
  id: number;
  kind: "hero" | "category_banner" | "seasonal_collection" | "editorial_banner" | "announcement";
  eyebrow?: string | null;
  eyebrow_bn?: string | null;
  title: string;
  title_bn?: string | null;
  description?: string | null;
  description_bn?: string | null;
  cta_label?: string | null;
  cta_label_bn?: string | null;
  cta_url?: string | null;
  image_url?: string | null;
  mobile_image_url?: string | null;
  category_id?: number | null;
  category?: Category | null;
  theme?: "forest" | "sand" | "night" | "clay" | null;
  sort_order?: number;
  metadata?: Record<string, unknown> | null;
};


export type PublicPromotion = {
  id: number;
  code: string;
  title?: string | null;
  description?: string | null;
  type: "fixed" | "percent" | "free_shipping";
  value: string | number;
  visibility: "public" | "private";
  promotion_type: "coupon" | "public_sale" | "private_coupon";
  discount_scope?: string | null;
  is_active?: boolean;
  auto_apply?: boolean;
  stackable?: boolean;
  starts_at?: string | null;
  expires_at?: string | null;
  min_order_amount?: string | number | null;
};

export type CartItem = {
  key: string;
  productId: number;
  variantId?: number | null;
  slug: string;
  name: string;
  name_bn?: string | null;
  image?: string | null;
  unitPrice: number;
  regularPrice?: number | null;
  quantity: number;
  maxStock?: number | null;
  variantLabel?: string | null;
};

export type User = {
  name_bn?: string | null;
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
};
