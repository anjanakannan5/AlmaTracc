import { useNavigate } from "react-router-dom";
import { FaSignOutAlt } from "react-icons/fa";
import { apiFetch } from "../api";

export default function LogoutButton() {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      const response = await apiFetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("The server could not end your session.");
      navigate("/login", { replace: true });
    } catch {
      window.alert("Could not sign out. Please check your connection and try again.");
    }
  }

  return (
    <button type="button" className="sidebar-link" onClick={handleLogout}>
      <FaSignOutAlt /> Sign out
    </button>
  );
}
