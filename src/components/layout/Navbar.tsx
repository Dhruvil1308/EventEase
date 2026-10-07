import { Suspense } from "react";
import { NavbarShell } from "./NavbarView";
import { getCurrentProfile } from "@/lib/auth";

/**
 * Server shell: reads the session once per request and hands the nav a tiny
 * viewer object. Suspense keeps the rest of the page static while it resolves.
 */
export function Navbar() {
  return (
    <Suspense fallback={<NavbarShell viewer={null} />}>
      <NavbarSession />
    </Suspense>
  );
}

async function NavbarSession() {
  const profile = await getCurrentProfile();
  return <NavbarShell viewer={profile ? { name: profile.name, role: profile.role } : null} />;
}
