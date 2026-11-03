import type { Meta, StoryObj } from "@storybook/react-native-web-vite";
import { useState } from "react";

import { QuantityStepper } from "./quantity-stepper";

const meta = {
  title: "UI/QuantityStepper",
  component: QuantityStepper,
  args: {
    value: 1,
    max: 5,
    min: 1,
    itemLabel: "Losartán 50 mg",
    disabled: false,
    onChange: () => undefined,
  },
  argTypes: { onChange: { action: "changed" } },
} satisfies Meta<typeof QuantityStepper>;

export default meta;

type Story = StoryObj<typeof meta>;

function Controlled(props: Readonly<{ initial: number; max: number; itemLabel: string }>) {
  const [value, setValue] = useState(props.initial);
  return (
    <QuantityStepper
      value={value}
      onChange={setValue}
      max={props.max}
      itemLabel={props.itemLabel}
    />
  );
}

export const Interactive: Story = {
  render: (args) => <Controlled initial={args.value} max={args.max} itemLabel={args.itemLabel} />,
};

export const AtMaximum: Story = { args: { value: 5, max: 5 } };

export const SingleUnitLeft: Story = { args: { value: 1, max: 1 } };

export const Disabled: Story = { args: { disabled: true } };
