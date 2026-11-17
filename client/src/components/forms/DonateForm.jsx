import { useState, useEffect } from 'react';
import { submitDonation, getDonationCurrencies } from '../../services/donationService';

const formatMoney = (value, symbol) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPreset = (value, symbol) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return `${symbol}${num.toLocaleString()}`;
};

export default function DonateForm() {
  const [currencies, setCurrencies] = useState([]);
  const [defaultCurrency, setDefaultCurrency] = useState('NGN');
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
    payment: 'opay',
  });
  const [loading, setLoading] = useState(false);
  const [currenciesLoading, setCurrenciesLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getDonationCurrencies().then((data) => {
      if (!mounted) return;
      const payload = data.data || data;
      setCurrencies(payload.currencies || []);
      setDefaultCurrency(payload.defaultCurrency || 'NGN');
      setCurrenciesLoading(false);
    }).catch(() => {
      if (!mounted) return;
      setCurrenciesLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const availableCurrencies = currencies.filter((c) => c.available);
  const selectedCurrency = currencies.find((c) => c.code === formData.currency) || availableCurrencies[0] || { code: 'NGN', name: 'Nigerian Naira', symbol: '\u20a6', presets: [5000, 10000, 25000, 50000, 100000], minimum: 100, maximum: 10000000 };

  useEffect(() => {
    if (currenciesLoading || availableCurrencies.length === 0) return;
    const currentlyAvailable = availableCurrencies.some((c) => c.code === formData.currency);
    if (!currentlyAvailable) {
      setFormData((prev) => ({ ...prev, currency: defaultCurrency, amount: '' }));
    } else {
      setFormData((prev) => ({ ...prev, amount: '' }));
    }
  }, [currenciesLoading, availableCurrencies, formData.currency, defaultCurrency]);

  const presets = selectedCurrency.presets || [];
  const symbol = selectedCurrency.symbol || '';
  const code = selectedCurrency.code || formData.currency;
  const name = selectedCurrency.name || '';
  const min = selectedCurrency.minimum ?? 100;
  const max = selectedCurrency.maximum ?? 10000000;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const selectPreset = (amount) => {
    setFormData({ ...formData, amount: String(amount) });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      await submitDonation({ ...formData, amount: Number(formData.amount), paymentMethod: formData.payment, currency: formData.currency });
      setSuccess('Thank you for your generous donation!');
      setFormData({
        firstName: '', lastName: '', email: '', phone: '', amount: '',
        currency: defaultCurrency, purpose: '', message: '', anonymous: false, payment: 'opay',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const amountNumber = Number(formData.amount);
  const chargeDisplay = Number.isFinite(amountNumber) && amountNumber >= 0
    ? `${formatMoney(amountNumber, symbol)} (${code})`
    : '';

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Make a Donation</h2>

      {success && <p className="text-green-600 bg-green-50 p-3 rounded">{success}</p>}
      {error && <p className="text-red-600 bg-red-50 p-3 rounded">{error}</p>}

      {currenciesLoading ? (
        <p className="text-sm text-gray-500 text-center">Loading payment options…</p>
      ) : availableCurrencies.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded">
          Online giving is not configured yet. Please contact the church office to make a donation.
        </div>
      ) : (
        <>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
              <select name="currency" value={formData.currency} onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Donation amount</label>
              <div className="flex items-end gap-2">
                <span className="text-sm font-medium text-gray-500">{symbol}</span>
                <input type="number" name="amount" value={formData.amount} onChange={handleChange} required min={min} max={max} step="0.01" className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">Range: {symbol}{min.toLocaleString()} – {symbol}{max.toLocaleString()}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suggested amounts</label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectPreset(p)}
                  className={`px-3 py-1.5 rounded border text-sm font-medium transition ${formData.amount === String(p) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'}`}
                >
                  {formatPreset(p, symbol)}
                </button>
              ))}
            </div>
          </div>

          {chargeDisplay && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded text-sm">
              You will be charged: <strong>{chargeDisplay}</strong>
            </div>
          )}

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
              {availableCurrencies.flatMap((c) => c.supportedProviders).filter((v, i, a) => a.indexOf(v) === i).map((method) => (
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
        </>
      )}
    </form>
  );
}
