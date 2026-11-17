import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getAdminSermons, createSermon, updateSermon, deleteSermon,
  getAdminEvents, createEvent, updateEvent, deleteEvent,
  getAdminMinistries, createMinistry, updateMinistry, deleteMinistry,
  getAdminGallery, createGalleryItem, updateGalleryItem, deleteGalleryItem,
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
} from '../services/adminService';

const adminTabs = ['Sermons', 'Events', 'Ministries', 'Gallery', 'Announcements'];

function Modal({ open, onClose, title, children }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const focusableElements = overlayRef.current?.querySelectorAll(
        'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements?.length) {
        setTimeout(() => focusableElements[0].focus(), 0);
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/50 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-slide-up"
      >
        <div className="flex items-center justify-between p-6 border-b border-navy-100">
          <h3 id="modal-title" className="text-lg font-bold text-navy-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-navy-400 hover:text-navy-600 rounded-lg hover:bg-navy-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const emptySermon = { title: '', speaker: '', description: '', date: '', scripture: '' };
const emptyEvent = { title: '', description: '', date: '', location: '', time: '' };
const emptyMinistry = { name: '', description: '' };
const emptyAnnouncement = { title: '', content: '', priority: 'normal' };

export default function Admin() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('Sermons');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [sermons, setSermons] = useState([]);
  const [events, setEvents] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [galleryFile, setGalleryFile] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    if (!token || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, e, m, g, a] = await Promise.all([
        getAdminSermons(),
        getAdminEvents(),
        getAdminMinistries(),
        getAdminGallery(),
        getAnnouncements(),
      ]);
      setSermons(s.sermons || s.data || s || []);
      setEvents(e.events || e.data || e || []);
      setMinistries(m.ministries || m.data || m || []);
      setGallery(g.gallery || g.data || g || []);
      setAnnouncements(a.announcements || a.data || a || []);
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError('Failed to load admin data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const openAdd = (type) => {
    setEditingId(null);
    setGalleryFile(null);
    if (type === 'Sermons') setForm({ ...emptySermon });
    else if (type === 'Events') setForm({ ...emptyEvent });
    else if (type === 'Ministries') setForm({ ...emptyMinistry });
    else if (type === 'Announcements') setForm({ ...emptyAnnouncement });
    else if (type === 'Gallery') setForm({ title: '', description: '' });
    setModalOpen(true);
  };

  const openEdit = (type, item) => {
    setEditingId(item._id);
    setGalleryFile(null);
    if (type === 'Gallery') setForm({ title: item.title || '', description: item.description || '' });
    else setForm({ ...item });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (activeTab === 'Sermons') {
        if (editingId) {
          await updateSermon(editingId, form);
        } else {
          await createSermon(form);
        }
      } else if (activeTab === 'Events') {
        if (editingId) {
          await updateEvent(editingId, form);
        } else {
          await createEvent(form);
        }
      } else if (activeTab === 'Ministries') {
        if (editingId) {
          await updateMinistry(editingId, form);
        } else {
          await createMinistry(form);
        }
      } else if (activeTab === 'Gallery') {
        const fd = new FormData();
        fd.append('title', form.title);
        fd.append('description', form.description);
        if (galleryFile) fd.append('image', galleryFile);
        if (editingId) {
          await updateGalleryItem(editingId, fd);
        } else {
          await createGalleryItem(fd);
        }
      } else if (activeTab === 'Announcements') {
        if (editingId) {
          await updateAnnouncement(editingId, form);
        } else {
          await createAnnouncement(form);
        }
      }
      setModalOpen(false);
      setSuccess(`${activeTab.slice(0, -1)} saved successfully.`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save.');
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    setError('');
    setSuccess('');
    try {
      if (type === 'Sermons') await deleteSermon(id);
      else if (type === 'Events') await deleteEvent(id);
      else if (type === 'Ministries') await deleteMinistry(id);
      else if (type === 'Gallery') await deleteGalleryItem(id);
      else if (type === 'Announcements') await deleteAnnouncement(id);
      setSuccess('Item deleted successfully.');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete.');
    }
  };

  const renderFormField = (label, key, type = 'text', opts = {}) => (
    <div key={key}>
      <label className="block text-sm font-medium text-navy-700 mb-1">{label}</label>
      {opts.type === 'textarea' ? (
        <textarea
          value={form[key] || ''}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          required
          rows={3}
          className="w-full px-4 py-2.5 border border-navy-200 rounded-xl focus:ring-2 focus:ring-gold-400 focus:border-gold-400 outline-none resize-none"
        />
      ) : opts.type === 'select' ? (
        <select
          value={form[key] || ''}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full px-4 py-2.5 border border-navy-200 rounded-xl focus:ring-2 focus:ring-gold-400 focus:border-gold-400 outline-none bg-white"
        >
          {opts.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={form[key] || ''}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          required
          className="w-full px-4 py-2.5 border border-navy-200 rounded-xl focus:ring-2 focus:ring-gold-400 focus:border-gold-400 outline-none"
        />
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-50">
        <div className="text-navy-500 text-lg">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-50 flex">
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-[var(--z-fixed)] w-64 bg-white border-r border-navy-100 transition-all duration-300 ease-in-out flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'w-20' : ''}`}
        aria-label="Admin sidebar"
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-navy-100">
          {!sidebarCollapsed && (
            <Link to="/admin" className="flex items-center gap-3 text-navy-900 font-display font-bold text-xl hover:opacity-80 transition-opacity" aria-label="Admin Dashboard Home">
              <span className="w-10 h-10 rounded-xl bg-navy-900 flex items-center justify-center text-white font-display font-bold text-lg">
                RH
              </span>
              <span>Admin Dashboard</span>
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="lg:hidden p-2 text-navy-600 hover:bg-navy-100 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M4 6h16M4 12h16M4 18h16" : "M6 18L18 6M6 6l12 12"} />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Admin navigation">
          {adminTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setError('');
                setSuccess('');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-body font-medium transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-gold-50 text-gold-700 font-semibold'
                  : 'text-navy-600 hover:bg-navy-50 hover:text-gold-600'
              } ${sidebarCollapsed ? 'justify-center' : ''}`}
              aria-current={activeTab === tab ? 'page' : undefined}
            >
              {!sidebarCollapsed && <span>{tab}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-navy-100 lg:hidden">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full px-4 py-2.5 bg-navy-100 text-navy-700 font-semibold text-body rounded-xl hover:bg-navy-200 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:pl-0 min-w-0">
        <header className="sticky top-0 z-[var(--z-sticky)] bg-white border-b border-navy-100 lg:hidden">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-navy-600 hover:bg-navy-100 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
              aria-label="Open sidebar"
              aria-expanded={sidebarOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-navy-900">Admin Dashboard</h1>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm text-gold-600 hover:text-gold-700 font-medium"
            >
              Back to Dashboard
            </button>
          </div>
        </header>

        <div className="lg:pl-64 min-h-[calc(100vh-4rem)]">
          <div className="container-custom py-8">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-navy-900">Admin Dashboard</h1>
              <div className="flex gap-3">
                <button
                  onClick={() => openAdd(activeTab)}
                  className="px-4 py-2 bg-gold-500 text-white font-semibold text-body rounded-xl hover:bg-gold-600 hover:shadow-gold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
                >
                  + Add {activeTab.slice(0, -1)}
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 bg-navy-100 text-navy-700 font-semibold text-body rounded-xl hover:bg-navy-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm animate-slide-down" role="alert">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-6 p-4 bg-green-50 text-green-600 rounded-xl text-sm animate-slide-down" role="status">
                {success}
              </div>
            )}

            <div className="mb-6 overflow-x-auto">
              <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1 overflow-x-auto">
                {adminTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab
                        ? 'bg-gold-500 text-white'
                        : 'text-navy-600 hover:bg-navy-50 hover:text-gold-600'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {activeTab === 'Sermons' && (
                <div className="overflow-x-auto">
                  <table className="w-full" role="grid">
                    <thead className="bg-navy-50 border-b border-navy-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-navy-600">Title</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-navy-600">Speaker</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-navy-600">Date</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-navy-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-100">
                      {sermons.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-navy-400">No sermons yet.</td>
                        </tr>
                      ) : (
                        sermons.map((item) => (
                          <tr key={item._id} className="hover:bg-navy-50 transition-colors">
                            <td className="px-4 py-4">
                              <div className="font-semibold text-navy-900">{item.title}</div>
                              {item.scripture && <div className="text-sm text-navy-500">{item.scripture}</div>}
                            </td>
                            <td className="px-4 py-4 text-navy-600">{item.speaker}</td>
                            <td className="px-4 py-4 text-navy-600">{item.date}</td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEdit('Sermons', item)}
                                  className="px-3 py-1.5 text-sm font-medium text-gold-600 hover:bg-gold-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete('Sermons', item._id)}
                                  className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'Events' && (
                <div className="overflow-x-auto">
                  <table className="w-full" role="grid">
                    <thead className="bg-navy-50 border-b border-navy-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-navy-600">Title</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-navy-600">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-navy-600">Location</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-navy-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-100">
                      {events.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-navy-400">No events yet.</td>
                        </tr>
                      ) : (
                        events.map((item) => (
                          <tr key={item._id} className="hover:bg-navy-50 transition-colors">
                            <td className="px-4 py-4 font-semibold text-navy-900">{item.title}</td>
                            <td className="px-4 py-4 text-navy-600">{item.date}</td>
                            <td className="px-4 py-4 text-navy-600">{item.location}</td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEdit('Events', item)}
                                  className="px-3 py-1.5 text-sm font-medium text-gold-600 hover:bg-gold-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete('Events', item._id)}
                                  className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'Ministries' && (
                <div className="overflow-x-auto">
                  <table className="w-full" role="grid">
                    <thead className="bg-navy-50 border-b border-navy-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-navy-600">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-navy-600">Description</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-navy-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-100">
                      {ministries.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-navy-400">No ministries yet.</td>
                        </tr>
                      ) : (
                        ministries.map((item) => (
                          <tr key={item._id} className="hover:bg-navy-50 transition-colors">
                            <td className="px-4 py-4 font-semibold text-navy-900">{item.name}</td>
                            <td className="px-4 py-4 text-navy-600 max-w-xs truncate">{item.description}</td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEdit('Ministries', item)}
                                  className="px-3 py-1.5 text-sm font-medium text-gold-600 hover:bg-gold-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete('Ministries', item._id)}
                                  className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'Gallery' && (
                <div className="p-4">
                  {gallery.length === 0 ? (
                    <p className="text-center text-navy-400 py-8">No gallery items yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {gallery.map((item) => (
                        <div key={item._id} className="bg-navy-50 rounded-xl overflow-hidden border border-navy-100">
                          {(item.image || item.imageUrl) && (
                            <div className="aspect-video relative overflow-hidden">
                              <img
                                src={item.image || item.imageUrl}
                                alt={item.title}
                                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          )}
                          <div className="p-4">
                            <h4 className="font-semibold text-navy-900 mb-1">{item.title}</h4>
                            <p className="text-sm text-navy-600 mb-3">{item.description}</p>
                            <button
                              onClick={() => handleDelete('Gallery', item._id)}
                              className="w-full px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Announcements' && (
                <div className="overflow-x-auto">
                  <table className="w-full" role="grid">
                    <thead className="bg-navy-50 border-b border-navy-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-navy-600">Title</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-navy-600">Content</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-navy-600">Priority</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-navy-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-100">
                      {announcements.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-navy-400">No announcements yet.</td>
                        </tr>
                      ) : (
                        announcements.map((item) => (
                          <tr key={item._id} className="hover:bg-navy-50 transition-colors">
                            <td className="px-4 py-4 font-semibold text-navy-900">{item.title}</td>
                            <td className="px-4 py-4 text-navy-600 max-w-xs truncate">{item.content}</td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                item.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                item.priority === 'important' ? 'bg-gold-100 text-gold-700' :
                                'bg-navy-100 text-navy-700'
                              }`}>
                                {item.priority}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <button
                                onClick={() => handleDelete('Announcements', item._id)}
                                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title={`${editingId ? 'Edit' : 'Add'} ${activeTab.slice(0, -1)}`}
          >
            <form onSubmit={handleSave} className="space-y-4">
              {activeTab === 'Sermons' && (
                <>
                  {renderFormField('Title', 'title')}
                  {renderFormField('Speaker', 'speaker')}
                  {renderFormField('Scripture', 'scripture')}
                  {renderFormField('Description', 'description', 'text', { type: 'textarea' })}
                  {renderFormField('Date', 'date', 'date')}
                </>
              )}
              {activeTab === 'Events' && (
                <>
                  {renderFormField('Title', 'title')}
                  {renderFormField('Description', 'description', 'text', { type: 'textarea' })}
                  {renderFormField('Date', 'date', 'date')}
                  {renderFormField('Time', 'time', 'time')}
                  {renderFormField('Location', 'location')}
                </>
              )}
              {activeTab === 'Ministries' && (
                <>
                  {renderFormField('Name', 'name')}
                  {renderFormField('Description', 'description', 'text', { type: 'textarea' })}
                </>
              )}
              {activeTab === 'Gallery' && (
                <>
                  {renderFormField('Title', 'title')}
                  {renderFormField('Description', 'description', 'text', { type: 'textarea' })}
                  <div>
                    <label className="block text-sm font-medium text-navy-700 mb-1">Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setGalleryFile(e.target.files[0])}
                      className="w-full text-sm text-navy-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gold-50 file:text-gold-700 hover:file:bg-gold-100"
                    />
                  </div>
                </>
              )}
              {activeTab === 'Announcements' && (
                <>
                  {renderFormField('Title', 'title')}
                  {renderFormField('Content', 'content', 'text', { type: 'textarea' })}
                  {renderFormField('Priority', 'priority', 'text', { type: 'select', options: ['normal', 'important', 'urgent'] })}
                </>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-navy-600 bg-navy-100 rounded-xl hover:bg-navy-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-xl hover:bg-gold-600 hover:shadow-gold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </Modal>
        </div>
      </div>
    </div>
  );
}