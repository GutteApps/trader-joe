import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorized } from "./auth";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json(
    { ok: false, error: message, ...(extra ? { details: extra } : {}) },
    { status },
  );
}

/** Returns a 401 response if the bot key is missing/invalid, else null. */
export function requireBot(req: Request) {
  if (!isAuthorized(req)) {
    return fail("Unauthorized: missing or invalid API key", 401);
  }
  return null;
}

/** Parse + validate a JSON body against a zod schema. */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<
  { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: fail("Invalid JSON body", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: fail("Validation failed", 422, parsed.error.flatten()),
    };
  }
  return { ok: true, data: parsed.data };
}
