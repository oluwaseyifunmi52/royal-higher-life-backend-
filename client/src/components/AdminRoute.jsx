import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { getProfile } from '../services/authApi';

export default function AdminRoute({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getProfile()
      .then((data) => setIsAdmin(data.role === 'admin'))
      .catch((err) => {
        console.error('Admin role check failed:', err.response?.status, err.message);
        setIsAdmin(false);
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-lg text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!token || !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
