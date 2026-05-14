import { useEffect, useState } from 'react';
import { 
  UserSquare, 
  Search, 
  Shield, 
  Mail, 
  Plus,
  Loader2,
  AlertCircle,
  Calendar,
  MoreHorizontal,
  X,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';
export default function Staff() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    is_staff: true,
    is_superuser: false
  });

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/users/?is_staff=true');
      if (response.ok) {
        const data = await response.json();
        setStaff(data);
        setError(null);
      } else {
        setError('Failed to load internal team directory.');
      }
    } catch (err) {
      setError('An error occurred while fetching data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleOpenModal = (user: any = null) => {
    if (user) {
      setEditingStaff(user);
      setFormData({
        username: user.username || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        password: '', // Don't show password for existing users
        is_staff: user.is_staff,
        is_superuser: user.is_superuser
      });
    } else {
      setEditingStaff(null);
      setFormData({
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        is_staff: true,
        is_superuser: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEditing = !!editingStaff;
      const url = isEditing ? `/users/${editingStaff.id}/` : '/users/';
      const method = isEditing ? 'PATCH' : 'POST';
      
      const payload = { ...formData };
      // If editing and password is empty, don't send it
      if (isEditing && !payload.password) {
        delete (payload as any).password;
      }

      const response = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });
 
       if (response.ok) {
         setIsModalOpen(false);
         fetchStaff();
       } else {
         const errData = await response.json();
         alert(`Error: ${JSON.stringify(errData)}`);
       }
     } catch (err) {
       console.error('Submit error:', err);
     }
   };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this staff member? This action cannot be undone.')) return;
    
    try {
      const response = await apiFetch(`/users/${id}/`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchStaff();
      } else {
        alert('Failed to delete staff member.');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const filteredStaff = staff.filter(s => 
    s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.first_name + ' ' + s.last_name).toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-red" />
        <p className="text-sm font-serif italic text-brand-ink/40">Gathering the curator team...</p>
      </div>
    );
  }

  return (
    <div className="ma-spacing space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-xs font-medium text-brand-red tracking-[0.2em] uppercase mb-2">Internal Team</p>
          <h1 className="text-4xl font-serif font-bold">Staff & Curators</h1>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-all shadow-sm"
        >
          <Plus size={18} />
          <span>Add New Staff</span>
        </button>
      </div>

      <div className="bg-white rounded-lg border border-brand-clay shadow-sm overflow-hidden">
        <div className="p-4 border-b border-brand-clay bg-brand-paper/30">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" size={18} />
            <input 
              type="text" 
              placeholder="Search team members..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-brand-clay rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <div className="p-12 text-center space-y-4">
            <div className="inline-flex p-3 bg-red-50 text-brand-red rounded-full">
              <AlertCircle size={24} />
            </div>
            <p className="text-brand-ink/60 font-serif italic">{error}</p>
            <button onClick={fetchStaff} className="text-brand-red text-sm font-bold hover:underline">Try again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-brand-paper">
                <tr>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">Curator</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">Permission Level</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">Contact</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">Joined</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay">
                <AnimatePresence mode="popLayout">
                  {filteredStaff.map((user) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={user.id} 
                      className="hover:bg-brand-paper/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-md bg-brand-ink text-white flex items-center justify-center font-serif text-lg">
                            {user.username[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-brand-ink">
                              {user.first_name || user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
                            </p>
                            <p className="text-[10px] text-brand-ink/40 font-mono">ID: CUR-{user.id.toString().padStart(4, '0')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Shield size={14} className="text-brand-red" />
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/70">
                            {user.is_superuser ? 'Head Curator' : 'Staff Curator'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-brand-ink/60">
                          <Mail size={12} className="text-brand-ink/30" />
                          <span>{user.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-brand-ink/40">
                          <Calendar size={12} />
                          <span>{new Date(user.date_joined).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleOpenModal(user)}
                            className="p-2 hover:bg-brand-ink hover:text-white rounded-md transition-colors"
                            title="Edit"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(user.id)}
                            className="p-2 hover:bg-brand-red hover:text-white rounded-md transition-colors text-brand-red"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <p className="font-serif italic text-brand-ink/30 text-lg">No staff members found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-brand-ink/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-lg shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-brand-clay flex justify-between items-center bg-brand-paper/50">
                <h2 className="text-xl font-serif font-bold">
                  {editingStaff ? 'Update Staff Permissions' : 'Register New Staff Member'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-brand-ink/40 hover:text-brand-red">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">Username</label>
                  <input 
                    className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    placeholder="e.g. curator_john"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">First Name</label>
                    <input 
                      className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">Last Name</label>
                    <input 
                      className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">Email</label>
                  <input 
                    type="email"
                    className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">
                    {editingStaff ? 'New Password (optional)' : 'Temporary Password'}
                  </label>
                  <input 
                    type="password"
                    className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder={editingStaff ? "Leave blank to keep current" : "••••••••"}
                    required={!editingStaff}
                  />
                </div>
                <div className="space-y-4 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-brand-clay text-brand-red focus:ring-brand-red/20"
                      checked={formData.is_superuser}
                      onChange={(e) => setFormData({...formData, is_superuser: e.target.checked})}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-brand-ink group-hover:text-brand-red transition-colors">Head Curator Permissions</span>
                      <span className="text-[10px] text-brand-ink/40 uppercase tracking-tighter">Full system administrative access</span>
                    </div>
                  </label>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-brand-clay rounded-md text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-colors"
                  >
                    {editingStaff ? 'Update Staff Registry' : 'Confirm New Curator'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
