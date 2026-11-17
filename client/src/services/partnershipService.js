import api from '../api/axios';

export const submitPartnership = async (data) => {
  const res = await api.post('/partnerships', data);
  return res.data;
};

export const getPartnerships = async () => {
  const res = await api.get('/partnerships');
  return res.data;
};
