import { useEffect, useState } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Loader2,
  AlertCircle,
  X,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { apiFetch } from '../lib/api';

export default function InventoryPage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    id: '',
    name: '',
    price: '',
    category: '',
    stock: '',
    description: '',
    brand: '',
    location: '',
    is_featured: false,
    is_new: false,
    is_limited: false,
    is_cheap: false,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiFetch('/products/'),
        apiFetch('/categories/')
      ]);
      
      if (prodRes.ok && catRes.ok) {
        const prodData = await prodRes.json();
        const catData = await catRes.json();
        setProducts(prodData);
        setCategories(catData);
        setError(null);
      } else {
        setError(t('inventory.errors.load_failed'));
      }
    } catch (err) {
      setError(t('inventory.errors.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (product: any = null) => {
    setCurrentStep(1);
    if (product) {
      setEditingProduct(product);
      setFormData({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category || '',
        stock: product.stock,
        description: product.description,
        brand: product.brand || '',
        location: product.location || '',
        is_featured: product.is_featured,
        is_new: product.is_new,
        is_limited: product.is_limited,
        is_cheap: product.is_cheap,
      });
      setPreviewUrl(product.image);
    } else {
      setEditingProduct(null);
      setFormData({
        id: `KOG-${Math.floor(1000 + Math.random() * 9000)}`,
        name: '',
        price: '',
        category: categories[0]?.id || '',
        stock: '1',
        description: '',
        brand: '',
        location: '',
        is_featured: false,
        is_new: true,
        is_limited: false,
        is_cheap: false,
      });
      setPreviewUrl(null);
    }
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleImageChange = (file: File) => {
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageChange(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData();
    Object.keys(formData).forEach(key => {
      data.append(key, formData[key]);
    });
    if (imageFile) {
      data.append('image', imageFile);
    }

    const endpoint = editingProduct ? `/products/${editingProduct.id}/` : '/products/';
    const method = editingProduct ? 'PATCH' : 'POST';

    try {
      const response = await apiFetch(endpoint, {
        method,
        body: data,
        headers: {} 
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        const errorData = await response.json();
        alert(`${t('common.error')}: ${JSON.stringify(errorData)}`);
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('inventory.confirm_delete'))) {
      try {
        const response = await apiFetch(`/products/${id}/`, { method: 'DELETE' });
        if (response.ok) {
          fetchData();
        }
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-red" />
        <p className="text-sm font-serif italic text-brand-ink/40">{t('inventory.loading')}</p>
      </div>
    );
  }

  const steps = [
    { number: 1, title: t('inventory.modal.steps.identity'), icon: Package },
    { number: 2, title: t('inventory.modal.steps.logistics'), icon: Filter },
    { number: 3, title: t('inventory.modal.steps.imagery'), icon: ImageIcon },
    { number: 4, title: t('inventory.modal.steps.narrative'), icon: Edit },
  ];

  return (
    <div className="ma-spacing space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1.5 h-6 bg-brand-red"></div>
            <p className="text-xs font-bold text-brand-red tracking-[0.3em] uppercase">{t('inventory.subtitle')}</p>
          </div>
          <h1 className="text-5xl font-serif font-bold text-brand-ink leading-tight">{t('inventory.title')}</h1>
          <p className="text-brand-ink/40 font-serif italic mt-2 text-lg">{t('inventory.description')}</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-3 bg-brand-ink text-white px-8 py-4 rounded-sm text-sm font-bold hover:bg-brand-red transition-all shadow-xl hover:shadow-brand-red/20 group"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" />
          <span className="tracking-widest uppercase">{t('inventory.add_button')}</span>
        </button>
      </div>

      <div className="bg-white rounded-sm border border-brand-clay shadow-xl overflow-hidden">
        <div className="p-6 border-b border-brand-clay bg-brand-paper/20 flex flex-col lg:flex-row gap-6 justify-between items-center">
          <div className="relative w-full lg:w-[480px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/20" size={20} />
            <input 
              type="text" 
              placeholder={t('inventory.search_placeholder')} 
              className="w-full pl-12 pr-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-2 px-4 py-2 bg-brand-clay/30 rounded-sm border border-brand-clay text-brand-ink/60 text-xs font-bold uppercase tracking-wider">
              <Filter size={14} />
              <span>{t('inventory.filter_by')}</span>
            </div>
            <select 
              className="flex-1 lg:w-48 px-4 py-2 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:border-brand-red transition-all"
              onChange={(e) => {
                setSearchQuery(e.target.value === 'all' ? '' : e.target.value);
              }}
            >
              <option value="all">{t('inventory.all_categories')}</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="p-12 text-center space-y-4">
            <div className="inline-flex p-3 bg-red-50 text-brand-red rounded-full">
              <AlertCircle size={24} />
            </div>
            <p className="text-brand-ink/60 font-serif italic">{error}</p>
            <button onClick={fetchData} className="text-brand-red text-sm font-bold hover:underline">Try again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-paper/50 border-b border-brand-clay">
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">{t('inventory.table.artifact')}</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">{t('inventory.table.reference')}</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">{t('inventory.table.classification')}</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">{t('inventory.table.valuation')}</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40 text-center">{t('inventory.table.logistics')}</th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40 text-right">{t('inventory.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay/50">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={product.id} 
                      className="hover:bg-brand-paper/30 transition-all duration-300 group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 rounded-sm overflow-hidden bg-brand-clay/10 border border-brand-clay/50 flex-shrink-0 relative">
                            {product.image ? (
                              <img 
                                src={product.image.startsWith('http') ? product.image : `http://127.0.0.1:8000${product.image}`} 
                                alt={product.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-brand-ink/10">
                                <Package size={24} strokeWidth={1} />
                              </div>
                            )}
                            {(product.is_featured || product.is_new) && (
                              <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                                {product.is_featured && <div className="absolute top-1 right-1 w-2 h-2 bg-brand-red rounded-full shadow-sm"></div>}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-base font-serif font-bold text-brand-ink group-hover:text-brand-red transition-colors">{product.name}</p>
                            <p className="text-xs text-brand-ink/40 font-medium tracking-wide">{product.brand || t('inventory.table.unknown_artisan')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-mono bg-brand-clay/20 text-brand-ink/60 px-2 py-1 rounded-sm border border-brand-clay/30 uppercase tracking-tighter">
                          {product.id}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-brand-ink/70">
                            {product.category_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-brand-ink">
                            ${parseFloat(product.price).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-24 h-1.5 bg-brand-clay rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min((product.stock / 50) * 100, 100)}%` }}
                              className={cn(
                                "h-full rounded-full transition-all duration-1000",
                                product.stock > 10 ? "bg-emerald-500" : product.stock > 0 ? "bg-amber-500" : "bg-brand-red"
                              )}
                            />
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest",
                            product.stock > 10 ? "text-emerald-600" : product.stock > 0 ? "text-amber-600" : "text-brand-red"
                          )}>
                            {product.stock > 0 ? `${product.stock} ${t('inventory.table.in_storage')}` : t('inventory.table.depleted')}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                          <button 
                            onClick={() => handleOpenModal(product)}
                            className="p-2.5 bg-white border border-brand-clay text-brand-ink hover:bg-brand-ink hover:text-white rounded-sm transition-all shadow-sm hover:shadow-md"
                            title={t('inventory.table.refine')}
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(product.id)}
                            className="p-2.5 bg-white border border-brand-clay text-brand-red hover:bg-brand-red hover:text-white rounded-sm transition-all shadow-sm hover:shadow-md"
                            title={t('inventory.table.decommission')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredProducts.length === 0 && !error && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-2 text-brand-ink/30">
                        <Search size={40} strokeWidth={1} />
                        <p className="font-serif italic">{t('inventory.table.empty')}</p>
                      </div>
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
              className="relative w-full max-w-4xl bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-brand-clay flex justify-between items-center bg-brand-paper/50">
                <div className="flex items-center gap-6">
                  <h2 className="text-2xl font-serif font-bold">
                    {editingProduct ? t('inventory.modal.update_title') : t('inventory.modal.new_title')}
                  </h2>
                  <div className="flex items-center gap-2">
                    {steps.map((step) => (
                      <div key={step.number} className="flex items-center gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                          currentStep === step.number 
                            ? "bg-brand-red text-white scale-110 shadow-lg shadow-brand-red/20" 
                            : currentStep > step.number 
                              ? "bg-brand-ink text-white" 
                              : "bg-brand-clay/30 text-brand-ink/30"
                        )}>
                          {step.number}
                        </div>
                        {step.number < 4 && <div className="w-4 h-[1px] bg-brand-clay"></div>}
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-brand-ink/40 hover:text-brand-red transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto bg-brand-paper/5">
                <form onSubmit={handleSubmit} className="p-8">
                  <AnimatePresence mode="wait">
                    {currentStep === 1 && (
                      <motion.div 
                        key="step1"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        className="space-y-8"
                      >
                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">{t('inventory.modal.id_label')}</label>
                            <input 
                              required
                              placeholder="e.g. KOG-9921"
                              disabled={!!editingProduct}
                              className="w-full px-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all disabled:bg-brand-paper/50"
                              value={formData.id}
                              onChange={(e) => setFormData({...formData, id: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">{t('inventory.modal.category_label')}</label>
                            <select 
                              required
                              className="w-full px-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:border-brand-red transition-all appearance-none cursor-pointer"
                              value={formData.category}
                              onChange={(e) => setFormData({...formData, category: e.target.value})}
                            >
                              <option value="" disabled>{t('inventory.modal.category_placeholder')}</option>
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">{t('inventory.modal.name_label')}</label>
                          <input 
                            required
                            placeholder="e.g. Hand-painted Edo-period Ceramic"
                            className="w-full px-6 py-4 bg-white border border-brand-clay rounded-sm text-lg font-serif font-bold text-brand-ink focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all shadow-sm"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                          />
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">{t('inventory.modal.attributes_label')}</label>
                          <div className="grid grid-cols-4 gap-4">
                            {[
                              { id: 'is_featured', label: 'Curated' },
                              { id: 'is_new', label: 'Recent' },
                              { id: 'is_limited', label: 'Limited' },
                              { id: 'is_cheap', label: 'Accessible' }
                            ].map(flag => (
                              <label key={flag.id} className={cn(
                                "flex flex-col items-center justify-center gap-3 p-4 rounded-sm border transition-all cursor-pointer group",
                                formData[flag.id] 
                                  ? "bg-brand-red/5 border-brand-red text-brand-red" 
                                  : "bg-white border-brand-clay text-brand-ink/40 hover:border-brand-ink/20"
                              )}>
                                <span className="text-[10px] font-bold uppercase tracking-widest">{flag.label}</span>
                                <input 
                                  type="checkbox" 
                                  className="hidden"
                                  checked={formData[flag.id]}
                                  onChange={(e) => setFormData({...formData, [flag.id]: e.target.checked})}
                                />
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  formData[flag.id] ? "bg-brand-red animate-pulse" : "bg-brand-clay"
                                )}></div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {currentStep === 2 && (
                      <motion.div 
                        key="step2"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        className="space-y-8"
                      >
                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">{t('inventory.modal.price_label')}</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/40 font-bold">$</span>
                              <input 
                                required
                                type="number"
                                step="0.01"
                                className="w-full pl-10 pr-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all"
                                value={formData.price}
                                onChange={(e) => setFormData({...formData, price: e.target.value})}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">{t('inventory.modal.stock_label')}</label>
                            <input 
                              required
                              type="number"
                              className="w-full px-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all"
                              value={formData.stock}
                              onChange={(e) => setFormData({...formData, stock: e.target.value})}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">{t('inventory.modal.brand_label')}</label>
                            <input 
                              placeholder="e.g. Takumi Workshop"
                              className="w-full px-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all"
                              value={formData.brand}
                              onChange={(e) => setFormData({...formData, brand: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">{t('inventory.modal.location_label')}</label>
                            <input 
                              placeholder="e.g. Kyoto, Japan"
                              className="w-full px-4 py-3 bg-white border border-brand-clay rounded-sm text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all"
                              value={formData.location}
                              onChange={(e) => setFormData({...formData, location: e.target.value})}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {currentStep === 3 && (
                      <motion.div 
                        key="step3"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        className="space-y-4"
                      >
                        <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">{t('inventory.modal.image_label')}</label>
                        <div 
                          onDragOver={onDragOver}
                          onDragLeave={onDragLeave}
                          onDrop={onDrop}
                          className={cn(
                            "relative aspect-[21/9] rounded-sm border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all duration-500",
                            isDragging ? "border-brand-red bg-brand-red/5 scale-[1.02]" : "border-brand-clay bg-white",
                            previewUrl && "border-solid"
                          )}
                        >
                          {previewUrl ? (
                            <>
                              <img 
                                src={previewUrl.startsWith('data') || previewUrl.startsWith('http') ? previewUrl : `http://127.0.0.1:8000${previewUrl}`} 
                                className="w-full h-full object-cover" 
                              />
                              <div className="absolute inset-0 bg-brand-ink/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                <label className="cursor-pointer bg-white text-brand-ink px-8 py-4 rounded-sm text-xs font-bold uppercase tracking-widest flex items-center gap-3 shadow-2xl hover:bg-brand-red hover:text-white transition-all">
                                  <Upload size={16} />
                                  {t('inventory.modal.image_update')}
                                  <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleImageChange(e.target.files[0])} />
                                </label>
                              </div>
                            </>
                          ) : (
                            <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-6 text-brand-ink/20 hover:text-brand-red/40 transition-all group">
                              <div className="p-8 bg-brand-paper rounded-full shadow-inner group-hover:scale-110 transition-transform duration-700 border border-brand-clay/30">
                                <ImageIcon size={64} strokeWidth={1} />
                              </div>
                              <div className="text-center space-y-2">
                                <span className="block text-xs font-bold uppercase tracking-[0.3em]">{t('inventory.modal.drop_asset')}</span>
                                <span className="block text-[10px] italic">{t('inventory.modal.click_browse')}</span>
                              </div>
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleImageChange(e.target.files[0])} />
                            </label>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {currentStep === 4 && (
                      <motion.div 
                        key="step4"
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        className="space-y-6"
                      >
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-[0.2em] text-brand-ink/40 font-bold">{t('inventory.modal.description_title')}</label>
                          <p className="text-[10px] text-brand-ink/30 italic mb-4">{t('inventory.modal.description_help')}</p>
                          <textarea 
                            rows={10}
                            placeholder={t('inventory.modal.description_placeholder')}
                            className="w-full px-6 py-5 bg-white border border-brand-clay rounded-sm text-base font-serif italic text-brand-ink/80 focus:outline-none focus:ring-4 focus:ring-brand-red/5 focus:border-brand-red transition-all resize-none shadow-inner"
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-brand-paper/50 border-t border-brand-clay flex items-center justify-between">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-brand-ink/40 hover:text-brand-red transition-colors"
                >
                  {t('inventory.modal.cancel')}
                </button>
                
                <div className="flex items-center gap-4">
                  {currentStep > 1 && (
                    <button 
                      type="button"
                      onClick={() => setCurrentStep(prev => prev - 1)}
                      className="px-8 py-3 border border-brand-clay rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all"
                    >
                      {t('inventory.modal.prev')}
                    </button>
                  )}
                  
                  {currentStep < 4 ? (
                    <button 
                      type="button"
                      onClick={() => setCurrentStep(prev => prev + 1)}
                      className="px-12 py-3 bg-brand-ink text-white rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-brand-red transition-all shadow-xl hover:shadow-brand-red/20"
                    >
                      {t('inventory.modal.next')}
                    </button>
                  ) : (
                    <button 
                      onClick={handleSubmit}
                      className="px-12 py-3 bg-brand-red text-white rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-brand-ink transition-all shadow-xl shadow-brand-red/10"
                    >
                      {editingProduct ? t('inventory.modal.finalize') : t('inventory.modal.confirm')}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
