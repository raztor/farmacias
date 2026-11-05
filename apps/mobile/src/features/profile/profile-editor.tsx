import { ErrorState, LoadingState } from "../../components/query-state";
import { useMe } from "./use-profile";
import { ProfileForm } from "./profile-form";

/** Loads the current profile and renders the edit form once it is available. */
export function ProfileEditor() {
  const me = useMe();

  if (me.isPending) return <LoadingState />;
  if (me.isError) {
    return (
      <ErrorState
        error={me.error}
        onRetry={() => {
          void me.refetch();
        }}
      />
    );
  }
  return <ProfileForm initialName={me.data.name} />;
}
