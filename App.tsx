import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { Listing } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { BookingModal } from './components/BookingModal';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './pages/AuthPages';
import { InboxPage } from './pages/InboxPage';
import { ExplorePage } from './pages/ExplorePage';
import { ListingDetailsPage } from './pages/ListingDetailsPage';
import { VendorDashboard } from './pages/VendorDashboard';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminPage } from './pages/AdminPage';
import { SeedDataPage } from './pages/SeedDataPage';
import { CreateListingPage } from './pages/CreateListingPage';
import { EditListingPage } from './pages/EditListingPage';
import { SetupPage } from './pages/SetupPage';

// Initialize Convex client
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL!);

const AppContent = () => {
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const { loading } = useAuth();

  // Safety timeout increased to 5s to handle jitter retries smoothly
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (loading && !showContent) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <Loader2 className="w-10 h-10 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 selection:bg-teal-200 dark:selection:bg-teal-800 selection:text-teal-900 dark:selection:text-teal-100 flex flex-col">
      <Navbar cartCount={0} />
      <div className="flex-grow">
        <Routes>
          <Route path="/" element={<ExplorePage onBook={setSelectedListing} />} />
          <Route path="/listing/:id" element={<ListingDetailsPage onBook={setSelectedListing} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/vendor" element={<VendorDashboard onAddListing={() => {}} />} />
          <Route path="/vendor/create-listing" element={<CreateListingPage />} />
          <Route path="/vendor/edit-listing" element={<EditListingPage />} />
          <Route path="/trips" element={<CustomerDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminPage />} />
          <Route path="/seed" element={<SeedDataPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Footer />
      {selectedListing && <BookingModal listing={selectedListing} onClose={() => setSelectedListing(null)} />}
    </div>
  );
};

const App = () => {
  return (
    <ConvexAuthProvider client={convex}>
      <Router>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </ConvexAuthProvider>
  );
};

export default App;
