import type { RouterOutputs } from "@repo/api";
import { ROLE_LABELS } from "@repo/shared";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Text } from "@repo/ui";
import { Link } from "expo-router";
import { View } from "react-native";

import { ErrorState, LoadingState } from "../../components/query-state";
import { useMe } from "./use-profile";

type Profile = RouterOutputs["user"]["me"];

function ProfileDetails({ profile }: Readonly<{ profile: Profile }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle testID="profile-name">{profile.name}</CardTitle>
        <CardDescription testID="profile-email">{profile.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <View className="flex-row justify-between">
          <Text variant="muted">Rol</Text>
          <Text>{ROLE_LABELS[profile.role]}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text variant="muted">Miembro desde</Text>
          <Text>{profile.createdAt.toLocaleDateString("es-CL")}</Text>
        </View>
        <Link href="/profile" asChild>
          <Button variant="secondary" testID="edit-profile">
            Editar perfil
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

/** Home card with the signed-in user's profile (`user.me`). */
export function ProfileSummary() {
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
  return <ProfileDetails profile={me.data} />;
}
