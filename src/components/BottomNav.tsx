import { Link, useLocation } from 'wouter';
import { BookIcon, ChartIcon, PenIcon, SunIcon } from './icons';

const TABS = [
  { href: '/', label: 'I dag', Icon: SunIcon, match: (p: string) => p === '/' },
  { href: '/dagbog', label: 'Dagbog', Icon: PenIcon, match: (p: string) => p.startsWith('/dagbog') },
  { href: '/boeger', label: 'Bøger', Icon: BookIcon, match: (p: string) => p.startsWith('/boeger') },
  { href: '/overblik', label: 'Overblik', Icon: ChartIcon, match: (p: string) => p.startsWith('/overblik') },
];

export function BottomNav() {
  const [location] = useLocation();
  return (
    <nav
      aria-label="Hovedmenu"
      className="border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(location);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[0.75rem] font-medium ${
                  active ? 'text-sage' : 'text-muted'
                }`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${active ? 'bg-sage-soft' : ''}`}>
                  <Icon width={22} height={22} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
