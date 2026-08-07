import api from '../api/axios';

export const submitPartnership = async (data) => {
  const res = await api.post('/api/partnerships', data);
  return res.data;
};

export const getPartnerships = async () => {
  const res = await api.get('/api/partnerships');
  return res.data;
};
