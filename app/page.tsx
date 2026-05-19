import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE } from "@/lib/auth/constants";

export default async function Home() {
  const isAuthed =
    (await cookies()).get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;
  redirect(isAuthed ? "/dashboard" : "/login");
}
