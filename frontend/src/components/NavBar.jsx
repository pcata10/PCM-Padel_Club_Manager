import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useConfig } from "../hooks/useConfig";

const getRole = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
};

export default function NavBar() {
  const navigate = useNavigate();
  const role = getRole();
  const [menuOpen, setMenuOpen] = useState(false);
  const config = useConfig();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <nav className="bg-black border-b border-neutral-800 shadow-2xl sticky top-0 z-40 w-full">
      <div className="w-full px-4 md:max-w-6xl md:mx-auto md:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link
            to="/admin/tournaments"
            className="text-xl md:text-2xl font-black text-yellow-400 tracking-wide drop-shadow flex items-center gap-2 hover:text-yellow-300 transition-colors"
          >
            🎾 {config.clubName || "JPadel Gestione Tornei"}
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-4">
            {role === "admin" && (
              <Link
                to="/admin/tournaments"
                className="px-6 py-2 bg-yellow-400 text-black font-extrabold rounded-xl shadow-md hover:bg-yellow-300 hover:shadow-yellow-400/20 hover:-translate-y-0.5 transition-all flex items-center gap-1.5"
              >
                🏆 Tornei
              </Link>
            )}
            <button
              onClick={logout}
              className="px-5 py-2 bg-neutral-900 border border-neutral-700 text-yellow-400 font-bold rounded-xl shadow-sm hover:bg-neutral-800 hover:text-yellow-300 hover:border-yellow-400/60 hover:-translate-y-0.5 transition-all"
            >
              Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-all gap-1.5"
          >
            <span
              className={`block w-5 h-0.5 bg-yellow-400 transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`}
            />
            <span
              className={`block w-5 h-0.5 bg-yellow-400 transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block w-5 h-0.5 bg-yellow-400 transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}
            />
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2 border-t border-neutral-800 pt-3">
            {role === "admin" && (
              <Link
                to="/admin/tournaments"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 bg-yellow-400 text-black font-extrabold rounded-2xl w-full hover:bg-yellow-300 transition-all"
              >
                🏆 Tornei
              </Link>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-3 px-4 py-3 bg-neutral-900 border border-neutral-800 text-yellow-400 font-bold rounded-2xl w-full hover:bg-neutral-800 transition-all"
            >
              🚪 Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
