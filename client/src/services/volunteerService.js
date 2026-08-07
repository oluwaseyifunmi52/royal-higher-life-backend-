import api from '../api/axios';

export const registerVolunteer = async (data) => {
  const res = await api.post('/api/volunteers', data);
  return res.data;
};

export const getVolunteers = async () => {
  const res = await api.get('/api/volunteers');
  return res.data;
};
