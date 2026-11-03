import type { Meta, StoryObj } from "@storybook/react-native-web-vite";

import { Text } from "./text";
import { TEXT_VARIANTS } from "./text.variants";

const meta = {
  title: "UI/Text",
  component: Text,
  args: {
    children: "Gestiona tu cuenta y tus preferencias desde un solo lugar.",
    variant: "body",
  },
  argTypes: {
    variant: { control: "select", options: TEXT_VARIANTS },
  },
} satisfies Meta<typeof Text>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Body: Story = {};

export const Muted: Story = { args: { variant: "muted" } };

export const Small: Story = { args: { variant: "small", children: "Actualizado hace 5 minutos" } };

export const Label: Story = { args: { variant: "label", children: "Correo electrónico" } };
