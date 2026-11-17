import api from '../api/axios';

export const getAdminSermons = async () => {
  const res = await api.get('/sermons');
  return res.data;
};

export const createSermon = async (data) => {
  const res = await api.post('/sermons', data);
  return res.data;
};

export const updateSermon = async (id, data) => {
  const res = await api.put(`/sermons/${id}`, data);
  return res.data;
};

export const deleteSermon = async (id) => {
  const res = await api.delete(`/sermons/${id}`);
  return res.data;
};

export const getAdminEvents = async () => {
  const res = await api.get('/events');
  return res.data;
};

export const createEvent = async (data) => {
  const res = await api.post('/events', data);
  return res.data;
};

export const updateEvent = async (id, data) => {
  const res = await api.put(`/events/${id}`, data);
  return res.data;
};

export const deleteEvent = async (id) => {
  const res = await api.delete(`/events/${id}`);
  return res.data;
};

export const getAdminMinistries = async () => {
  const res = await api.get('/ministries');
  return res.data;
};

export const createMinistry = async (data) => {
  const res = await api.post('/ministries', data);
  return res.data;
};

export const updateMinistry = async (id, data) => {
  const res = await api.put(`/ministries/${id}`, data);
  return res.data;
};

export const deleteMinistry = async (id) => {
  const res = await api.delete(`/ministries/${id}`);
  return res.data;
};

export const getAdminGallery = async () => {
  const res = await api.get('/gallery');
  return res.data;
};

export const createGalleryItem = async (data) => {
  const res = await api.post('/gallery', data);
  return res.data;
};

export const updateGalleryItem = async (id, data) => {
  const res = await api.put(`/gallery/${id}`, data);
  return res.data;
};

export const deleteGalleryItem = async (id) => {
  const res = await api.delete(`/gallery/${id}`);
  return res.data;
};

export const getAnnouncements = async () => {
  const res = await api.get('/announcements');
  return res.data;
};

export const createAnnouncement = async (data) => {
  const res = await api.post('/announcements', data);
  return res.data;
};

export const deleteAnnouncement = async (id) => {
  const res = await api.delete(`/announcements/${id}`);
  return res.data;
};

export const updateAnnouncement = async (id, data) => {
  const res = await api.put(`/announcements/${id}`, data);
  return res.data;
};

export const getDashboard = async () => {
  const res = await api.get('/dashboard');
  return res.data;
};

export const getAdminOverview = async () => {
  const res = await api.get('/admin/overview');
  return res.data;
};