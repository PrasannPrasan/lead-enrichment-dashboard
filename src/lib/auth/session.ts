import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/options";

export async function getCurrentAdmin() {
  const session = await getServerSession(authOptions);

  if (session?.user?.email && session.user.role === "admin") {
    return session.user;
  }

  return null;
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    throw new Error("Unauthorized");
  }

  return admin;
}
