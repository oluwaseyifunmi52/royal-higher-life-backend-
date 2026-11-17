import api from '../api/axios';

export const submitDonation = async (data) => {
  const res = await api.post('/donations', data);
  return res.data;
};

export const getDonations = async () => {
  const res = await api.get('/donations');
  return res.data;
};

export const getDonationCurrencies = async () => {
  const res = await api.get('/donations/currencies');
  return res.data;
};
