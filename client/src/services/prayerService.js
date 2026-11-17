import api from '../api/axios';

export const submitPrayer = async (data) => {
  const res = await api.post('/prayers', data);
  return res.data;
};

export const getPrayers = async () => {
  const res = await api.get('/prayers');
  return res.data;
};
