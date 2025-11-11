import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import api from '@/utils/api';

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

const KADManager = () => {
  const { t } = useTranslation('common');
  
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
  
  // Form data
  const [formData, setFormData] = useState<Partial<KAD>>({
    code: '',
    description: '',
    descriptionEN: '',
    category: '',
    section: 'A',
    vatRate: 24,
    isPopular: false,
    keywords: [],
    relatedCodes: [],
    notes: ''
  });
  
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
        sort: sortBy
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
      setError(error.response?.data?.message || 'Failed to fetch KADs');
    } finally {
      setLoading(false);
    }
  };

  // Create KAD
  const createKAD = async () => {
    try {
      const response = await api.post('/api/kads', formData);
      if (response.data.success) {
        setShowCreateModal(false);
        resetForm();
        fetchKADs();
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create KAD');
    }
  };

  // Update KAD
  const updateKAD = async () => {
    try {
      const response = await api.put(`/api/kads/${selectedKAD?.code}`, formData);
      if (response.data.success) {
        setShowEditModal(false);
        setSelectedKAD(null);
        resetForm();
        fetchKADs();
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update KAD');
    }
  };

  // Delete KAD
  const deleteKAD = async (code: string) => {
    if (!confirm('Are you sure you want to delete this KAD?')) return;
    
    try {
      const response = await api.delete(`/api/kads/${code}`);
      if (response.data.success) {
        fetchKADs();
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to delete KAD');
    }
  };

  // Bulk upload
  const handleBulkUpload = async () => {
    try {
      const kadsData = JSON.parse(bulkData);
      const response = await api.post('/api/kads/bulk-upload', {
        kads: kadsData,
        replaceExisting: true
      });
      
      if (response.data.success) {
        setUploadResult(response.data);
        setBulkData('');
        fetchKADs();
      }
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        setError('Invalid JSON format');
      } else {
        setError(error.response?.data?.message || 'Failed to upload KADs');
      }
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      descriptionEN: '',
      category: '',
      section: 'A',
      vatRate: 24,
      isPopular: false,
      keywords: [],
      relatedCodes: [],
      notes: ''
    });
  };

  // Open edit modal
  const openEditModal = (kad: KAD) => {
    setSelectedKAD(kad);
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
      notes: kad.notes
    });
    setShowEditModal(true);
  };

  // Handle input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle array inputs
  const handleArrayInput = (field: 'keywords' | 'relatedCodes', value: string) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item);
    handleInputChange(field, array);
  };

  useEffect(() => {
    fetchKADs();
  }, [currentPage, sortBy, selectedSection, selectedCategory, showPopularOnly]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchKADs();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200/60 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                📋 KAD Management
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Manage Greek Activity Codes (Κωδικοί Αριθμοί Δραστηριότητας)
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                ➕ Add KAD
              </button>
              <button
                onClick={() => setShowBulkUpload(true)}
                className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
              >
                📤 Bulk Upload
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <div className="md:col-span-2">
              <div className="flex">
                <input
                  type="text"
                  placeholder="Search KADs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-blue-600 text-white rounded-r-xl hover:bg-blue-700"
                >
                  🔍
                </button>
              </div>
            </div>
            
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sections</option>
              {sections.map(section => (
                <option key={section} value={section}>Section {section}</option>
              ))}
            </select>
            
            <input
              type="text"
              placeholder="Category filter..."
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="code">Sort by Code</option>
              <option value="description">Sort by Description</option>
              <option value="section">Sort by Section</option>
              <option value="popular">Sort by Popular</option>
            </select>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showPopularOnly}
                onChange={(e) => setShowPopularOnly(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Popular only</span>
            </label>
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-2 text-slate-600">Loading KADs...</p>
            </div>
          )}

          {/* KADs Table */}
          {!loading && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 rounded-xl">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700">
                    <th className="border border-gray-300 px-4 py-3 text-left">Code</th>
                    <th className="border border-gray-300 px-4 py-3 text-left">Description</th>
                    <th className="border border-gray-300 px-4 py-3 text-left">Section</th>
                    <th className="border border-gray-300 px-4 py-3 text-left">Category</th>
                    <th className="border border-gray-300 px-4 py-3 text-left">VAT %</th>
                    <th className="border border-gray-300 px-4 py-3 text-left">Popular</th>
                    <th className="border border-gray-300 px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {kads.map((kad) => (
                    <tr key={kad._id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="border border-gray-300 px-4 py-3 font-mono">{kad.code}</td>
                      <td className="border border-gray-300 px-4 py-3">{kad.description}</td>
                      <td className="border border-gray-300 px-4 py-3 text-center">{kad.section}</td>
                      <td className="border border-gray-300 px-4 py-3">{kad.category}</td>
                      <td className="border border-gray-300 px-4 py-3 text-center">{kad.vatRate}%</td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        {kad.isPopular ? '⭐' : '-'}
                      </td>
                      <td className="border border-gray-300 px-4 py-3">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openEditModal(kad)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => deleteKAD(kad.code)}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && (
            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-slate-600">
                Showing {kads.length} of {pagination.total} KADs (Page {pagination.page} of {pagination.pages})
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={!pagination.hasPrev}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-400"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!pagination.hasNext}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-400"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">
              {showCreateModal ? '➕ Create KAD' : '✏️ Edit KAD'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  placeholder="00.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Section *</label>
                <select
                  value={formData.section}
                  onChange={(e) => handleInputChange('section', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {sections.map(section => (
                    <option key={section} value={section}>Section {section}</option>
                  ))}
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Description (Greek) *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Description (English)</label>
                <textarea
                  value={formData.descriptionEN}
                  onChange={(e) => handleInputChange('descriptionEN', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Category *</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">VAT Rate (%)</label>
                <input
                  type="number"
                  value={formData.vatRate}
                  onChange={(e) => handleInputChange('vatRate', parseInt(e.target.value))}
                  min="0"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={formData.keywords?.join(', ')}
                  onChange={(e) => handleArrayInput('keywords', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Related Codes (comma-separated)</label>
                <input
                  type="text"
                  value={formData.relatedCodes?.join(', ')}
                  onChange={(e) => handleArrayInput('relatedCodes', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isPopular}
                    onChange={(e) => handleInputChange('isPopular', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Mark as Popular</span>
                </label>
              </div>
            </div>
            
            <div className="flex justify-end space-x-4 mt-8">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedKAD(null);
                  resetForm();
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-xl hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? createKAD : updateKAD}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                {showCreateModal ? 'Create' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">📤 Bulk Upload KADs</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                JSON Data (Array of KAD objects)
              </label>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                rows={15}
              />
            </div>
            
            {uploadResult && (
              <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-xl">
                <h3 className="font-bold">Upload Results:</h3>
                <p>Total: {uploadResult.stats.total}</p>
                <p>Created: {uploadResult.stats.created}</p>
                <p>Updated: {uploadResult.stats.updated}</p>
                <p>Errors: {uploadResult.stats.errors}</p>
                {uploadResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-bold">Errors:</p>
                    <ul className="list-disc list-inside">
                      {uploadResult.errors.map((error: string, index: number) => (
                        <li key={index} className="text-sm">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowBulkUpload(false);
                  setBulkData('');
                  setUploadResult(null);
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-xl hover:bg-gray-400"
              >
                Close
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={!bulkData.trim()}
                className="px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload KADs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KADManager;