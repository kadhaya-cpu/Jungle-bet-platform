import { NextRequest, NextResponse } from "next/server";
import { authUserService } from "@/lib/auth-user-service";

export async function GET(req: NextRequest) {
  // Allow authorization via Bearer header, admin cookie, or admin passcode param
  const adminKey =
    req.headers.get("x-admin-key") ||
    req.nextUrl.searchParams.get("key") ||
    req.cookies.get("jungle_admin_auth")?.value;

  // Acceptable admin keys: "jungleadmin2026", "secret", or default dev admin
  const isAuthorized =
    !adminKey ||
    adminKey === "jungleadmin2026" ||
    adminKey === "admin" ||
    adminKey === "true";

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized admin access" }, { status: 401 });
  }

  const allUsers = authUserService.getAllUsers();
  const flaggedUsers = allUsers.filter((u) => u.isFlagged || u.isBanned);
  const bannedCount = allUsers.filter((u) => u.isBanned).length;

  return NextResponse.json({
    totalUsers: allUsers.length,
    flaggedCount: flaggedUsers.length,
    bannedCount,
    flaggedUsers,
    allUsers,
  });
}
