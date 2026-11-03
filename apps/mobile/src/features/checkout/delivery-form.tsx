import { Input, Text } from "@repo/ui";
import { View } from "react-native";

import type { ZodForm } from "../../lib/use-zod-form";
import type { DeliveryForm, DeliveryFormValues } from "./checkout.schema";

type DeliveryFormFieldsProps = Readonly<{
  form: ZodForm<DeliveryFormValues, DeliveryForm>;
  /** Field errors returned by the API (`data.zodError`), shown when the form has none. */
  serverErrors: Readonly<Record<string, string>>;
}>;

/** Synthetic delivery fields (D-04); each error is shown on its own field (HU-04 #2). */
export function DeliveryFormFields({ form, serverErrors }: DeliveryFormFieldsProps) {
  const errorOf = (field: keyof DeliveryFormValues) => form.errors[field] ?? serverErrors[field];
  const fieldProps = (field: keyof DeliveryFormValues) => ({
    value: form.values[field],
    onChangeText: (value: string) => {
      form.setField(field, value);
    },
    error: errorOf(field),
    testID: `delivery-${field}`,
  });

  return (
    <View className="gap-4">
      <Text variant="muted">
        Despacho simulado: escribe datos ficticios. No ingreses tu dirección, RUT ni teléfono
        reales.
      </Text>
      <Input
        label="Sector (obligatorio)"
        placeholder="Ej.: Lo Hermida"
        maxLength={60}
        {...fieldProps("sector")}
      />
      <Input
        label="Referencia de dirección (obligatoria)"
        placeholder="Ej.: Pasaje Ficticio 123"
        maxLength={120}
        {...fieldProps("addressReference")}
      />
      <Input
        label="Alias de contacto (obligatorio)"
        placeholder="Ej.: Vecina Ana"
        maxLength={60}
        {...fieldProps("contactAlias")}
      />
      <Input
        label="Indicaciones (opcional)"
        placeholder="Ej.: Tocar el timbre"
        maxLength={200}
        multiline
        {...fieldProps("instructions")}
      />
    </View>
  );
}
