'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import Icon from '@/components/ui/Icon';

const languages = [
  { code: 'el', name: 'Ελληνικά', short: 'EL' },
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'de', name: 'Deutsch', short: 'DE' },
];

const LanguageSwitcher = () => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const current = languages.find((l) => l.code === router.locale) || languages[1];

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const change = (locale: string) => {
    const { pathname, asPath, query } = router;
    router.push({ pathname, query }, asPath, { locale, scroll: false });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="btn btn-ghost h-9 gap-1.5 px-2.5"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`${t('language')}: ${current.name}`}
      >
        <Icon name="globe" size={17} />
        <span className="text-[0.8125rem] font-semibold tracking-wide">{current.short}</span>
      </button>

      {isOpen && (
        <div role="menu" className="popover absolute right-0 top-full z-50 mt-1.5 w-44 p-1">
          {languages.map((lang) => {
            const active = lang.code === router.locale;
            return (
              <button
                key={lang.code}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => change(lang.code)}
                className={`menu-item justify-between ${active ? 'text-ink' : ''}`}
                lang={lang.code}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-6 text-xs font-semibold text-muted">{lang.short}</span>
                  {lang.name}
                </span>
                {active && <Icon name="check" size={15} className="text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
