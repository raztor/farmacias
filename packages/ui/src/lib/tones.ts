/**
 * Semantic tones shared by status components (`Badge`, `Notice`, `ToneIcon`).
 *
 * A tone never relies on color alone (RNF-01): every tone has its own glyph, and components
 * always pair it with a text label.
 */
export const TONES = ["neutral", "info", "success", "warning", "destructive"] as const;

export type Tone = (typeof TONES)[number];

/** Glyph drawn inside the tone icon. Decorative: hidden from screen readers. */
export const TONE_GLYPHS: Readonly<Record<Tone, string>> = {
  neutral: "•",
  info: "i",
  success: "✓",
  warning: "!",
  destructive: "✕",
};

type ToneClasses = Readonly<{
  /** Border color of outlined surfaces (badge, notice). */
  border: string;
  /** Text color on the app background. */
  text: string;
  /** Solid background of the icon circle. */
  solid: string;
  /** Text color on top of `solid`. */
  onSolid: string;
}>;

export const TONE_CLASSES: Readonly<Record<Tone, ToneClasses>> = {
  neutral: {
    border: "border-border dark:border-border-dark",
    text: "text-foreground dark:text-foreground-dark",
    solid: "bg-muted-foreground dark:bg-muted-foreground-dark",
    onSolid: "text-background dark:text-background-dark",
  },
  info: {
    border: "border-primary dark:border-primary-dark",
    text: "text-primary dark:text-primary-dark",
    solid: "bg-primary dark:bg-primary-dark",
    onSolid: "text-primary-foreground dark:text-primary-foreground-dark",
  },
  success: {
    border: "border-success dark:border-success-dark",
    text: "text-success dark:text-success-dark",
    solid: "bg-success dark:bg-success-dark",
    onSolid: "text-success-foreground dark:text-success-foreground-dark",
  },
  warning: {
    border: "border-warning dark:border-warning-dark",
    text: "text-warning dark:text-warning-dark",
    solid: "bg-warning dark:bg-warning-dark",
    onSolid: "text-warning-foreground dark:text-warning-foreground-dark",
  },
  destructive: {
    border: "border-destructive dark:border-destructive-dark",
    text: "text-destructive dark:text-destructive-dark",
    solid: "bg-destructive dark:bg-destructive-dark",
    onSolid: "text-destructive-foreground dark:text-destructive-foreground-dark",
  },
};

/** Visible focus ring for custom pressables on the web (keyboard users, RNF-01). */
export const FOCUS_RING_CLASSES =
  "web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring dark:web:focus-visible:ring-ring-dark";
