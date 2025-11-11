'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';

const LanguageSwitcher = () => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  
  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸', short: 'EN' },
    { code: 'el', name: 'Ελληνικά', flag: '🇬🇷', short: 'EL' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪', short: 'DE' }
  ];

  const currentLanguage = languages.find(lang => lang.code === router.locale) || languages[0];

  const handleLanguageChange = (locale: string) => {
    const { pathname, asPath, query } = router;
    router.push({ pathname, query }, asPath, { locale });
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-gray-100/70 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-300/50 dark:border-slate-700/60 hover:border-gray-400/60 dark:hover:border-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        <span className="text-lg">{currentLanguage.flag}</span>
        <span className="text-sm font-medium text-slate-800 dark:text-white">
          {currentLanguage.short}
        </span>
        <svg 
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute right-0 top-full mt-2 w-48 z-20 bg-gray-100/95 dark:bg-slate-800/95 backdrop-blur-2xl rounded-2xl border border-gray-300/50 dark:border-slate-700/60 shadow-xl shadow-gray-400/20 dark:shadow-slate-900/20 overflow-hidden">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50/80 dark:hover:bg-slate-700/80 transition-colors duration-150 ${
                  lang.code === router.locale 
                    ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                    : 'text-slate-800 dark:text-white'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <div className="flex-1">
                  <div className="font-medium">{lang.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{lang.short}</div>
                </div>
                {lang.code === router.locale && (
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSwitcher;