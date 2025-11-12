import { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { getApiBaseUrl } from '@/utils/api';

const AccountSettings = () => {
  const { t } = useTranslation('common');
  const { user, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || ''
  });

  const [emailData, setEmailData] = useState({
    newEmail: '',
    password: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [accountTypeData, setAccountTypeData] = useState({
    isAccountant: user?.isAccountant || false
  });


  const api = axios.create({
    baseURL: getApiBaseUrl()
  });

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accounty_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.put('/api/users/names', profileData);
      if (response.data.success) {
        showMessage('success', 'Profile updated successfully');
        refreshUser();
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.put('/api/users/email', emailData);
      if (response.data.success) {
        showMessage('success', 'Email updated successfully');
        setEmailData({ newEmail: '', password: '' });
        refreshUser();
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || 'Failed to update email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showMessage('error', 'New passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.put('/api/users/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      if (response.data.success) {
        showMessage('success', 'Password changed successfully');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAccountType = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.put('/api/users/account-type', {
        isAccountant: accountTypeData.isAccountant
      });
      if (response.data.success) {
        showMessage('success', 'Account type updated successfully');
        refreshUser();
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || 'Failed to update account type');
    } finally {
      setIsLoading(false);
    }
  };


  const tabs = [
    { key: 'profile', title: 'Name', icon: '👤' },
    { key: 'email', title: 'Email', icon: '📧' },
    { key: 'password', title: 'Password', icon: '🔒' },
    { key: 'accountType', title: 'Account Type', icon: '💼' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                {t('firstName')}
              </label>
              <input
                type="text"
                value={profileData.firstName}
                onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                {t('lastName')}
              </label>
              <input
                type="text"
                value={profileData.lastName}
                onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        );

      case 'email':
        return (
          <form onSubmit={handleUpdateEmail} className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Current email: <strong>{user?.email}</strong>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                New Email Address
              </label>
              <input
                type="email"
                value={emailData.newEmail}
                onChange={(e) => setEmailData(prev => ({ ...prev, newEmail: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={emailData.password}
                onChange={(e) => setEmailData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isLoading ? 'Updating...' : 'Update Email'}
            </button>
          </form>
        );

      case 'password':
        return (
          <form onSubmit={handleChangePassword} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                New Password
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isLoading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        );

      case 'accountType':
        return (
          <form onSubmit={handleUpdateAccountType} className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Current account type:</strong> {user?.isAccountant ? 'Accountant' : 'Individual User'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-4">
                Account Type
              </label>
              <div className="space-y-3">
                <label className="flex items-center space-x-3 p-4 border border-gray-300/50 dark:border-slate-600/50 rounded-xl cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-all">
                  <input
                    type="radio"
                    name="accountType"
                    value="individual"
                    checked={!accountTypeData.isAccountant}
                    onChange={() => setAccountTypeData(prev => ({ ...prev, isAccountant: false }))}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800 dark:text-white">👤 Individual User</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Manage your own invoices and customers</div>
                  </div>
                </label>
                
                <label className="flex items-center space-x-3 p-4 border border-gray-300/50 dark:border-slate-600/50 rounded-xl cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-all">
                  <input
                    type="radio"
                    name="accountType"
                    value="accountant"
                    checked={accountTypeData.isAccountant}
                    onChange={() => setAccountTypeData(prev => ({ ...prev, isAccountant: true }))}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800 dark:text-white">💼 Accountant</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Manage multiple clients and their invoices</div>
                  </div>
                </label>
              </div>
            </div>

            {accountTypeData.isAccountant && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Note:</strong> Accountant mode enables client management features and allows you to create invoices on behalf of your clients.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isLoading ? 'Updating...' : 'Update Account Type'}
            </button>
          </form>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-200 bg-clip-text text-transparent mb-2">
          Account Settings
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Manage your account and security
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl border ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Content */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 rounded-3xl blur-xl"></div>
        <div className="relative bg-gray-100/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 rounded-3xl shadow-2xl shadow-gray-500/10 dark:shadow-slate-900/20">
          
          {/* Tabs */}
          <div className="p-6 border-b border-gray-300/30 dark:border-slate-700/40">
            <div className="flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;