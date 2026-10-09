import { NextRequest, NextResponse } from "next/server";
import { authUserService } from "@/lib/auth-user-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, password, name } = body;

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "A valid phone number is required." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const normalizedPhone = authUserService.normalizePhone(phone);
    const existingUser = authUserService.findUserByPhone(normalizedPhone);
    if (existingUser) {
      return NextResponse.json(
        { error: "This phone number is already registered. Please sign in." },
        { status: 409 }
      );
    }

    const newUser = authUserService.registerCredentialsUser(
      normalizedPhone,
      password,
      name
    );

    return NextResponse.json(
      {
        message: "Account created successfully! Welcome to Jungle Bet.",
        user: {
          id: newUser.id,
          name: newUser.name,
          phone: newUser.phone,
          provider: newUser.provider,
          providerAccountId: newUser.providerAccountId,
          balance: newUser.balance,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Failed to create account. Please try again.";
    console.error("[Register API Error]:", error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
