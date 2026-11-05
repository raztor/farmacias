import type { RouterOutputs } from "@repo/api";
import { ROLE_LABELS } from "@repo/shared";

import { formatDate } from "../../lib/format";

export type Profile = RouterOutputs["user"]["me"];

export type ProfileFact = Readonly<{ label: string; value: string }>;

/** Rows of the profile card. Dates are shown in Chile's time zone like every interface (D-23). */
export function profileFacts(profile: Pick<Profile, "role" | "createdAt">): ProfileFact[] {
  return [
    { label: "Rol", value: ROLE_LABELS[profile.role] },
    { label: "Miembro desde", value: formatDate(profile.createdAt) },
  ];
}
