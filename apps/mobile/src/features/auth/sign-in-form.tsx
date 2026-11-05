import { signInSchema } from "@repo/shared";
import { Button, Input } from "@repo/ui";
import { View } from "react-native";

import { FormError } from "../../components/form-error";
import { useZodForm } from "../../lib/use-zod-form";
import { getAuthErrorMessage } from "./auth-errors";
import { useSignIn } from "./use-auth-mutations";

const INITIAL_VALUES = { email: "", password: "" };

/** Email + password sign-in validated with the shared `signInSchema`. */
export function SignInForm() {
  const form = useZodForm(signInSchema, INITIAL_VALUES);
  const signIn = useSignIn();

  const onSubmit = () => {
    const input = form.validate();
    if (input !== null) signIn.mutate(input);
  };

  return (
    <View className="gap-4">
      <Input
        label="Correo electrónico"
        placeholder="tu@correo.cl"
        value={form.values.email}
        onChangeText={(value) => {
          form.setField("email", value);
        }}
        error={form.errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        testID="sign-in-email"
      />
      <Input
        label="Contraseña"
        value={form.values.password}
        onChangeText={(value) => {
          form.setField("password", value);
        }}
        error={form.errors.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={onSubmit}
        testID="sign-in-password"
      />
      <FormError
        message={signIn.isError ? getAuthErrorMessage(signIn.error) : null}
        testID="sign-in-error"
      />
      <Button onPress={onSubmit} loading={signIn.isPending} testID="sign-in-submit">
        Iniciar sesión
      </Button>
    </View>
  );
}
