import { useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeNewsletter } from '../../services/newsletterService';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  const handleSubscribe = async (e) => {
    e.preventDefault();
    try {
      await subscribeNewsletter({ email });
      setMsg('Subscribed successfully!');
      setEmail('');
    } catch {
      setMsg('Subscription failed. Try again.');
    }
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="text-white text-lg font-bold mb-2">Royal Higher Life</h3>
          <p className="text-sm">
            A ministry dedicated to transforming lives through the power of
            God's Word, prayer, and community outreach.
          </p>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/" className="hover:text-white">Home</Link></li>
            <li><Link to="/about" className="hover:text-white">About</Link></li>
            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
            <li><Link to="/donate" className="hover:text-white">Donate</Link></li>
            <li><Link to="/events" className="hover:text-white">Events</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Contact Info</h4>
          <ul className="space-y-2 text-sm">
            <li>123 Ministry Street, Lagos, Nigeria</li>
            <li>+234 800 123 4567</li>
            <li>info@royalhigherlife.org</li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Newsletter</h4>
          <form onSubmit={handleSubscribe} className="flex">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              required
              className="flex-1 px-3 py-2 text-sm text-gray-900 rounded-l-lg focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-r-lg hover:bg-indigo-700"
            >
              Subscribe
            </button>
          </form>
          {msg && <p className="text-xs mt-1 text-green-400">{msg}</p>}
          <div className="flex space-x-4 mt-4">
            <a href="#" className="hover:text-white">Facebook</a>
            <a href="#" className="hover:text-white">Twitter</a>
            <a href="#" className="hover:text-white">Instagram</a>
            <a href="#" className="hover:text-white">YouTube</a>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700 text-center py-4 text-sm">
        &copy; {new Date().getFullYear()} Royal Higher Life. All rights reserved.
      </div>
    </footer>
  );
}
