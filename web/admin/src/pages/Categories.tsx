import { useEffect, useState } from 'react';
import { 
  Menu, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Loader2,
  AlertCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';

export default function Categories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: ''
  });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/categories/');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
        setError(null);
      } else {
        setError('Failed to load categories.');
      }
    } catch (err) {
      setError('An error occurred while fetching data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenModal = (category: any = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        slug: category.slug
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        slug: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = editingCategory ? `/categories/${editingCategory.id}/` : '/categories/';
    const method = editingCategory ? 'PATCH' : 'POST';

    try {
      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchCategories();
      } else {
        const errData = await response.json();
        alert(`Error: ${JSON.stringify(errData)}`);
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to remove this category? This might affect products using it.')) {
      try {
        const response = await apiFetch(`/categories/${id}/`, { method: 'DELETE' });
        if (response.ok) {
          fetchCategories();
        } else {
          alert('Failed to delete category. It might be in use.');
        }
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-red" />
        <p className="text-sm font-serif italic text-brand-ink/40">Organizing categories...</p>
      </div>
    );
  }

  return (
    <div className="ma-spacing space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-xs font-medium text-brand-red tracking-[0.2em] uppercase mb-2">Structure</p>
          <h1 className="text-4xl font-serif font-bold">Taxonomy</h1>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-brand-ink text-white px-6 py-3 rounded-md text-sm font-medium hover:bg-brand-red transition-all shadow-lg hover:shadow-brand-red/20 group"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform" />
          <span>New Category</span>
        </button>
      </div>

      <div className="bg-white rounded-lg border border-brand-clay shadow-sm overflow-hidden">
        <div className="p-4 border-b border-brand-clay bg-brand-paper/30 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" size={18} />
            <input 
              type="text" 
              placeholder="Search categories..." 
              className=" Japanese-input w-full pl-10 pr-4 py-2 bg-white border border-brand-clay rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red transition-all"
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
            <button onClick={fetchCategories} className="text-brand-red text-sm font-bold hover:underline">Try again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-brand-paper">
                <tr>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">Category Name</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">Slug</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50">Products</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-wider text-brand-ink/50 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay">
                <AnimatePresence mode="popLayout">
                  {filteredCategories.map((category) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={category.id} 
                      className="hover:bg-brand-paper/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-brand-clay/20 rounded text-brand-red">
                            <Menu size={16} />
                          </div>
                          <span className="text-sm font-semibold text-brand-ink">{category.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs text-brand-ink/40 bg-brand-paper px-2 py-0.5 rounded">/{category.slug}</code>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium">{category.product_count} items</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenModal(category)}
                            className="p-2 hover:bg-brand-ink hover:text-white rounded-md transition-all"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(category.id)}
                            className="p-2 hover:bg-brand-red hover:text-white rounded-md transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredCategories.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <p className="font-serif italic text-brand-ink/30 text-lg">No categories defined yet.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
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
                  {editingCategory ? 'Update Category' : 'New Taxonomy Entry'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-brand-ink/40 hover:text-brand-red">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">Category Name</label>
                  <input 
                    required
                    className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red transition-all"
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
                      setFormData({...formData, name, slug: editingCategory ? formData.slug : slug});
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-brand-ink/50 font-bold">Slug (URL path)</label>
                  <div className="flex items-center">
                    <span className="text-xs text-brand-ink/30 mr-1">/</span>
                    <input 
                      required
                      className="w-full px-3 py-2 border border-brand-clay rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red transition-all font-mono"
                      value={formData.slug}
                      onChange={(e) => setFormData({...formData, slug: e.target.value})}
                    />
                  </div>
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
                    className="flex-1 px-4 py-2 bg-brand-ink text-white rounded-md text-sm hover:bg-brand-red transition-colors shadow-lg hover:shadow-brand-red/20"
                  >
                    {editingCategory ? 'Update Registry' : 'Confirm Entry'}
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
