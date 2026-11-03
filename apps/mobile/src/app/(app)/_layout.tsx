import { Stack } from "expo-router";

export const unstable_settings = { initialRouteName: "index" };

/** Screens draw their own titles inside `Screen`, which already handles safe areas. */
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Inicio" }} />
      <Stack.Screen name="profile" options={{ title: "Editar perfil" }} />
    </Stack>
  );
}
