import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getEvents } from '../services/eventService';
import { getReviews } from '../services/reviewService';
import { submitContact } from '../services/contactService';
import { subscribeNewsletter } from '../services/newsletterService';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [newsMsg, setNewsMsg] = useState('');

  useEffect(() => {
    getEvents().then(setEvents).catch(() => {});
    getReviews().then(setReviews).catch(() => {});
  }, []);

  const handleContact = async (e) => {
    e.preventDefault();
    try {
      await submitContact(contactForm);
      setContactMsg('Message sent!');
      setContactForm({ name: '', email: '', message: '' });
    } catch {
      setContactMsg('Failed to send message.');
    }
  };

  const handleNewsletter = async (e) => {
    e.preventDefault();
    try {
      await subscribeNewsletter({ email: newsletterEmail });
      setNewsMsg('Subscribed!');
      setNewsletterEmail('');
    } catch {
      setNewsMsg('Subscription failed.');
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-indigo-700 text-white py-20 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Royal Higher Life</h1>
        <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto">
          Transforming lives through faith, prayer, and community.
        </p>
        <Link
          to="/donate"
          className="px-8 py-3 bg-white text-indigo-700 font-semibold rounded-lg hover:bg-gray-100"
        >
          Donate Now
        </Link>
      </section>

      {/* About */}
      <section className="py-16 px-4 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">About Us</h2>
        <p className="text-gray-600 text-lg">
          Royal Higher Life is a ministry committed to spreading the gospel,
          uplifting communities, and nurturing spiritual growth through
          events, outreach programs, and heartfelt prayer.
        </p>
      </section>

      {/* Featured Events */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Featured Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events.slice(0, 3).map((event) => (
              <div key={event._id} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
                <p className="text-gray-500 text-sm mb-2">
                  {new Date(event.date).toLocaleDateString()}
                </p>
                <p className="text-gray-600">{event.description?.slice(0, 100)}...</p>
              </div>
            ))}
            {events.length === 0 && (
              <p className="col-span-3 text-center text-gray-400">No upcoming events.</p>
            )}
          </div>
          <div className="text-center mt-6">
            <Link to="/events" className="text-indigo-600 font-medium hover:underline">
              View All Events →
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Testimonials</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.slice(0, 3).map((review) => (
              <div key={review._id} className="bg-white border rounded-lg p-6 shadow-sm">
                <p className="text-gray-600 italic mb-3">"{review.comment}"</p>
                <p className="text-sm font-semibold text-gray-800">— {review.name}</p>
              </div>
            ))}
            {reviews.length === 0 && (
              <p className="col-span-3 text-center text-gray-400">No testimonials yet.</p>
            )}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-indigo-50 py-16 px-4">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Stay Connected</h2>
          <p className="text-gray-600 mb-6">Subscribe to our newsletter for updates.</p>
          <form onSubmit={handleNewsletter} className="flex">
            <input
              type="email"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="flex-1 px-4 py-3 rounded-l-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-indigo-600 text-white rounded-r-lg hover:bg-indigo-700"
            >
              Subscribe
            </button>
          </form>
          {newsMsg && <p className="mt-2 text-green-600">{newsMsg}</p>}
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-16 px-4">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Contact Us</h2>
          <form onSubmit={handleContact} className="space-y-4">
            <input
              type="text"
              placeholder="Name"
              value={contactForm.name}
              onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
              required
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={contactForm.email}
              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              required
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              placeholder="Message"
              rows={4}
              value={contactForm.message}
              onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
              required
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Send Message
            </button>
          </form>
          {contactMsg && <p className="mt-2 text-center text-green-600">{contactMsg}</p>}
        </div>
      </section>
    </div>
  );
}
