import api from '../api/axios';

export const subscribeNewsletter = async (data) => {
  const res = await api.post('/api/newsletter', data);
  return res.data;
};

export const getSubscribers = async () => {
  const res = await api.get('/api/newsletter');
  return res.data;
};
