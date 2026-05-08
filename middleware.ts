import { type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/api/chat/:path*",
    "/api/chat-full/:path*",
    "/api/write/:path*",
    "/api/lit/item-state",
    "/api/lit/link/:path*",
    "/api/lit/idea/:path*",
  ],
};
