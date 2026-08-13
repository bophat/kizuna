import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Loader2, Save, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch, getMediaUrl } from '../../lib/api';
import { toast } from '@izuna/shared/lib/toast';

type Lang = 'en' | 'ja' | 'vi';

type InvoiceSettingsData = {
  id: number;
  company_name: string;
  company_name_ja: string;
  company_name_vi: string;
  address: string;
  address_ja: string;
  address_vi: string;
  phone: string;
  email: string;
  tax_id: string;
  footer_text: string;
  footer_text_ja: string;
  footer_text_vi: string;
  bank_info: string;
  bank_info_ja: string;
  bank_info_vi: string;
  logo_url: string | null;
};

const EMPTY: InvoiceSettingsData = {
  id: 0,
  company_name: '',
  company_name_ja: '',
  company_name_vi: '',
  address: '',
  address_ja: '',
  address_vi: '',
  phone: '',
  email: '',
  tax_id: '',
  footer_text: '',
  footer_text_ja: '',
  footer_text_vi: '',
  bank_info: '',
  bank_info_ja: '',
  bank_info_vi: '',
  logo_url: null,
};

export function InvoiceSettingsSection() {
  const { t } = useTranslation();
  const [data, setData] = useState<InvoiceSettingsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load settings on mount
  useEffect(() => {
    apiFetch('/invoice-settings/')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const json = await res.json();
        setData(json);
        if (json.logo_url) setLogoPreview(getMediaUrl(json.logo_url) ?? json.logo_url);
      })
      .catch(() => toast.error(t('settings.invoice.load_failed', { defaultValue: 'Không thể tải cài đặt hóa đơn.' })))
      .finally(() => setLoading(false));
  }, [t]);

  const patch = <K extends keyof InvoiceSettingsData>(key: K, value: InvoiceSettingsData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/invoice-settings/', {
        method: 'PATCH',
        body: JSON.stringify({
          company_name: data.company_name,
          company_name_ja: data.company_name_ja,
          company_name_vi: data.company_name_vi,
          address: data.address,
          address_ja: data.address_ja,
          address_vi: data.address_vi,
          phone: data.phone,
          email: data.email,
          tax_id: data.tax_id,
          footer_text: data.footer_text,
          footer_text_ja: data.footer_text_ja,
          footer_text_vi: data.footer_text_vi,
          bank_info: data.bank_info,
          bank_info_ja: data.bank_info_ja,
          bank_info_vi: data.bank_info_vi,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('settings.invoice.saved', { defaultValue: 'Đã lưu cài đặt hóa đơn.' }));
    } catch {
      toast.error(t('settings.invoice.save_failed', { defaultValue: 'Không thể lưu cài đặt hóa đơn.' }));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await apiFetch('/invoice-settings/upload-logo/', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setLogoPreview(getMediaUrl(json.logo_url) ?? json.logo_url);
      toast.success(t('settings.invoice.logo_updated', { defaultValue: 'Logo đã được cập nhật.' }));
    } catch {
      toast.error(t('settings.invoice.logo_upload_failed', { defaultValue: 'Không thể upload logo.' }));
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearLogo = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/invoice-settings/', {
        method: 'PATCH',
        body: JSON.stringify({ logo: null }),
      });
      if (!res.ok) throw new Error();
      setLogoPreview(null);
      toast.success(t('settings.invoice.logo_removed', { defaultValue: 'Logo đã được xóa.' }));
    } catch {
      toast.error(t('settings.invoice.save_failed', { defaultValue: 'Không thể lưu cài đặt hóa đơn.' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center rounded-xl border border-brand-clay bg-white p-10">
        <Loader2 className="animate-spin text-brand-red" />
      </div>
    );
  }

  const langSuffix = lang === 'en' ? '' : `_${lang}` as const;

  return (
    <section className="overflow-hidden rounded-xl border border-brand-clay bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-brand-clay p-8">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-brand-red" />
          <div>
            <h3 className="text-lg font-bold font-serif text-brand-ink">
              {t('settings.invoice.title', { defaultValue: 'Cài đặt hóa đơn PDF' })}
            </h3>
            <p className="mt-0.5 text-xs text-brand-ink/50 italic font-serif">
              {t('settings.invoice.description', { defaultValue: 'Thông tin công ty hiển thị trên file PDF hóa đơn gửi cho khách.' })}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8 p-8">
        {/* Language switcher */}
        <div className="flex flex-wrap gap-2">
          {(['en', 'ja', 'vi'] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`rounded-md border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                lang === l
                  ? 'bg-brand-red text-white border-brand-red'
                  : 'bg-white text-brand-ink/60 border-brand-clay hover:border-brand-red'
              }`}
            >
              {l === 'en' ? 'English' : l === 'ja' ? '日本語' : 'Tiếng Việt'}
            </button>
          ))}
        </div>

        {/* Company name */}
        <div className="grid gap-4 sm:grid-cols-2">
          <SectionLabel>{t('settings.invoice.company_info', { defaultValue: 'Thông tin công ty' })}</SectionLabel>

          <Field label={t('settings.invoice.company_name', { defaultValue: 'Tên công ty' })}>
            <input
              className="form-input"
              value={(data[`company_name${langSuffix}` as keyof InvoiceSettingsData] as string) ?? ''}
              onChange={(e) => patch(`company_name${langSuffix}` as keyof InvoiceSettingsData, e.target.value as never)}
              placeholder={lang === 'en' ? 'KIZUNA' : lang === 'ja' ? 'キズナ' : 'Công ty TNHH Kizuna'}
            />
          </Field>

          <Field label={t('settings.invoice.phone', { defaultValue: 'Điện thoại' })}>
            <input
              className="form-input"
              value={data.phone}
              onChange={(e) => patch('phone', e.target.value)}
              placeholder="+84 xxx xxx xxx"
            />
          </Field>

          <Field label={t('settings.invoice.email', { defaultValue: 'Email' })}>
            <input
              className="form-input"
              type="email"
              value={data.email}
              onChange={(e) => patch('email', e.target.value)}
              placeholder="contact@kizuna.com"
            />
          </Field>

          <Field label={t('settings.invoice.tax_id', { defaultValue: 'Mã số thuế (Tax ID)' })}>
            <input
              className="form-input"
              value={data.tax_id}
              onChange={(e) => patch('tax_id', e.target.value)}
              placeholder="0123456789"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label={t('settings.invoice.address', { defaultValue: 'Địa chỉ' })}>
              <textarea
                className="form-input resize-y"
                rows={2}
                value={(data[`address${langSuffix}` as keyof InvoiceSettingsData] as string) ?? ''}
                onChange={(e) => patch(`address${langSuffix}` as keyof InvoiceSettingsData, e.target.value as never)}
                placeholder={t('settings.invoice.address_placeholder', { defaultValue: 'Số nhà, đường, quận, thành phố...' })}
              />
            </Field>
          </div>
        </div>

        {/* Bank info */}
        <div className="space-y-4 border-t border-brand-clay pt-6">
          <SectionLabel>{t('settings.invoice.bank_info', { defaultValue: 'Thông tin chuyển khoản' })}</SectionLabel>
          <Field label={t('settings.invoice.bank_info_label', { defaultValue: 'Nội dung (hiển thị trên hóa đơn)' })}>
            <textarea
              className="form-input resize-y"
              rows={3}
              value={(data[`bank_info${langSuffix}` as keyof InvoiceSettingsData] as string) ?? ''}
              onChange={(e) => patch(`bank_info${langSuffix}` as keyof InvoiceSettingsData, e.target.value as never)}
              placeholder={t('settings.invoice.bank_info_placeholder', { defaultValue: 'Tên ngân hàng, số tài khoản, tên chủ tài khoản...' })}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="space-y-4 border-t border-brand-clay pt-6">
          <SectionLabel>{t('settings.invoice.footer', { defaultValue: 'Ghi chú cuối hóa đơn' })}</SectionLabel>
          <Field label={t('settings.invoice.footer_label', { defaultValue: 'Nội dung footer' })}>
            <textarea
              className="form-input resize-y"
              rows={2}
              value={(data[`footer_text${langSuffix}` as keyof InvoiceSettingsData] as string) ?? ''}
              onChange={(e) => patch(`footer_text${langSuffix}` as keyof InvoiceSettingsData, e.target.value as never)}
              placeholder={t('settings.invoice.footer_placeholder', { defaultValue: 'Cảm ơn quý khách đã mua sắm tại KIZUNA!' })}
            />
          </Field>
        </div>

        {/* Logo upload */}
        <div className="space-y-4 border-t border-brand-clay pt-6">
          <SectionLabel>{t('settings.invoice.logo', { defaultValue: 'Logo công ty' })}</SectionLabel>
          <p className="text-xs text-brand-ink/50 italic font-serif -mt-2">
            {t('settings.invoice.logo_help', { defaultValue: 'Logo hiển thị góc trên hóa đơn PDF. JPEG/PNG/WEBP, tối đa 5 MB.' })}
          </p>

          {logoPreview && (
            <div className="relative inline-block">
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-24 max-w-[200px] rounded-md border border-brand-clay object-contain p-2"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => void clearLogo()}
                className="absolute -right-2 -top-2 rounded-full bg-brand-red p-0.5 text-white shadow-md hover:opacity-80"
                title={t('common.remove', { defaultValue: 'Xóa' })}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-3">
            <span className="flex items-center gap-2 rounded-md bg-brand-ink px-5 py-2.5 text-sm text-white hover:bg-brand-red transition-colors disabled:opacity-50">
              {uploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploadingLogo
                ? t('settings.media.uploading', { defaultValue: 'Đang upload...' })
                : t('settings.invoice.upload_logo', { defaultValue: 'Chọn logo' })}
            </span>
            {!logoPreview && (
              <span className="flex items-center gap-1 text-xs italic text-brand-ink/40 font-serif">
                <ImageIcon size={14} />
                {t('settings.media.default_image', { defaultValue: 'Chưa có ảnh' })}
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void handleLogoUpload(e)}
              disabled={uploadingLogo}
            />
          </label>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end border-t border-brand-clay bg-brand-paper/20 px-8 py-5">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-brand-ink px-6 py-3 text-sm font-semibold text-white hover:bg-brand-red transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          {t('settings.invoice.save', { defaultValue: 'Lưu cài đặt hóa đơn' })}
        </button>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="col-span-full text-xs font-bold uppercase tracking-widest text-brand-ink/40">
      {children}
    </p>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/55">{label}</span>
      {children}
    </label>
  );
}
