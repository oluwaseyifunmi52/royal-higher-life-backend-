import api from '../api/axios';

export const submitContact = async (data) => {
  const res = await api.post('/api/contacts', data);
  return res.data;
};

export const getContacts = async () => {
  const res = await api.get('/api/contacts');
  return res.data;
};
