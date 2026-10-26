import { getNoticeBySlug } from './notices';
import { CHOOSER_LETTERS } from './chooser-routing';
import type { PublicAvailabilityResponse } from './template-policy';

const CANCELLATION_SLUG = 'service-cancellation-request';
const CANCELLATION_FIELD_KEY = 'serviceTypeLabel';

const cancellationField = getNoticeBySlug(CANCELLATION_SLUG)?.fields.find(
  (field) => field.key === CANCELLATION_FIELD_KEY
);

/** Starting points are sourced from the existing select, never copied as new products. */
export const CANCELLATION_STARTING_POINTS =
  cancellationField?.options?.map(({ label, value }) => ({ label, value })) ?? [];

export function getAvailableLibraryLetters(
  availability: PublicAvailabilityResponse | null | undefined
) {
  if (!availability || !Array.isArray(availability.templates)) return [];
  const availableSlugs = new Set(
    availability.templates
      .filter((entry) => entry && entry.available === true && typeof entry.slug === 'string')
      .map((entry) => entry.slug)
  );
  return CHOOSER_LETTERS.filter((letter) => availableSlugs.has(letter.slug));
}

/** Returns a URL only for an exact value in the existing cancellation select. */
export function buildCancellationStartingPointUrl(value: string): string | null {
  if (!CANCELLATION_STARTING_POINTS.some((option) => option.value === value)) return null;
  const query = new URLSearchParams({ [`field.${CANCELLATION_FIELD_KEY}`]: value });
  return `/notices/${CANCELLATION_SLUG}?${query.toString()}`;
}
