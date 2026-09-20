import { cookies } from "next/headers";
import { ADMIN_COOKIE, validAdmin } from "@/lib/security";
import { AdminScreen } from "@/components/admin-screen";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const authenticated = validAdmin((await cookies()).get(ADMIN_COOKIE)?.value);
  return <AdminScreen authenticated={authenticated} />;
}
