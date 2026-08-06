import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/api';
import { formatApiErrors } from '../../lib/formatApiErrors';
import type { ProductFormData } from './types';
import { createEmptyProductForm, productToFormData } from './constants';

export function useProductModal(categories: any[], onSuccess: () => void) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState<ProductFormData>(createEmptyProductForm());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleOpenModal = (product: any = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData(productToFormData(product));
      setPreviewUrl(product.image);
    } else {
      setEditingProduct(null);
      setFormData(createEmptyProductForm(categories[0]?.id || ''));
      setPreviewUrl(null);
    }
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleImageChange = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleImageChange(file);
  };

  const handleSubmit = async (statusOverride?: ProductFormData['status']) => {
    const normalizedCostPriceVnd = formData.cost_price_vnd.replace(/[^0-9]/g, '');
    if (!normalizedCostPriceVnd || Number(normalizedCostPriceVnd) <= 0) {
      alert(t('inventory.errors.cost_price_required'));
      return;
    }

    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      if (key === 'pricing_inputs') {
        data.append(key, JSON.stringify(formData.pricing_inputs || {}));
        return;
      }
      data.append(
        key,
        key === 'status' && statusOverride
          ? statusOverride
          : key === 'cost_price_vnd'
          ? normalizedCostPriceVnd
          : String(formData[key as keyof ProductFormData]),
      );
    });
    if (imageFile) data.append('image', imageFile);

    const endpoint = editingProduct ? `/products/${editingProduct.id}/` : '/products/';
    const method = editingProduct ? 'PATCH' : 'POST';

    try {
      const response = await apiFetch(endpoint, { method, body: data, headers: {} });
      const responseData = await response.json().catch(() => null);
      if (response.ok) {
        const savedCostPriceVnd = String(responseData?.cost_price_vnd ?? '').replace(
          /[^0-9]/g,
          '',
        );
        if (
          !savedCostPriceVnd
          || Number(savedCostPriceVnd) !== Number(normalizedCostPriceVnd)
        ) {
          alert(t('inventory.errors.cost_price_not_saved'));
          return;
        }
        setIsModalOpen(false);
        onSuccess();
      } else {
        alert(formatApiErrors(responseData || {}));
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert(t('inventory.errors.save_failed'));
    }
  };

  const closeModal = () => setIsModalOpen(false);

  return {
    isModalOpen,
    editingProduct,
    formData,
    setFormData,
    previewUrl,
    isDragging,
    handleOpenModal,
    handleImageChange,
    onDragOver,
    onDragLeave,
    onDrop,
    handleSubmit,
    closeModal,
  };
}
