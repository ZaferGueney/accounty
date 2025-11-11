import { useState } from 'react';
import { useTranslation } from 'next-i18next';

interface SettingsNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const SettingsNav = ({ activeSection, onSectionChange }: SettingsNavProps) => {
  const { t } = useTranslation('common');

  const sections = [
    {
      key: 'account',
      title: 'Account',
      icon: '👤'
    },
    {
      key: 'business',
      title: 'Business',
      icon: '🏢'
    },
    {
      key: 'banking',
      title: 'Banking',
      icon: '🏦'
    },
    {
      key: 'invoicing',
      title: 'Invoicing',
      icon: '📄'
    },
    {
      key: 'preferences',
      title: 'Preferences',
      icon: '⚙️'
    },
    {
      key: 'subscription',
      title: 'Subscription',
      icon: '💎'
    }
  ];

  return (
    <div className="w-64 h-full bg-gray-100/70 dark:bg-slate-800/80 backdrop-blur-2xl border-r border-gray-300/40 dark:border-slate-700/50">
      {/* Header */}
      <div className="p-6 border-b border-gray-300/30 dark:border-slate-700/40">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
          Settings
        </h2>
      </div>

      {/* Navigation Items */}
      <div className="p-4 space-y-1">
        {sections.map((section) => (
          <button
            key={section.key}
            onClick={() => onSectionChange(section.key)}
            className={`w-full text-left flex items-center space-x-3 px-3 py-3 rounded-xl transition-all duration-200 ${
              activeSection === section.key
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                : 'text-slate-700 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <span className="text-lg">{section.icon}</span>
            <span className="font-medium">{section.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SettingsNav;