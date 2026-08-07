import api from '../api/axios';

export const getAdminSermons = async () => {
  const res = await api.get('/api/sermons');
  return res.data;
};

export const createSermon = async (data) => {
  const res = await api.post('/api/sermons', data);
  return res.data;
};

export const updateSermon = async (id, data) => {
  const res = await api.put(`/api/sermons/${id}`, data);
  return res.data;
};

export const deleteSermon = async (id) => {
  const res = await api.delete(`/api/sermons/${id}`);
  return res.data;
};

export const getAdminEvents = async () => {
  const res = await api.get('/api/events');
  return res.data;
};

export const createEvent = async (data) => {
  const res = await api.post('/api/events', data);
  return res.data;
};

export const updateEvent = async (id, data) => {
  const res = await api.put(`/api/events/${id}`, data);
  return res.data;
};

export const deleteEvent = async (id) => {
  const res = await api.delete(`/api/events/${id}`);
  return res.data;
};

export const getAdminMinistries = async () => {
  const res = await api.get('/api/ministries');
  return res.data;
};

export const createMinistry = async (data) => {
  const res = await api.post('/api/ministries', data);
  return res.data;
};

export const updateMinistry = async (id, data) => {
  const res = await api.put(`/api/ministries/${id}`, data);
  return res.data;
};

export const deleteMinistry = async (id) => {
  const res = await api.delete(`/api/ministries/${id}`);
  return res.data;
};

export const getAdminGallery = async () => {
  const res = await api.get('/api/gallery');
  return res.data;
};

export const createGalleryItem = async (data) => {
  const res = await api.post('/api/gallery', data);
  return res.data;
};

export const updateGalleryItem = async (id, data) => {
  const res = await api.put(`/api/gallery/${id}`, data);
  return res.data;
};

export const deleteGalleryItem = async (id) => {
  const res = await api.delete(`/api/gallery/${id}`);
  return res.data;
};

export const getAnnouncements = async () => {
  const res = await api.get('/api/announcements');
  return res.data;
};

export const createAnnouncement = async (data) => {
  const res = await api.post('/api/announcements', data);
  return res.data;
};

export const deleteAnnouncement = async (id) => {
  const res = await api.delete(`/api/announcements/${id}`);
  return res.data;
};

export const getDashboard = async () => {
  const res = await api.get('/api/dashboard');
  return res.data;
};

export const getAdminOverview = async () => {
  const res = await api.get('/api/admin/overview');
  return res.data;
};
