import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";

function ProtectedRoute({ children }) {
  const { auth } = useAuth();

  if (auth.loading) {
    return <div className="center-screen">Loading...</div>;
  }

  if (!auth.token) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

export default function App() {
  const { auth } = useAuth();

  return (
    <Routes>
      <Route path="/auth" element={auth.token ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
