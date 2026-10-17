'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'next-i18next';
import Icon from '@/components/ui/Icon';

const ThemeSwitcher = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation('common');
  const label = theme === 'light' ? t('nav.switchToDark') : t('nav.switchToLight');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn btn-ghost btn-icon"
      title={label}
      aria-label={label}
    >
      {/* Icons swap via the .dark class so the first paint is already right */}
      <Icon name="moon" size={18} className="dark:hidden" />
      <Icon name="sun" size={18} className="hidden dark:block" />
    </button>
  );
};

export default ThemeSwitcher;
