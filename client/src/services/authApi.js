import api from '../api/axios';

export const register = async (data) => {
  const res = await api.post('/api/auth/register', data);
  return res.data;
};

export const login = async (data) => {
  const res = await api.post('/api/auth/login', data);
  return res.data;
};

export const verifyEmail = async (data) => {
  const res = await api.post('/api/auth/verify-email', data);
  return res.data;
};

export const resendOtp = async (email) => {
  const res = await api.post('/api/auth/resend-otp', { email });
  return res.data;
};

export const forgotPassword = async (email) => {
  const res = await api.post('/api/auth/forgot-password', { email });
  return res.data;
};

export const resetPassword = async (data) => {
  const res = await api.post('/api/auth/reset-password', data);
  return res.data;
};

export const getProfile = async () => {
  const res = await api.get('/api/auth/profile');
  return res.data;
};

export const updateProfile = async (data) => {
  const res = await api.put('/api/auth/profile', data);
  return res.data;
};

export const changePassword = async (data) => {
  const res = await api.put('/api/auth/change-password', data);
  return res.data;
};

export const uploadProfileImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  const res = await api.put('/api/auth/profile-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};
