import { useState } from 'react';
import { submitDonation } from '../../services/donationService';

export default function DonateForm() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    amount: '',
    currency: 'NGN',
    purpose: '',
    message: '',
    anonymous: false,
    payment: 'paystack',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      await submitDonation({ ...formData, amount: Number(formData.amount) });
      setSuccess('Thank you for your generous donation!');
      setFormData({
        firstName: '', lastName: '', email: '', phone: '', amount: '',
        currency: 'NGN', purpose: '', message: '', anonymous: false, payment: 'paystack',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Make a Donation</h2>

      {success && <p className="text-green-600 bg-green-50 p-3 rounded">{success}</p>}
      {error && <p className="text-red-600 bg-red-50 p-3 rounded">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
          <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
          <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
          <input type="number" name="amount" value={formData.amount} onChange={handleChange} required min="1" className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
          <select name="currency" value={formData.currency} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Purpose *</label>
        <select name="purpose" value={formData.purpose} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select a purpose</option>
          <option value="General Offering">General Offering</option>
          <option value="Church Planting">Church Planting</option>
          <option value="Building Project">Building Project</option>
          <option value="Evangelism">Evangelism</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
        <textarea name="message" value={formData.message} onChange={handleChange} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" name="anonymous" checked={formData.anonymous} onChange={handleChange} className="h-4 w-4 text-blue-600 rounded" />
        <label className="text-sm text-gray-700">Donate Anonymously</label>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</legend>
        <div className="flex gap-4">
          {['paystack', 'flutterwave', 'bank'].map((method) => (
            <label key={method} className="flex items-center gap-2">
              <input type="radio" name="payment" value={method} checked={formData.payment === method} onChange={handleChange} className="h-4 w-4 text-blue-600" />
              <span className="text-sm capitalize">{method}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" disabled={loading} className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-green-400 transition">
        {loading ? 'Submitting...' : 'Donate Now'}
      </button>
    </form>
  );
}
