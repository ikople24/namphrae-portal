// Domain types for the Namphrae Portal config document.
// The whole portal is described by a single PortalConfig object which is stored
// as one MongoDB document (or one local JSON file in the dev fallback store).

export type HeroMediaType = 'none' | 'image' | 'video';

export type HeroMedia = {
  mediaType: HeroMediaType;
  videoUrl?: string; // Cloudinary video URL
  posterUrl?: string; // still image: used as <video poster> and image fallback
  overlayOpacity: number; // 0–1, darkening overlay so text stays readable
};

export type SiteContact = {
  phone?: string;
  email?: string;
  address?: string;
};

export type Manual = {
  label: string;
  url: string;
};

export type SiteSettings = {
  orgName: string;
  orgSubName?: string;
  title: string;
  brandTitle?: string;
  tagline: string;
  logoUrl: string;
  hero: HeroMedia;
  contact: SiteContact;
  manuals?: Manual[];
};

export type Category = {
  id: string; // slug e.g. "service"
  label: string;
  order: number;
};

export type ServiceLink = {
  id: string; // unique slug
  title: string;
  subtitle?: string;
  url: string;
  imageUrl?: string; // Cloudinary URL (or legacy hotlink)
  categoryId: string;
  openInNewTab: boolean;
  isActive: boolean; // false = hidden from public page
  isFeatured: boolean; // true = large card at the top
  order: number;
  clickCount: number;
};

export type PortalConfig = {
  _id?: string; // always "portalConfig"
  version: number;
  updatedAt: string; // ISO string
  updatedBy?: string; // Clerk user id / email
  visitorCount: number; // continues from the legacy counter
  site: SiteSettings;
  categories: Category[];
  links: ServiceLink[];
};

// Public-facing config: admin-only fields stripped, inactive links removed.
export type PublicConfig = {
  version: number;
  updatedAt: string;
  visitorCount: number;
  site: SiteSettings;
  categories: Category[];
  links: PublicLink[];
};

export type PublicLink = Omit<ServiceLink, 'isActive'>;

export const CONFIG_ID = 'portalConfig';
