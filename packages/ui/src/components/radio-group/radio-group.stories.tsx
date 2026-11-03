import type { Meta, StoryObj } from "@storybook/react-native-web-vite";
import { useState } from "react";
import { View } from "react-native";

import { RadioGroup, RadioOption } from "./radio-group";

const meta = {
  title: "UI/RadioGroup",
  component: RadioGroup,
  args: { label: "Modalidad de entrega" },
} satisfies Meta<typeof RadioGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

function FulfillmentExample({ label }: Readonly<{ label: string }>) {
  const [value, setValue] = useState<"pickup" | "delivery">("pickup");
  return (
    <RadioGroup label={label}>
      <RadioOption
        label="Retiro en farmacia"
        description="Retiras tu pedido en la Farmacia Comunitaria. No necesitas dirección."
        selected={value === "pickup"}
        onSelect={() => {
          setValue("pickup");
        }}
      />
      <RadioOption
        label="Despacho simulado"
        description="Simulación: usa solo datos ficticios."
        selected={value === "delivery"}
        onSelect={() => {
          setValue("delivery");
        }}
      />
    </RadioGroup>
  );
}

export const Cards: Story = { render: (args) => <FulfillmentExample label={args.label} /> };

const CATEGORIES = ["Todas", "Cardiovascular", "Salud mental", "Analgésicos"] as const;

function ChipsExample({ label }: Readonly<{ label: string }>) {
  const [value, setValue] = useState<string>("Todas");
  return (
    <RadioGroup label={label}>
      <View className="flex-row flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <RadioOption
            key={category}
            variant="chip"
            label={category}
            selected={value === category}
            onSelect={() => {
              setValue(category);
            }}
          />
        ))}
      </View>
    </RadioGroup>
  );
}

export const Chips: Story = {
  args: { label: "Categoría" },
  render: (args) => <ChipsExample label={args.label} />,
};
