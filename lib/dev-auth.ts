export type AuthUserLite = {
  id: string;
  email?: string | null;
};

export const DEV_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEV_USER_EMAIL = "dev@local";

export const DEV_AUTH_USER: AuthUserLite = {
  id: DEV_USER_ID,
  email: DEV_USER_EMAIL,
};

export function isDevAuthBypass() {
  return process.env.NODE_ENV === "development";
}

export function authUserOrDev<T extends AuthUserLite>(
  user: T | null | undefined,
): T | AuthUserLite | null {
  return user ?? (isDevAuthBypass() ? DEV_AUTH_USER : null);
}

export function emailOrDev(email: string | null | undefined) {
  return email ?? (isDevAuthBypass() ? DEV_USER_EMAIL : null);
}
