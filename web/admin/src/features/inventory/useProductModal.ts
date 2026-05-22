import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/api';
import type { ProductFormData } from './types';
import { createEmptyProductForm, productToFormData } from './constants';

export function useProductModal(categories: any[], onSuccess: () => void) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState<ProductFormData>(createEmptyProductForm());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleOpenModal = (product: any = null) => {
    setCurrentStep(1);
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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      data.append(key, String(formData[key as keyof ProductFormData]));
    });
    if (imageFile) data.append('image', imageFile);

    const endpoint = editingProduct ? `/products/${editingProduct.id}/` : '/products/';
    const method = editingProduct ? 'PATCH' : 'POST';

    try {
      const response = await apiFetch(endpoint, { method, body: data, headers: {} });
      if (response.ok) {
        setIsModalOpen(false);
        onSuccess();
      } else {
        const errorData = await response.json();
        alert(`${t('common.error')}: ${JSON.stringify(errorData)}`);
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  const closeModal = () => setIsModalOpen(false);

  return {
    isModalOpen,
    currentStep,
    setCurrentStep,
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
