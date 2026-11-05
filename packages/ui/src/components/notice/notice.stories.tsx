import type { Meta, StoryObj } from "@storybook/react-native-web-vite";

import { TONES } from "../../lib/tones";
import { Button } from "../button/button";
import { Text } from "../text/text";
import { Notice } from "./notice";

const meta = {
  title: "UI/Notice",
  component: Notice,
  args: { tone: "success", title: "Pago simulado aprobado", announce: "status" },
  argTypes: {
    tone: { control: "select", options: TONES },
    announce: { control: "inline-radio", options: ["status", "alert"] },
  },
} satisfies Meta<typeof Notice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Success: Story = {
  render: (args) => (
    <Notice {...args}>
      <Text>Tu pedido P-000123 quedó en «Pago validado» y pronto comenzará su preparación.</Text>
      <Button>Ver seguimiento</Button>
    </Notice>
  ),
};

export const Rejected: Story = {
  args: { tone: "destructive", title: "Pago rechazado", announce: "alert" },
  render: (args) => (
    <Notice {...args}>
      <Text>Tu pago simulado fue rechazado. Puedes intentarlo de nuevo o cancelar el pedido.</Text>
      <Button>Intentar de nuevo</Button>
      <Button variant="outline">Ver mi pedido</Button>
    </Notice>
  ),
};

export const Warning: Story = {
  args: { tone: "warning", title: "No hay stock suficiente", announce: "alert" },
  render: (args) => (
    <Notice {...args}>
      <Text>No hay stock suficiente de: Losartán 50 mg. Tu pedido sigue pendiente.</Text>
    </Notice>
  ),
};

export const TitleOnly: Story = { args: { tone: "info", title: "Sin resultados" } };
