import type { Meta, StoryObj } from "@storybook/react-native-web-vite";

import { Timeline } from "./timeline";

const meta = {
  title: "UI/Timeline",
  component: Timeline,
  args: {
    label: "Historial del pedido",
    items: [
      { key: "1", title: "Pendiente de pago", meta: "Tú · 3 nov 2026, 10:40", tone: "warning" },
      { key: "2", title: "Pago validado", meta: "Sistema · 3 nov 2026, 10:41", tone: "info" },
      {
        key: "3",
        title: "En preparación",
        meta: "Farmacia · 3 nov 2026, 11:05",
        note: "Preparando en bodega central.",
        tone: "info",
      },
      {
        key: "4",
        title: "Listo para retiro",
        meta: "Farmacia · 3 nov 2026, 12:30",
        tone: "success",
        current: true,
      },
    ],
  },
} satisfies Meta<typeof Timeline>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OrderHistory: Story = {};

export const SingleMilestone: Story = {
  args: {
    items: [
      {
        key: "1",
        title: "Pendiente de pago",
        meta: "Tú · 3 nov 2026, 10:40",
        tone: "warning",
        current: true,
      },
    ],
  },
};
