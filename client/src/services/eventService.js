import api from '../api/axios';

export const getEvents = async () => {
  const res = await api.get('/api/events');
  return res.data;
};

export const getEventById = async (id) => {
  const res = await api.get(`/api/events/${id}`);
  return res.data;
};

export const registerForEvent = async (data) => {
  const res = await api.post('/api/event-registrations', data);
  return res.data;
};

export const getEventRegistrations = async (eventId) => {
  const res = await api.get(`/api/event-registrations/event/${eventId}`);
  return res.data;
};
