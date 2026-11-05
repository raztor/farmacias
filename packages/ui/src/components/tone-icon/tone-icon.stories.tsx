import type { Meta, StoryObj } from "@storybook/react-native-web-vite";
import { View } from "react-native";

import { TONES } from "../../lib/tones";
import { ToneIcon } from "./tone-icon";

const meta = {
  title: "UI/ToneIcon",
  component: ToneIcon,
  args: { tone: "success", size: "md" },
  argTypes: {
    tone: { control: "select", options: TONES },
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
} satisfies Meta<typeof ToneIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = {};

export const AllTones: Story = {
  render: (args) => (
    <View className="flex-row gap-3">
      {TONES.map((tone) => (
        <ToneIcon key={tone} {...args} tone={tone} />
      ))}
    </View>
  ),
};
