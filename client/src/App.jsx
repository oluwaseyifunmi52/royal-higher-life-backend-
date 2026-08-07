import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthProvider from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';
import ContactForm from './components/forms/ContactForm';
import PrayerForm from './components/forms/PrayerForm';
import DonateForm from './components/forms/DonateForm';
import ReviewForm from './components/forms/ReviewForm';
import EventRegistrationForm from './components/forms/EventRegistrationForm';
import VolunteerForm from './components/forms/VolunteerForm';
import PartnershipForm from './components/forms/PartnershipForm';
import NewsletterForm from './components/forms/NewsletterForm';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/contact" element={<div className="py-16 px-4 max-w-2xl mx-auto"><h1 className="text-3xl font-bold mb-8 text-center">Contact Us</h1><ContactForm /></div>} />
            <Route path="/prayer" element={<div className="py-16 px-4 max-w-2xl mx-auto"><h1 className="text-3xl font-bold mb-8 text-center">Prayer Request</h1><PrayerForm /></div>} />
            <Route path="/donate" element={<div className="py-16 px-4 max-w-2xl mx-auto"><h1 className="text-3xl font-bold mb-8 text-center">Make a Donation</h1><DonateForm /></div>} />
            <Route path="/reviews" element={<div className="py-16 px-4 max-w-2xl mx-auto"><h1 className="text-3xl font-bold mb-8 text-center">Testimonies & Reviews</h1><ReviewForm /></div>} />
            <Route path="/events" element={<div className="py-16 px-4 max-w-2xl mx-auto"><h1 className="text-3xl font-bold mb-8 text-center">Event Registration</h1><EventRegistrationForm /></div>} />
            <Route path="/volunteer" element={<div className="py-16 px-4 max-w-2xl mx-auto"><h1 className="text-3xl font-bold mb-8 text-center">Volunteer Registration</h1><VolunteerForm /></div>} />
            <Route path="/partnership" element={<div className="py-16 px-4 max-w-2xl mx-auto"><h1 className="text-3xl font-bold mb-8 text-center">Partnership Application</h1><PartnershipForm /></div>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
