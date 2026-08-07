import api from '../api/axios';

export const submitReview = async (data) => {
  const res = await api.post('/api/reviews', data);
  return res.data;
};

export const getReviews = async () => {
  const res = await api.get('/api/reviews');
  return res.data;
};
