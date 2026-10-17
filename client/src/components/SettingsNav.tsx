import { useTranslation } from 'next-i18next';
import Icon from '@/components/ui/Icon';

interface SettingsNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export const SETTINGS_SECTIONS = [
  { key: 'business', icon: 'building' },
  { key: 'aade', icon: 'shield' },
  { key: 'banking', icon: 'bank' },
  { key: 'account', icon: 'user' },
  { key: 'invoicing', icon: 'file' },
  { key: 'preferences', icon: 'sliders' },
  { key: 'subscription', icon: 'card' },
] as const;

/** Section list: vertical rail on desktop, horizontal scroller on phones. */
const SettingsNav = ({ activeSection, onSectionChange }: SettingsNavProps) => {
  const { t } = useTranslation('common');

  return (
    <nav aria-label={t('settings')} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:overflow-visible">
      <ul className="flex gap-1 lg:flex-col">
        {SETTINGS_SECTIONS.map((section) => {
          const active = activeSection === section.key;
          return (
            <li key={section.key} className="shrink-0">
              <button
                type="button"
                onClick={() => onSectionChange(section.key)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                  active
                    ? 'bg-surface text-ink shadow-xs ring-1 ring-line'
                    : 'text-muted hover:bg-sunken hover:text-ink'
                }`}
              >
                <Icon name={section.icon} size={16} className={active ? 'text-accent' : ''} />
                {t(`settingsNav.${section.key}`)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default SettingsNav;
