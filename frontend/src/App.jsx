
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import AlumniDashboard from "./pages/AlumniDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AccountHelp from "./pages/AccountHelp";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<AccountHelp />} />
      <Route path="/forgot-roll-number" element={<AccountHelp />} />
      <Route
        path="/alumni"
        element={<ProtectedRoute role="alumni">{(user) => <AlumniDashboard user={user} />}</ProtectedRoute>}
      />
      <Route
        path="/admin"
        element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
