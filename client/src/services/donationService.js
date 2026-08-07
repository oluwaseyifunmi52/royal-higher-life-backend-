import api from '../api/axios';

export const submitDonation = async (data) => {
  const res = await api.post('/api/donations', data);
  return res.data;
};

export const getDonations = async () => {
  const res = await api.get('/api/donations');
  return res.data;
};
