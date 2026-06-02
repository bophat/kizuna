import { useEffect, useState } from 'react';
import { Package, Plus, Search, Filter, Loader2, AlertCircle, FileSpreadsheet, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import { useProductModal } from '../features/inventory/useProductModal';
import { ProductFormModal } from '../components/inventory/ProductFormModal';
import { InventoryTable } from '../components/inventory/InventoryTable';
import { CsvImportModal } from '../components/inventory/CsvImportModal';

export default function InventoryPage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiFetch('/products/'),
        apiFetch('/categories/'),
      ]);

      if (prodRes.ok && catRes.ok) {
        setProducts(await prodRes.json());
        setCategories(await catRes.json());
        setError(null);
      } else {
        setError(t('inventory.errors.load_failed'));
      }
    } catch {
      setError(t('inventory.errors.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const productModal = useProductModal(categories, fetchData);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('inventory.confirm_delete'))) return;
    try {
      const response = await apiFetch(`/products/${id}/`, { method: 'DELETE' });
      if (response.ok) fetchData();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleDeleteAllQoo10 = async () => {
    if (!window.confirm(t('inventory.csv_import.confirm_delete_all', 'Are you sure you want to delete all imported Qoo10 products?'))) return;
    try {
      const response = await apiFetch('/products/import-csv/', { method: 'DELETE' });
      if (response.ok) fetchData();
    } catch (err) {
      console.error('Delete all error:', err);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pagination = usePagination(filteredProducts, [searchQuery]);

  if (loading && products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-red" />
        <p className="text-sm font-serif italic text-brand-ink/40">{t('inventory.loading')}</p>
      </div>
    );
  }

  return (
    <div className="ma-spacing space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1.5 h-6 bg-brand-red" />
            <p className="text-xs font-bold text-brand-red tracking-[0.3em] uppercase">{t('inventory.subtitle')}</p>
          </div>
          <h1 className="text-5xl font-serif font-bold text-brand-ink leading-tight">{t('inventory.title')}</h1>
          <p className="text-brand-ink/40 font-serif italic mt-2 text-lg">{t('inventory.description')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDeleteAllQoo10}
            className="flex items-center gap-3 bg-red-50 text-brand-red border border-red-200 px-6 py-4 rounded-sm text-sm font-bold hover:bg-brand-red hover:text-white hover:border-brand-red transition-all shadow-md group"
          >
            <Trash2 size={18} className="group-hover:scale-110 transition-transform duration-500" />
            <span className="tracking-widest uppercase">{t('inventory.csv_import.delete_all_button', 'Delete Imported')}</span>
          </button>
          <button
            onClick={() => setCsvImportOpen(true)}
            className="flex items-center gap-3 bg-white text-brand-ink border border-brand-clay px-6 py-4 rounded-sm text-sm font-bold hover:bg-brand-red hover:text-white hover:border-brand-red transition-all shadow-md hover:shadow-brand-red/20 group"
          >
            <FileSpreadsheet size={18} className="group-hover:scale-110 transition-transform duration-500" />
            <span className="tracking-widest uppercase">{t('inventory.csv_import.button', 'Import CSV')}</span>
          </button>
          <button
            onClick={() => productModal.handleOpenModal()}
            className="flex items-center gap-3 bg-brand-ink text-white px-8 py-4 rounded-sm text-sm font-bold hover:bg-brand-red transition-all shadow-xl hover:shadow-brand-red/20 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" />
            <span className="tracking-widest uppercase">{t('inventory.add_button')}</span>
          </button>
        </div>
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
              onChange={(e) => setSearchQuery(e.target.value === 'all' ? '' : e.target.value)}
            >
              <option value="all">{t('inventory.all_categories')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
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
            <button onClick={fetchData} className="text-brand-red text-sm font-bold hover:underline">
              Try again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-paper/50 border-b border-brand-clay">
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">
                    {t('inventory.table.artifact')}
                  </th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">
                    {t('inventory.table.reference')}
                  </th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">
                    {t('inventory.table.classification')}
                  </th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">
                    {t('inventory.table.valuation')}
                  </th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40 text-center">
                    {t('inventory.table.logistics')}
                  </th>
                  <th className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40 text-right">
                    {t('inventory.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay/50">
                <InventoryTable
                  products={pagination.paginatedItems}
                  onEdit={productModal.handleOpenModal}
                  onDelete={handleDelete}
                />
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          variant="inventory"
          totalItems={pagination.totalItems}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          itemsPerPage={pagination.itemsPerPage}
          start={pagination.start}
          end={pagination.end}
          onPageChange={pagination.setCurrentPage}
          onItemsPerPageChange={pagination.setItemsPerPage}
          rangeDefaultValue="Showing {{start}}-{{end}} of {{total}} artifacts"
        />
      </div>

      <ProductFormModal
        isOpen={productModal.isModalOpen}
        currentStep={productModal.currentStep}
        setCurrentStep={productModal.setCurrentStep}
        editingProduct={productModal.editingProduct}
        formData={productModal.formData}
        setFormData={productModal.setFormData}
        categories={categories}
        previewUrl={productModal.previewUrl}
        isDragging={productModal.isDragging}
        onClose={productModal.closeModal}
        onSubmit={productModal.handleSubmit}
        onImageChange={productModal.handleImageChange}
        onDragOver={productModal.onDragOver}
        onDragLeave={productModal.onDragLeave}
        onDrop={productModal.onDrop}
      />

      <CsvImportModal
        isOpen={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
}
