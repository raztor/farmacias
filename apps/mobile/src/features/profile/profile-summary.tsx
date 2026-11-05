import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Text } from "@repo/ui";
import { Link } from "expo-router";
import { View } from "react-native";

import { ErrorState, LoadingState } from "../../components/query-state";
import { type Profile, profileFacts } from "./profile-facts";
import { useMe } from "./use-profile";

function ProfileDetails({ profile }: Readonly<{ profile: Profile }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle testID="profile-name">{profile.name}</CardTitle>
        <CardDescription testID="profile-email">{profile.email}</CardDescription>
      </CardHeader>
      <CardContent>
        {profileFacts(profile).map((fact) => (
          <View key={fact.label} className="flex-row justify-between">
            <Text variant="muted">{fact.label}</Text>
            <Text>{fact.value}</Text>
          </View>
        ))}
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
