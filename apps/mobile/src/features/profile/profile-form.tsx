import { updateProfileSchema } from "@repo/shared";
import { Button, Input, Text } from "@repo/ui";
import { View } from "react-native";

import { FormError } from "../../components/form-error";
import { getApiErrorMessage } from "../../lib/error-message";
import { useZodForm } from "../../lib/use-zod-form";
import { useUpdateProfile } from "./use-profile";

type ProfileFormProps = Readonly<{ initialName: string }>;

/** Edits the display name, validated with the shared `updateProfileSchema`. */
export function ProfileForm({ initialName }: ProfileFormProps) {
  const form = useZodForm(updateProfileSchema, { name: initialName });
  const update = useUpdateProfile();

  const onSubmit = () => {
    const input = form.validate();
    if (input !== null) update.mutate(input);
  };

  return (
    <View className="gap-4">
      <Input
        label="Nombre"
        value={form.values.name}
        onChangeText={(value) => {
          form.setField("name", value);
          update.reset();
        }}
        error={form.errors.name}
        autoComplete="name"
        textContentType="name"
        onSubmitEditing={onSubmit}
        testID="profile-name-input"
      />
      <FormError message={update.isError ? getApiErrorMessage(update.error) : null} />
      {update.isSuccess ? (
        <Text role="status" className="text-success dark:text-success-dark">
          Perfil actualizado.
        </Text>
      ) : null}
      <Button onPress={onSubmit} loading={update.isPending} testID="profile-save">
        Guardar cambios
      </Button>
    </View>
  );
}
