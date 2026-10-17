import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import api from '@/utils/api';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Field from '@/components/ui/Field';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { apiErrorText } from '@/components/ui/format';

interface KAD {
  _id: string;
  code: string;
  description: string;
  descriptionEN?: string;
  category: string;
  section: string;
  isActive: boolean;
  vatRate: number;
  isPopular: boolean;
  keywords: string[];
  relatedCodes: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationData {
  page: number;
  pages: number;
  total: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const emptyForm: Partial<KAD> = {
  code: '',
  description: '',
  descriptionEN: '',
  category: '',
  section: 'A',
  vatRate: 24,
  isPopular: false,
  keywords: [],
  relatedCodes: [],
  notes: '',
};

const KADManager = () => {
  const { t } = useTranslation('common');
  const toast = useToast();

  // State management
  const [kads, setKads] = useState<KAD[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showPopularOnly, setShowPopularOnly] = useState(false);
  const [sortBy, setSortBy] = useState('code');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [selectedKAD, setSelectedKAD] = useState<KAD | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KAD | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState<Partial<KAD>>(emptyForm);

  // Bulk upload
  const [bulkData, setBulkData] = useState('');
  const [uploadResult, setUploadResult] = useState<any>(null);

  const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'];

  // Fetch KADs
  const fetchKADs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        sort: sortBy,
      });

      if (searchQuery) params.append('search', searchQuery);
      if (selectedSection) params.append('section', selectedSection);
      if (selectedCategory) params.append('category', selectedCategory);
      if (showPopularOnly) params.append('popular', 'true');

      const response = await api.get(`/api/kads?${params}`);

      if (response.data.success) {
        setKads(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (error: any) {
      setError(apiErrorText(error, t('kad.errors.fetch')));
    } finally {
      setLoading(false);
    }
  };

  // Create KAD
  const createKAD = async () => {
    try {
      setSaving(true);
      setModalError(null);
      const response = await api.post('/api/kads', formData);
      if (response.data.success) {
        setShowCreateModal(false);
        resetForm();
        fetchKADs();
        toast.success(t('kad.created'));
      }
    } catch (error: any) {
      setModalError(apiErrorText(error, t('kad.errors.create')));
    } finally {
      setSaving(false);
    }
  };

  // Update KAD
  const updateKAD = async () => {
    try {
      setSaving(true);
      setModalError(null);
      const response = await api.put(`/api/kads/${selectedKAD?.code}`, formData);
      if (response.data.success) {
        setShowEditModal(false);
        setSelectedKAD(null);
        resetForm();
        fetchKADs();
        toast.success(t('kad.updated'));
      }
    } catch (error: any) {
      setModalError(apiErrorText(error, t('kad.errors.update')));
    } finally {
      setSaving(false);
    }
  };

  // Delete KAD (confirmed through the delete dialog)
  const deleteKAD = async (code: string) => {
    try {
      setSaving(true);
      const response = await api.delete(`/api/kads/${code}`);
      if (response.data.success) {
        setDeleteTarget(null);
        fetchKADs();
        toast.success(t('kad.deleted'));
      }
    } catch (error: any) {
      setDeleteTarget(null);
      setError(apiErrorText(error, t('kad.errors.delete')));
    } finally {
      setSaving(false);
    }
  };

  // Bulk upload
  const handleBulkUpload = async () => {
    try {
      setSaving(true);
      setModalError(null);
      const kadsData = JSON.parse(bulkData);
      const response = await api.post('/api/kads/bulk-upload', {
        kads: kadsData,
        replaceExisting: true,
      });

      if (response.data.success) {
        setUploadResult(response.data);
        setBulkData('');
        fetchKADs();
      }
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        setModalError(t('kad.errors.invalidJson'));
      } else {
        setModalError(apiErrorText(error, t('kad.errors.upload')));
      }
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData(emptyForm);
  };

  // Open edit modal
  const openEditModal = (kad: KAD) => {
    setSelectedKAD(kad);
    setModalError(null);
    setFormData({
      code: kad.code,
      description: kad.description,
      descriptionEN: kad.descriptionEN,
      category: kad.category,
      section: kad.section,
      vatRate: kad.vatRate,
      isPopular: kad.isPopular,
      keywords: kad.keywords,
      relatedCodes: kad.relatedCodes,
      notes: kad.notes,
    });
    setShowEditModal(true);
  };

  const closeFormModal = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setSelectedKAD(null);
    setModalError(null);
    resetForm();
  };

  const closeBulk = () => {
    setShowBulkUpload(false);
    setBulkData('');
    setUploadResult(null);
    setModalError(null);
  };

  // Handle input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle array inputs
  const handleArrayInput = (field: 'keywords' | 'relatedCodes', value: string) => {
    const array = value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item);
    handleInputChange(field, array);
  };

  useEffect(() => {
    fetchKADs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, sortBy, selectedSection, selectedCategory, showPopularOnly]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchKADs();
  };

  const formOpen = showCreateModal || showEditModal;
  const formValid = !!(formData.code?.trim() && formData.description?.trim() && formData.category?.trim());

  const RowActions = ({ kad }: { kad: KAD }) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon="pencil"
        onClick={() => openEditModal(kad)}
        aria-label={t('kad.editCode', { code: kad.code })}
        title={t('common.edit')}
      />
      <Button
        variant="danger-ghost"
        size="sm"
        iconOnly
        icon="trash"
        onClick={() => setDeleteTarget(kad)}
        aria-label={t('kad.deleteCode', { code: kad.code })}
        title={t('common.delete')}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('kad.title')}
        description={t('kad.description')}
        actions={
          <>
            <Button
              variant="secondary"
              icon="download"
              onClick={() => {
                setModalError(null);
                setShowBulkUpload(true);
              }}
            >
              {t('kad.bulkUpload')}
            </Button>
            <Button
              variant="primary"
              icon="plus"
              onClick={() => {
                resetForm();
                setModalError(null);
                setShowCreateModal(true);
              }}
            >
              {t('kad.add')}
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="card p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-center">
          <form
            role="search"
            className="relative col-span-2 lg:col-span-1"
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
          >
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              placeholder={t('kad.searchList')}
              aria-label={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
          </form>

          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="input"
            aria-label={t('kad.fields.section')}
          >
            <option value="">{t('kad.allSections')}</option>
            {sections.map((section) => (
              <option key={section} value={section}>
                {t('kad.sectionLabel', { section })}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder={t('kad.categoryFilter')}
            aria-label={t('kad.fields.category')}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input"
            aria-label={t('kad.sortLabel')}
          >
            <option value="code">{t('kad.sort.code')}</option>
            <option value="description">{t('kad.sort.description')}</option>
            <option value="section">{t('kad.sort.section')}</option>
            <option value="popular">{t('kad.sort.popular')}</option>
          </select>

          <label className="flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-ink-2">
            <input
              type="checkbox"
              checked={showPopularOnly}
              onChange={(e) => setShowPopularOnly(e.target.checked)}
              className="checkbox"
            />
            {t('kad.popularOnly')}
          </label>
        </div>
      </div>

      {error && (
        <Alert tone="danger" onDismiss={() => setError(null)} dismissLabel={t('common.dismiss')}>
          {error}
        </Alert>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-line" aria-busy="true" aria-label={t('common.loading')}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="skeleton h-4 w-14" />
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton hidden h-4 w-24 sm:block" />
                <div className="skeleton hidden h-4 w-10 sm:block" />
              </div>
            ))}
          </div>
        ) : kads.length === 0 ? (
          <EmptyState
            icon="list"
            title={t('kad.emptyTitle')}
            description={
              searchQuery || selectedSection || selectedCategory || showPopularOnly
                ? t('kad.emptyFiltered')
                : t('kad.emptyDescription')
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('kad.fields.code')}</th>
                    <th>{t('kad.fields.description')}</th>
                    <th className="text-center">{t('kad.fields.section')}</th>
                    <th>{t('kad.fields.category')}</th>
                    <th className="text-right">{t('kad.fields.vat')}</th>
                    <th>
                      <span className="sr-only">{t('kad.popular')}</span>
                    </th>
                    <th>
                      <span className="sr-only">{t('common.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {kads.map((kad) => (
                    <tr key={kad._id} className="hover:bg-sunken/50">
                      <td className="num whitespace-nowrap font-semibold text-ink">{kad.code}</td>
                      <td className="min-w-[16rem] text-ink-2">{kad.description}</td>
                      <td className="text-center text-ink-2">{kad.section}</td>
                      <td className="text-muted">{kad.category}</td>
                      <td className="num whitespace-nowrap text-right text-ink-2">{kad.vatRate}%</td>
                      <td>
                        {kad.isPopular && (
                          <span className="badge badge-warning">
                            <Icon name="star" size={12} />
                            {t('kad.popular')}
                          </span>
                        )}
                      </td>
                      <td className="w-px">
                        <RowActions kad={kad} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone list */}
            <ul className="divide-y divide-line md:hidden">
              {kads.map((kad) => (
                <li key={kad._id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num text-sm font-semibold text-ink">{kad.code}</span>
                      <span className="badge badge-neutral py-0 text-2xs">
                        {t('kad.sectionShort', { section: kad.section })}
                      </span>
                      <span className="num text-xs text-muted">{t('kad.vatShort', { rate: kad.vatRate })}</span>
                      {kad.isPopular && (
                        <span className="badge badge-warning py-0 text-2xs">
                          <Icon name="star" size={11} />
                          {t('kad.popular')}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-2">{kad.description}</p>
                    {kad.category && <p className="mt-0.5 text-xs text-muted">{kad.category}</p>}
                  </div>
                  <RowActions kad={kad} />
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Pagination */}
        {pagination && !loading && kads.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="num text-sm text-muted">
              {t('kad.pageInfo', {
                shown: kads.length,
                total: pagination.total,
                page: pagination.page,
                pages: pagination.pages,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                icon="chevronLeft"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!pagination.hasPrev}
              >
                {t('common.previous')}
              </Button>
              <Button
                size="sm"
                iconRight="chevronRight"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!pagination.hasNext}
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={closeFormModal}
        busy={saving}
        size="lg"
        closeLabel={t('common.close')}
        title={showCreateModal ? t('kad.createTitle') : t('kad.editTitle', { code: selectedKAD?.code || '' })}
        footer={
          <>
            <Button variant="secondary" onClick={closeFormModal} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={!formValid}
              onClick={showCreateModal ? createKAD : updateKAD}
            >
              {showCreateModal ? t('common.create') : t('common.saveChanges')}
            </Button>
          </>
        }
      >
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!saving && formValid) (showCreateModal ? createKAD : updateKAD)();
          }}
        >
          {modalError && (
            <Alert tone="danger" className="sm:col-span-2">
              {modalError}
            </Alert>
          )}
          <Field label={t('kad.fields.code')} required>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => handleInputChange('code', e.target.value)}
              placeholder="00.00"
              className="input num"
              data-autofocus
            />
          </Field>

          <Field label={t('kad.fields.section')} required>
            <select
              value={formData.section}
              onChange={(e) => handleInputChange('section', e.target.value)}
              className="input"
            >
              {sections.map((section) => (
                <option key={section} value={section}>
                  {t('kad.sectionLabel', { section })}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('kad.fields.descriptionEl')} required className="sm:col-span-2">
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="input"
              rows={3}
              lang="el"
            />
          </Field>

          <Field label={t('kad.fields.descriptionEn')} className="sm:col-span-2">
            <textarea
              value={formData.descriptionEN}
              onChange={(e) => handleInputChange('descriptionEN', e.target.value)}
              className="input"
              rows={3}
              lang="en"
            />
          </Field>

          <Field label={t('kad.fields.category')} required>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className="input"
            />
          </Field>

          <Field label={t('kad.fields.vatRate')}>
            <input
              type="number"
              value={formData.vatRate}
              onChange={(e) => handleInputChange('vatRate', parseInt(e.target.value))}
              min="0"
              max="100"
              className="input"
            />
          </Field>

          <Field label={t('kad.fields.keywords')} hint={t('kad.commaHint')}>
            <input
              type="text"
              value={formData.keywords?.join(', ')}
              onChange={(e) => handleArrayInput('keywords', e.target.value)}
              className="input"
            />
          </Field>

          <Field label={t('kad.fields.relatedCodes')} hint={t('kad.commaHint')}>
            <input
              type="text"
              value={formData.relatedCodes?.join(', ')}
              onChange={(e) => handleArrayInput('relatedCodes', e.target.value)}
              className="input num"
            />
          </Field>

          <Field label={t('kad.fields.notes')} className="sm:col-span-2">
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="input"
              rows={2}
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={formData.isPopular}
              onChange={(e) => handleInputChange('isPopular', e.target.checked)}
              className="checkbox"
            />
            {t('kad.markPopular')}
          </label>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal
        open={showBulkUpload}
        onClose={closeBulk}
        busy={saving}
        size="xl"
        closeLabel={t('common.close')}
        title={t('kad.bulkTitle')}
        description={t('kad.bulkDescription')}
        footer={
          <>
            <Button variant="secondary" onClick={closeBulk} disabled={saving}>
              {t('common.close')}
            </Button>
            <Button variant="primary" loading={saving} disabled={!bulkData.trim()} onClick={handleBulkUpload}>
              {t('kad.uploadAction')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert tone="warning">{t('kad.bulkReplaceWarning')}</Alert>
          {modalError && <Alert tone="danger">{modalError}</Alert>}
          <Field label={t('kad.bulkJsonLabel')}>
            <textarea
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              placeholder={`[
  {
    "code": "01.01",
    "description": "Καλλιέργεια σιτηρών...",
    "category": "Γεωργία",
    "section": "A",
    "vatRate": 24,
    "isPopular": false,
    "keywords": ["γεωργία", "σιτηρά"]
  }
]`}
              className="input font-mono text-[0.8125rem]"
              rows={14}
              spellCheck={false}
            />
          </Field>

          {uploadResult && (
            <div className="rounded-md border border-success/25 bg-success-soft p-4 text-sm text-success">
              <p className="font-semibold">{t('kad.uploadResults')}</p>
              <dl className="num mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                <div>
                  <dt className="text-xs opacity-80">{t('kad.stats.total')}</dt>
                  <dd className="font-semibold">{uploadResult.stats?.total}</dd>
                </div>
                <div>
                  <dt className="text-xs opacity-80">{t('kad.stats.created')}</dt>
                  <dd className="font-semibold">{uploadResult.stats?.created}</dd>
                </div>
                <div>
                  <dt className="text-xs opacity-80">{t('kad.stats.updated')}</dt>
                  <dd className="font-semibold">{uploadResult.stats?.updated}</dd>
                </div>
                <div>
                  <dt className="text-xs opacity-80">{t('kad.stats.errors')}</dt>
                  <dd className="font-semibold">{uploadResult.stats?.errors}</dd>
                </div>
              </dl>
              {uploadResult.errors?.length > 0 && (
                <ul className="mt-3 list-inside list-disc space-y-0.5 text-danger">
                  {uploadResult.errors.map((err: string, index: number) => (
                    <li key={index} className="text-xs">
                      {err}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        busy={saving}
        size="sm"
        closeLabel={t('common.close')}
        title={t('kad.deleteTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              icon="trash"
              loading={saving}
              onClick={() => deleteTarget && deleteKAD(deleteTarget.code)}
              data-autofocus
            >
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">{t('kad.deleteConfirm', { code: deleteTarget?.code || '' })}</p>
        {deleteTarget?.description && (
          <p className="mt-2 rounded-md bg-sunken px-3 py-2 text-sm text-muted">{deleteTarget.description}</p>
        )}
      </Modal>
    </div>
  );
};

export default KADManager;
