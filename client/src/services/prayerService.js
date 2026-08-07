import api from '../api/axios';

export const submitPrayer = async (data) => {
  const res = await api.post('/api/prayers', data);
  return res.data;
};

export const getPrayers = async () => {
  const res = await api.get('/api/prayers');
  return res.data;
};
