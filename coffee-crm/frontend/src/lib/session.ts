import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./session-constants";

export { SESSION_COOKIE };

export function getSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}
