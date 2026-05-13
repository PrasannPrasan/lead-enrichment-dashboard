import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getCurrentAdmin } from "@/lib/auth/session";

export default async function LoginPage() {
  const admin = await getCurrentAdmin();

  if (admin) {
    redirect("/admin");
  }

  return (
    <div className="container flex min-h-[calc(100vh-4rem)] items-center py-8">
      <LoginForm />
    </div>
  );
}
