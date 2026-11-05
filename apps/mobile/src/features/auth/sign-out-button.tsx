import { Button } from "@repo/ui";
import { View } from "react-native";

import { FormError } from "../../components/form-error";
import { getAuthErrorMessage } from "./auth-errors";
import { useSignOut } from "./use-auth-mutations";

export function SignOutButton() {
  const signOut = useSignOut();

  return (
    <View className="gap-2">
      <FormError message={signOut.isError ? getAuthErrorMessage(signOut.error) : null} />
      <Button
        variant="outline"
        loading={signOut.isPending}
        onPress={() => {
          signOut.mutate();
        }}
        testID="sign-out"
      >
        Cerrar sesión
      </Button>
    </View>
  );
}
