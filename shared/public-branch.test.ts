import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicBranchDto } from "./public-branch";

const source = {
  id: "branch-1",
  name: "Yoga",
  slug: "yoga",
  category: "wellness",
  subcategory: "yoga",
  city: "Cancún",
  address: "Dirección pública",
  coverImageUrl: "/uploads/cover.webp",
  description: "Descripción pública",
  whatsappNumber: "5219980000000",
  googleMapsUrl: "https://maps.example.test/yoga",
  operatingHours: { monday: "09:00-18:00" },
  summaryHours: "Lun-Vie 9-18",
  locations: [{ name: "Principal", address: "Dirección pública", googleMapsUrl: "https://maps.example.test/yoga" }],
  whatsappTemplates: { internal: "secret" },
  searchKeywords: "internal keywords",
  cancelCutoffMinutes: 120,
  status: "active",
  createdAt: new Date(),
  deletedAt: null,
};

test("public branch DTO preserves every field consumed by the public web page", () => {
  const dto = buildPublicBranchDto(source);
  assert.deepEqual(Object.keys(dto).sort(), [
    "address",
    "category",
    "city",
    "coverImageUrl",
    "description",
    "googleMapsUrl",
    "id",
    "locations",
    "name",
    "operatingHours",
    "slug",
    "subcategory",
    "summaryHours",
    "whatsappNumber",
  ].sort());
  assert.equal(dto.name, source.name);
  assert.equal(dto.coverImageUrl, source.coverImageUrl);
  assert.deepEqual(dto.locations, source.locations);
});

test("public branch DTO does not expose internal configuration or lifecycle fields", () => {
  const dto = buildPublicBranchDto(source) as Record<string, unknown>;
  for (const field of [
    "whatsappTemplates",
    "searchKeywords",
    "cancelCutoffMinutes",
    "status",
    "createdAt",
    "deletedAt",
  ]) {
    assert.equal(Object.hasOwn(dto, field), false, field);
  }
});
