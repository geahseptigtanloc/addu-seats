/**
 * Root application component — routing and auth provider.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import SeatMap from './pages/SeatMap.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import { useSocket } from './hooks/useSocket.js';

import BuildingFloorSelector from './pages/BuildingFloorSelector.jsx';
import ReservationReceipt from './pages/ReservationReceipt.jsx';
import FrontDeskView from './pages/FrontDeskView.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import SeatReturn from './pages/SeatReturn.jsx';

function AppRoutes() {
  useSocket();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<BuildingFloorSelector />} />

      <Route path="/map/:building/:floor" element={<SeatMap />} />

      <Route
        path="/receipt"
        element={
          <ProtectedRoute>
            <ReservationReceipt />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/frontdesk"
        element={
          <ProtectedRoute staffOnly>
            <FrontDeskView />
          </ProtectedRoute>
        }
      />

      <Route
        path="/verify"
        element={
          <ProtectedRoute staffOnly>
            <VerifyPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/seat-return/:seatId"
        element={
          <ProtectedRoute>
            <SeatReturn />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
