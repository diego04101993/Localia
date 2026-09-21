export type PublicBranchDto = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  subcategory: string | null;
  city: string | null;
  address: string | null;
  coverImageUrl: string | null;
  description: string | null;
  whatsappNumber: string | null;
  googleMapsUrl: string | null;
  operatingHours: unknown;
  summaryHours: string | null;
  locations: Array<{ name: string; address: string; googleMapsUrl: string }> | null;
};

export function buildPublicBranchDto(branch: PublicBranchDto): PublicBranchDto {
  return {
    id: branch.id,
    name: branch.name,
    slug: branch.slug,
    category: branch.category,
    subcategory: branch.subcategory,
    city: branch.city,
    address: branch.address,
    coverImageUrl: branch.coverImageUrl,
    description: branch.description,
    whatsappNumber: branch.whatsappNumber,
    googleMapsUrl: branch.googleMapsUrl,
    operatingHours: branch.operatingHours,
    summaryHours: branch.summaryHours,
    locations: branch.locations,
  };
}
