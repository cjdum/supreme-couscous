/**
 * Pixel Card eligibility — shared between server route and client UI so a
 * user is never told they're eligible only to be rejected by the API.
 *
 * Requirements (all four must be true):
 *   1. ≥ 2 photos uploaded
 *   2. description ≥ 80 characters
 *   3. make + model + year all filled in
 *   4. build score ≥ 15
 */

export interface PixelCardEligibilityInput {
  photoCount: number;
  description: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  buildScore: number;
}

export interface RequirementCheck {
  id: "photos" | "description" | "core_fields" | "build_score";
  label: string;
  detail: string;
  met: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  requirements: RequirementCheck[];
}

export const PIXEL_CARD_MIN_PHOTOS = 2;
export const PIXEL_CARD_MIN_DESCRIPTION = 80;
export const PIXEL_CARD_MIN_BUILD_SCORE = 15;

export function checkPixelCardEligibility(input: PixelCardEligibilityInput): EligibilityResult {
  const description = (input.description ?? "").trim();
  const requirements: RequirementCheck[] = [
    {
      id: "photos",
      label: `Upload ${PIXEL_CARD_MIN_PHOTOS} photos`,
      detail: `${input.photoCount} of ${PIXEL_CARD_MIN_PHOTOS}`,
      met: input.photoCount >= PIXEL_CARD_MIN_PHOTOS,
    },
    {
      id: "description",
      label: `Write a description (${PIXEL_CARD_MIN_DESCRIPTION}+ characters)`,
      detail: `${description.length} of ${PIXEL_CARD_MIN_DESCRIPTION} characters`,
      met: description.length >= PIXEL_CARD_MIN_DESCRIPTION,
    },
    {
      id: "core_fields",
      label: "Make, model, year filled in",
      detail: input.make && input.model && input.year ? "Done" : "Missing fields",
      met: Boolean(input.make && input.model && input.year),
    },
    {
      id: "build_score",
      label: `Reach ${PIXEL_CARD_MIN_BUILD_SCORE} build score`,
      detail: `${input.buildScore} of ${PIXEL_CARD_MIN_BUILD_SCORE}`,
      met: input.buildScore >= PIXEL_CARD_MIN_BUILD_SCORE,
    },
  ];

  return {
    eligible: requirements.every((r) => r.met),
    requirements,
  };
}
