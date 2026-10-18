import { NextRequest, NextResponse } from "next/server";
import {
  generateAdminSessionToken,
  isValidAdminSessionToken,
  getAdminSessionEmail,
  isAuthorizedAdminEmail,
  AUTHORIZED_ADMIN_EMAILS,
  ADMIN_COOKIE_NAME,
} from "@/lib/admin-auth";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import {
  getClientIp,
  clearAdminFailedAttempts,
} from "@/lib/admin-rate-limit";

// Check session status
export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isAuthenticated = sessionCookie ? isValidAdminSessionToken(sessionCookie) : false;
  const email = sessionCookie ? getAdminSessionEmail(sessionCookie) : null;

  return NextResponse.json({
    authenticated: isAuthenticated,
    email: isAuthenticated ? email : null,
    authorizedEmails: AUTHORIZED_ADMIN_EMAILS,
  });
}

// Log in via account-bound Google / Firebase authentication
export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);

    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("authorization");
    const idToken =
      body?.idToken ||
      (authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null);

    // Enforce Account-Bound Firebase ID Token Auth:
    // Strictly limited to authorized administrators (zbrustkern@gmail.com, sentral@gmail.com)
    if (!idToken) {
      return NextResponse.json(
        {
          error:
            "Passphrase access has been permanently disabled. Administrator access requires signing in with an authorized Google account.",
        },
        { status: 400 }
      );
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid or expired Firebase authentication token." },
        { status: 401 }
      );
    }

    if (!decoded.email || !isAuthorizedAdminEmail(decoded.email)) {
      console.warn(`[AdminAuth] Access denied for unauthorized account: ${decoded.email || decoded.uid}`);
      return NextResponse.json(
        {
          error: `Access denied. The account (${decoded.email || decoded.uid}) is not authorized for administrator access. Permitted accounts: ${AUTHORIZED_ADMIN_EMAILS.join(", ")}.`,
        },
        { status: 403 }
      );
    }

    // Successfully verified administrator account
    await clearAdminFailedAttempts(clientIp);
    const token = generateAdminSessionToken(decoded.email);
    const response = NextResponse.json({
      success: true,
      email: decoded.email,
      authType: "firebase_user",
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error verifying admin auth";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Log out
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
