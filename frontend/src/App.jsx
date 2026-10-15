/**
 * Root application component — routing and auth provider.
 */
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import SeatMap from './pages/SeatMap.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminVoidAll from './pages/AdminVoidAll.jsx';

import BuildingFloorSelector from './pages/BuildingFloorSelector.jsx';
import ReservationReceipt from './pages/ReservationReceipt.jsx';
import FrontDeskView from './pages/FrontDeskView.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import SeatReturn from './pages/SeatReturn.jsx';
import QrReservation from './pages/QrReservation.jsx';
import PrivacyPolicy from './pages/PrivacyPolicy.jsx';
import TermsOfService from './pages/TermsOfService.jsx';
import LegalAgreement from './pages/LegalAgreement.jsx';

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const legalPaths = ['/login', '/auth/callback', '/agree', '/privacy', '/terms', '/privacy-policy', '/terms-of-service'];
  if (!loading && user && !user.legalAcceptedAt && !legalPaths.includes(location.pathname)) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/agree?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<Login />} />
      <Route path="/agree" element={<LegalAgreement />} />

      <Route path="/" element={<BuildingFloorSelector />} />

      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />

      <Route path="/map/:building/:floor" element={<SeatMap />} />
      <Route path="/scan" element={<QrReservation />} />
      {/* Keep previously shared development links working; printed QRs use /scan. */}
      <Route path="/reserve" element={<QrReservation />} />
      <Route path="/reverify" element={<SeatReturn />} />

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
        path="/admin/void-all"
        element={
          <ProtectedRoute adminOnly>
            <AdminVoidAll />
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
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
