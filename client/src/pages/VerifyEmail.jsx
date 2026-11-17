import { useState, useEffect, useLocation } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { verifyEmail, resendOtp } from '../services/authApi';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const token = urlParams.get('token');

  const [form, setForm] = useState({ email: '', otp: '' });
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // If we have a token from the URL, use it for verification
  useEffect(() => {
    if (token) {
      // Automatically verify with the token from the URL
      const verifyWithToken = async () => {
        setLoading(true);
        setError('');
        try {
          const result = await verifyEmail(token);
          if (result.success) {
            setSuccess('Your email address has been verified successfully. You can now sign in.');
            navigate('/login');
          } else {
            setError(result.message || 'Verification failed.');
          }
        } catch (err) {
          setError(err.response?.data?.message || 'Verification failed.');
        } finally {
          setLoading(false);
        }
      };
      verifyWithToken();
    }
  }, [token, navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // If we have a token from URL, verify with it; otherwise use the form OTP
      const result = await verifyEmail(token || form.otp);
      if (result.success) {
        setSuccess('Your email address has been verified successfully. You can now sign in.');
        navigate('/login');
      } else {
        setError(result.message || 'Verification failed.');
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Verification failed.';
      setError(message);
      if (message.includes('expired') || message === '') {
        setError('This verification link has expired. Request a new verification link to continue.');
      } else if (message.includes('invalid')) {
        setError('This verification link is invalid or has already been used. Request a new verification link to continue.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!form.email) {
      setError('Please enter your email address first.');
      return;
    }
    setResending(true);
    setError('');
    setSuccess('');
    try {
      await resendOtp(form.email);
      setSuccess('A new verification link has been sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend verification link. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          {token ? 'Verify Email' : 'Verify Email'}
        </h2>
        <p className="text-center text-gray-500 mb-6">
          {token ? 'Enter your email address below' : 'Enter the verification code sent to your email'}
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="you@example.com"
            />
          </div>

          { !token && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
              <input
                type="text"
                name="otp"
                value={form.otp}
                onChange={handleChange}
                required
                maxLength={6}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-center text-lg tracking-[0.5em]"
                placeholder="000000"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : token ? 'Verify Email' : 'Verify Email'}
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
          >
            {resending ? 'Sending...' : 'Resend Verification Link'}
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-800">
            Back to Login
          </Link>
        </p>

        {loading && (
          <p className="text-center text-sm text-gray-500 mt-2">
            Please wait while the verification process completes.
          </p>
        )}
      </div>
    </div>
  );
}