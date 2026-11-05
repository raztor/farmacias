import type { Meta, StoryObj } from "@storybook/react-native-web-vite";

import { Button } from "../button/button";
import { Input } from "../input/input";
import { Text } from "../text/text";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const meta = {
  title: "UI/Card",
  component: Card,
  args: { className: "max-w-md" },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Plan Pro</CardTitle>
        <CardDescription>Ideal para equipos que están creciendo.</CardDescription>
      </CardHeader>
      <CardContent>
        <Text>Incluye usuarios ilimitados, reportes avanzados y soporte prioritario.</Text>
      </CardContent>
      <CardFooter>
        <Button>Contratar</Button>
        <Button variant="ghost">Más información</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithForm: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Ingresa tus credenciales para continuar.</CardDescription>
      </CardHeader>
      <CardContent>
        <Input label="Correo electrónico" placeholder="nombre@ejemplo.cl" />
        <Input label="Contraseña" secureTextEntry />
      </CardContent>
      <CardFooter>
        <Button className="flex-1">Entrar</Button>
      </CardFooter>
    </Card>
  ),
};
