import api from '../api/axios';

export const submitReview = async (data) => {
  const res = await api.post('/reviews', data);
  return res.data;
};

export const getReviews = async () => {
  const res = await api.get('/reviews');
  return res.data;
};
