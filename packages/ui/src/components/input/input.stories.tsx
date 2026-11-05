import type { Meta, StoryObj } from "@storybook/react-native-web-vite";

import { Input } from "./input";

const meta = {
  title: "UI/Input",
  component: Input,
  args: {
    label: "Correo electrónico",
    placeholder: "nombre@ejemplo.cl",
    keyboardType: "email-address",
    autoCapitalize: "none",
    autoComplete: "email",
  },
  argTypes: {
    onChangeText: { action: "changed" },
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: "Te enviaremos un enlace para confirmar tu cuenta." },
};

export const WithError: Story = {
  args: { defaultValue: "nombre@", error: "Ingresa un correo electrónico válido." },
};

export const Password: Story = {
  args: {
    label: "Contraseña",
    placeholder: "Mínimo 8 caracteres",
    secureTextEntry: true,
    autoComplete: "password",
    keyboardType: "default",
  },
};

export const Disabled: Story = {
  args: { editable: false, defaultValue: "admin@ejemplo.cl" },
};
