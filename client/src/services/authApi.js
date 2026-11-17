import api from '../api/axios';

export const register = async (data) => {
  const res = await api.post('/auth/register', data);
  return res.data;
};

export const login = async (data) => {
  const res = await api.post('/auth/login', data);
  return res.data;
};

/** Verify email using a token from the verification URL */
export const verifyEmail = async (token) => {
  if (token) {
    const res = await api.post('/auth/verify-email', { token });
    return res.data;
  }
  // Fallback: no token provided – return an error for the UI to handle
  return { success: false, message: "No verification token found. Please use the resend function." };
};

/** Resend verification link */
export const resendOtp = async (email) => {
  const res = await api.post('/auth/resend-otp', { email });
  return res.data;
};

export const forgotPassword = async (email) => {
  const res = await api.post('/auth/forgot-password', { email });
  return res.data;
};

export const resetPassword = async (data) => {
  const res = await api.post('/auth/reset-password', data);
  return res.data;
};

export const getProfile = async () => {
  const res = await api.get('/auth/profile');
  return res.data;
};

export const updateProfile = async (data) => {
  const res = await api.put('/auth/profile', data);
  return res.data;
};

export const changePassword = async (data) => {
  const res = await api.put('/auth/change-password', data);
  return res.data;
};

export const uploadProfileImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  const res = await api.put('/auth/profile-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};