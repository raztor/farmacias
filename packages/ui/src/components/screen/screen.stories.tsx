import type { Meta, StoryObj } from "@storybook/react-native-web-vite";

import { Button } from "../button/button";
import { Card, CardContent, CardHeader, CardTitle } from "../card/card";
import { Heading } from "../heading/heading";
import { Text } from "../text/text";
import { Screen } from "./screen";

const meta = {
  title: "UI/Screen",
  component: Screen,
  args: { scroll: false, className: "min-h-96" },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Screen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Screen {...args}>
      <Heading>Inicio</Heading>
      <Text variant="muted">Este es el contenedor base de cada pantalla.</Text>
      <Button>Continuar</Button>
    </Screen>
  ),
};

const ITEMS = Array.from({ length: 12 }, (_, index) => index + 1);

export const Scrollable: Story = {
  args: { scroll: true, className: "h-96" },
  render: (args) => (
    <Screen {...args}>
      <Heading level={2}>Actividad reciente</Heading>
      {ITEMS.map((item) => (
        <Card key={item}>
          <CardHeader>
            <CardTitle>{`Movimiento ${item}`}</CardTitle>
          </CardHeader>
          <CardContent>
            <Text variant="muted">Detalle del movimiento registrado en tu cuenta.</Text>
          </CardContent>
        </Card>
      ))}
    </Screen>
  ),
};
