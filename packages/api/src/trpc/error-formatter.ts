import type { TRPCDefaultErrorShape, TRPCError } from "@trpc/server";
import { z } from "zod";

import { INTERNAL_ERROR_MESSAGE } from "./error-mapping";

/** Nested validation errors (`z.treeifyError`), keyed like the procedure input. */
export type ZodErrorTree = {
  errors: string[];
  properties?: Record<string, ZodErrorTree | undefined>;
  items?: (ZodErrorTree | undefined)[];
};

export type ApiErrorShape = TRPCDefaultErrorShape & {
  data: TRPCDefaultErrorShape["data"] & {
    /** Present on BAD_REQUEST input validation errors, `null` otherwise. */
    zodError: ZodErrorTree | null;
  };
};

type FormatErrorOptions = {
  shape: TRPCDefaultErrorShape;
  error: TRPCError;
};

const getZodError = (error: TRPCError): z.core.$ZodError | null =>
  error.code === "BAD_REQUEST" && error.cause instanceof z.core.$ZodError ? error.cause : null;

const getMessage = (error: TRPCError, zodError: z.core.$ZodError | null): string => {
  if (error.code === "INTERNAL_SERVER_ERROR") return INTERNAL_ERROR_MESSAGE;
  // Zod messages are a JSON dump of every issue; the first issue is what a form shows.
  return zodError?.issues[0]?.message ?? error.message;
};

/**
 * tRPC error formatter: adds the zod error tree to validation errors and makes sure
 * internal errors (including those raised outside procedures) never leak details.
 */
export const formatError = ({ shape, error }: FormatErrorOptions): ApiErrorShape => {
  const zodError = getZodError(error);
  return {
    ...shape,
    message: getMessage(error, zodError),
    data: { ...shape.data, zodError: zodError ? z.treeifyError(zodError) : null },
  };
};
