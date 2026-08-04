import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

// Where each role belongs. Used both to bounce someone away from a panel
// that isn't theirs, and to send them to the right place after login.
const HOME_FOR_ROLE = {
  super_admin: "/superadmin",
  restaurant_admin: "/admin",
  staff: "/staff",
  unassigned: "/onboarding",
};

const PROTECTED_ROLES = {
  "/admin": ["restaurant_admin"],
  "/staff": ["restaurant_admin", "staff"],
  "/superadmin": ["super_admin"],
  "/onboarding": ["unassigned"],
};

const matchProtectedPrefix = (pathname) => {
  return Object.keys(PROTECTED_ROLES).find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const prefix = matchProtectedPrefix(pathname);
  if (!prefix) return NextResponse.next();

  // If Supabase isn't configured at all, let the page render its own
  // "not configured" state instead of redirecting into a login page that
  // can never succeed.
  if (!supabaseUrl || !supabaseKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() (not getSession()) re-validates the token against Supabase
  // Auth on every request, so a revoked/expired session is caught here
  // server-side rather than trusting whatever cookie is present.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  const allowedRoles = PROTECTED_ROLES[prefix];

  if (!role || !allowedRoles.includes(role)) {
    // Signed in, but this isn't their panel — send them to where they
    // actually belong instead of a bare "access denied".
    const destination = HOME_FOR_ROLE[role] || "/login";
    if (destination === pathname || pathname.startsWith(`${destination}/`)) {
      // Avoid a redirect loop for 'unassigned' users with nowhere to go.
      return response;
    }
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/superadmin/:path*", "/onboarding/:path*"],
};
