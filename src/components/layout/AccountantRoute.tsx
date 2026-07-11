import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Guards the accountant section: only the `bugalter` role may reach these
 * routes. Any other role (incl. admin) is redirected home. The menu already
 * hides these items for non-bugalter; this blocks direct-URL access too.
 */
export default function AccountantRoute() {
  const { user } = useAuth();
  return user?.role === "bugalter" ? <Outlet /> : <Navigate to="/" replace />;
}
