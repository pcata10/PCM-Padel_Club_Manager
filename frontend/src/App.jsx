import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

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

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/admin/tournaments", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, []);

  return null; // Redirects immediately
}

export default App;
