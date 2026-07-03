import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { isValidSessionCookie } from "@/lib/auth/session-secret";

export default async function Home() {
  const isAuthed = isValidSessionCookie(
    (await cookies()).get(AUTH_COOKIE_NAME)?.value,
  );
  redirect(isAuthed ? "/dashboard" : "/login");
}
