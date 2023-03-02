/**
 * Applies an offset to a date
 *
 * @param date Date to be offset
 * @param offset In seconds
 * @returns The date with the offset applied
 */
export const getDateWithOffset = (
  date: string | null,
  offset: number,
  endOfDay?: boolean
) => {
  if (!date) return null;
  // If endOfDay is true, add 23 hours, 59 minutes and 59 seconds to the date
  if (endOfDay) {
    return new Date(
      new Date(date).getTime() +
        (23 * 60 * 60 + 59 * 60 + 59) * 1000 -
        offset * 1000
    );
  }
  return new Date(new Date(date).getTime() - offset * 1000);
};
