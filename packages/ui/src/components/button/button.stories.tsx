import type { Meta, StoryObj } from "@storybook/react-native-web-vite";
import { View } from "react-native";

import { Button } from "./button";
import { BUTTON_SIZES, BUTTON_VARIANTS } from "./button.variants";

const meta = {
  title: "UI/Button",
  component: Button,
  args: {
    children: "Guardar cambios",
    variant: "primary",
    size: "md",
    loading: false,
    disabled: false,
  },
  argTypes: {
    variant: { control: "select", options: BUTTON_VARIANTS },
    size: { control: "inline-radio", options: BUTTON_SIZES },
    onPress: { action: "pressed" },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: "secondary", children: "Cancelar" } };

export const Outline: Story = { args: { variant: "outline", children: "Ver detalles" } };

export const Ghost: Story = { args: { variant: "ghost", children: "Omitir" } };

export const Destructive: Story = { args: { variant: "destructive", children: "Eliminar cuenta" } };

export const Loading: Story = { args: { loading: true, children: "Guardando…" } };

export const Disabled: Story = { args: { disabled: true } };

export const Sizes: Story = {
  render: (args) => (
    <View className="flex-row flex-wrap items-center gap-3">
      {BUTTON_SIZES.map((size) => (
        <Button key={size} {...args} size={size}>
          {`Tamaño ${size}`}
        </Button>
      ))}
    </View>
  ),
};

export const AllVariants: Story = {
  render: (args) => (
    <View className="gap-3">
      {BUTTON_VARIANTS.map((variant) => (
        <Button key={variant} {...args} variant={variant}>
          {variant}
        </Button>
      ))}
    </View>
  ),
};
