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
  retail_price?: string | number | null;
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

export type Category = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
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
  slug: string;
  sku?: string | null;
  brand?: string | null;
  selling_price?: string | number | null;
  retail_price?: string | number | null;
  regular_price?: string | number | null;
  sale_price?: string | number | null;
  price_min?: string | number | null;
  price_max?: string | number | null;
  price_text?: string | null;
  short_description?: string | null;
  short_description_html?: string | null;
  description?: string | null;
  description_html?: string | null;
  long_description?: string | null;
  additional_information?: unknown;
  additional_information_rows?: Array<{ label?: string; name?: string; value?: string }> | null;
  specifications?: Record<string, string> | Array<{ label?: string; value?: string }> | null;
  stock_status?: string | null;
  available_stock?: number;
  in_stock?: boolean;
  has_variations?: boolean;
  is_featured?: boolean;
  sold_count?: number;
  primary_image_url?: string | null;
  image_src?: string[] | null;
  product_images?: ProductImage[];
  productImages?: ProductImage[];
  product_variants?: ProductVariant[];
  productVariants?: ProductVariant[];
  categories?: Category[];
  primary_category?: Category | null;
  primaryCategory?: Category | null;
  inventory?: Inventory | null;
};

export type HomepageSection = {
  id: number;
  kind: "hero" | "category_banner" | "seasonal_collection" | "editorial_banner" | "announcement";
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  image_url?: string | null;
  mobile_image_url?: string | null;
  category_id?: number | null;
  category?: Category | null;
  theme?: "forest" | "sand" | "night" | "clay" | null;
  sort_order?: number;
  metadata?: Record<string, unknown> | null;
};

export type CartItem = {
  key: string;
  productId: number;
  variantId?: number | null;
  slug: string;
  name: string;
  image?: string | null;
  unitPrice: number;
  baseUnitPrice?: number | null;
  regularPrice?: number | null;
  categoryIds?: number[];
  quantity: number;
  maxStock?: number | null;
  variantLabel?: string | null;
};

export type User = {
  name_bn?: string | null;
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
};
