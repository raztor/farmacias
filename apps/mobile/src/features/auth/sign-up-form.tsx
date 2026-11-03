import { signUpSchema } from "@repo/shared";
import { Button, Input } from "@repo/ui";
import { View } from "react-native";

import { FormError } from "../../components/form-error";
import { useZodForm } from "../../lib/use-zod-form";
import { getAuthErrorMessage } from "./auth-errors";
import { useSignUp } from "./use-auth-mutations";

const INITIAL_VALUES = { name: "", email: "", password: "" };

/** Account creation validated with the shared `signUpSchema` (same password policy as the API). */
export function SignUpForm() {
  const form = useZodForm(signUpSchema, INITIAL_VALUES);
  const signUp = useSignUp();

  const onSubmit = () => {
    const input = form.validate();
    if (input !== null) signUp.mutate(input);
  };

  return (
    <View className="gap-4">
      <Input
        label="Nombre"
        value={form.values.name}
        onChangeText={(value) => {
          form.setField("name", value);
        }}
        error={form.errors.name}
        autoComplete="name"
        textContentType="name"
        testID="sign-up-name"
      />
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
        testID="sign-up-email"
      />
      <Input
        label="Contraseña"
        hint="Mínimo 8 caracteres."
        value={form.values.password}
        onChangeText={(value) => {
          form.setField("password", value);
        }}
        error={form.errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        testID="sign-up-password"
      />
      <FormError
        message={signUp.isError ? getAuthErrorMessage(signUp.error) : null}
        testID="sign-up-error"
      />
      <Button onPress={onSubmit} loading={signUp.isPending} testID="sign-up-submit">
        Crear cuenta
      </Button>
    </View>
  );
}
