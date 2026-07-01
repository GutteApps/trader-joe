import { timingSafeEqual } from "node:crypto";

/**
 * Validate the bot's API key. The bot may send it either as
 *   Authorization: Bearer <key>
 * or
 *   X-API-Key: <key>
 * Comparison is constant-time to avoid leaking the key via timing.
 */
export function isAuthorized(req: Request): boolean {
  const expected = process.env.BOT_API_KEY;
  if (!expected) return false;

  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const provided = bearer ?? req.headers.get("x-api-key") ?? "";

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
