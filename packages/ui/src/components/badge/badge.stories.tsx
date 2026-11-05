import type { Meta, StoryObj } from "@storybook/react-native-web-vite";
import { View } from "react-native";

import { TONES } from "../../lib/tones";
import { Badge } from "./badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  args: { children: "Disponible", tone: "success" },
  argTypes: { tone: { control: "select", options: TONES } },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Available: Story = {};

export const LowStock: Story = { args: { tone: "warning", children: "Quedan pocas unidades (3)" } };

export const OutOfStock: Story = { args: { tone: "destructive", children: "Sin stock" } };

export const AllTones: Story = {
  render: (args) => (
    <View className="gap-3">
      {TONES.map((tone) => (
        <Badge key={tone} {...args} tone={tone}>
          {`Estado ${tone}`}
        </Badge>
      ))}
    </View>
  ),
};
