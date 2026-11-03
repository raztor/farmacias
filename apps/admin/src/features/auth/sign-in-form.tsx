"use client";

import { signInSchema } from "@repo/shared";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@repo/ui";
import type { SubmitEvent } from "react";

import { authClient } from "../../lib/auth-client";
import { useForm } from "../../lib/use-form";
import { FormAlert } from "./form-alert";
import { EMAIL_INPUT_PROPS, PASSWORD_INPUT_PROPS } from "./input-props";
import { useAuthSubmit } from "./use-auth-submit";

const INITIAL_VALUES = { email: "", password: "" };

type SignInFormProps = Readonly<{
  /** Same-origin path to open after signing in (already sanitized). */
  redirectTo: string;
}>;

/**
 * Email + password sign-in for administrators, validated with the shared `signInSchema`.
 * The role is checked by the `(admin)` layout after the redirect, not here.
 */
export function SignInForm({ redirectTo }: SignInFormProps) {
  const { fieldProps, validate } = useForm(signInSchema, INITIAL_VALUES);
  const { formError, submitting, run } = useAuthSubmit(redirectTo);

  const submit = () => {
    const data = validate();
    if (data === null) return;
    void run(() => authClient.signIn.email({ email: data.email, password: data.password }));
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle level={1}>Iniciar sesión</CardTitle>
        <CardDescription>Acceso exclusivo para administradores.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="Iniciar sesión"
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
        >
          <FormAlert message={formError} />
          <Input {...EMAIL_INPUT_PROPS} {...fieldProps("email")} onSubmitEditing={submit} />
          <Input
            {...PASSWORD_INPUT_PROPS}
            {...fieldProps("password")}
            autoComplete="current-password"
            onSubmitEditing={submit}
          />
          <Button onPress={submit} loading={submitting}>
            Iniciar sesión
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
