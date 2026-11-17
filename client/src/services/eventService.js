import api from '../api/axios';

export const getEvents = async () => {
  const res = await api.get('/events');
  return res.data;
};

export const getEventById = async (id) => {
  const res = await api.get(`/events/${id}`);
  return res.data;
};

export const registerForEvent = async (data) => {
  const res = await api.post('/event-registrations', data);
  return res.data;
};

export const getEventRegistrations = async (eventId) => {
  const res = await api.get(`/event-registrations/event/${eventId}`);
  return res.data;
};
