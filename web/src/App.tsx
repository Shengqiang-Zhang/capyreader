import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import LoginRoute from "@/routes/LoginRoute";
import ReaderRoute from "@/routes/ReaderRoute";

export default function App() {
  const { credentials } = useAuth();
  const authed = credentials !== null;

  return (
    <Routes>
      <Route
        path="/login"
        element={authed ? <Navigate to="/" replace /> : <LoginRoute />}
      />
      <Route
        path="/*"
        element={authed ? <ReaderRoute /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
