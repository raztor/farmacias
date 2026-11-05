/** Search-term helpers of the catalog specs (R-CAT-02: accent- and case-insensitive search). */

/** The text without its diacritics («Losartán potásico» → «Losartan potasico»). */
export function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Whether the text has at least one accented letter. */
export function hasDiacritics(text: string): boolean {
  return stripDiacritics(text) !== text.normalize("NFD");
}
