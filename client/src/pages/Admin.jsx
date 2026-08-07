import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAdminSermons, createSermon, updateSermon, deleteSermon,
  getAdminEvents, createEvent, updateEvent, deleteEvent,
  getAdminMinistries, createMinistry, deleteMinistry,
  getAdminGallery, createGalleryItem, deleteGalleryItem,
  getAnnouncements, createAnnouncement, deleteAnnouncement,
} from '../services/adminService';

const adminTabs = ['Sermons', 'Events', 'Ministries', 'Gallery', 'Announcements'];

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
          await createMinistry(form);
        } else {
          await createMinistry(form);
        }
      } else if (activeTab === 'Gallery') {
        const fd = new FormData();
        fd.append('title', form.title);
        fd.append('description', form.description);
        if (galleryFile) fd.append('image', galleryFile);
        await createGalleryItem(fd);
      } else if (activeTab === 'Announcements') {
        await createAnnouncement(form);
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {opts.type === 'textarea' ? (
        <textarea
          value={form[key] || ''}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          required
          rows={3}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
        />
      ) : opts.type === 'select' ? (
        <select
          value={form[key] || ''}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
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
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
        />
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500 text-lg">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
          <button onClick={() => navigate('/dashboard')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>
        )}

        <div className="flex gap-1 bg-white rounded-lg shadow-sm p-1 mb-6 overflow-x-auto">
          {adminTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">{activeTab}</h2>
            <button
              onClick={() => openAdd(activeTab)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
            >
              + Add {activeTab.slice(0, -1)}
            </button>
          </div>

          {/* Sermons */}
          {activeTab === 'Sermons' && (
            <div className="space-y-3">
              {sermons.length === 0 && <p className="text-gray-400 text-sm">No sermons yet.</p>}
              {sermons.map((item) => (
                <div key={item._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-800">{item.title}</h4>
                    <p className="text-sm text-gray-500">{item.speaker} - {item.date}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit('Sermons', item)} className="text-sm text-indigo-600 hover:text-indigo-800">Edit</button>
                    <button onClick={() => handleDelete('Sermons', item._id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Events */}
          {activeTab === 'Events' && (
            <div className="space-y-3">
              {events.length === 0 && <p className="text-gray-400 text-sm">No events yet.</p>}
              {events.map((item) => (
                <div key={item._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-800">{item.title}</h4>
                    <p className="text-sm text-gray-500">{item.date} - {item.location}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit('Events', item)} className="text-sm text-indigo-600 hover:text-indigo-800">Edit</button>
                    <button onClick={() => handleDelete('Events', item._id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ministries */}
          {activeTab === 'Ministries' && (
            <div className="space-y-3">
              {ministries.length === 0 && <p className="text-gray-400 text-sm">No ministries yet.</p>}
              {ministries.map((item) => (
                <div key={item._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-800">{item.name}</h4>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                  <button onClick={() => handleDelete('Ministries', item._id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                </div>
              ))}
            </div>
          )}

          {/* Gallery */}
          {activeTab === 'Gallery' && (
            <div className="space-y-3">
              {gallery.length === 0 && <p className="text-gray-400 text-sm">No gallery items yet.</p>}
              {gallery.map((item) => (
                <div key={item._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.title} className="w-16 h-16 object-cover rounded-lg" />
                    )}
                    <div>
                      <h4 className="font-semibold text-gray-800">{item.title}</h4>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete('Gallery', item._id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                </div>
              ))}
            </div>
          )}

          {/* Announcements */}
          {activeTab === 'Announcements' && (
            <div className="space-y-3">
              {announcements.length === 0 && <p className="text-gray-400 text-sm">No announcements yet.</p>}
              {announcements.map((item) => (
                <div key={item._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-800">{item.title}</h4>
                    <p className="text-sm text-gray-500">{item.content}</p>
                  </div>
                  <button onClick={() => handleDelete('Announcements', item._id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                </div>
              ))}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setGalleryFile(e.target.files[0])}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
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
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
