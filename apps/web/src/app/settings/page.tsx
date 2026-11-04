'use client';

import { ChevronDown, LogOut, Moon, Sun, Unplug } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import ActivityList from '@/components/ActivityList';
import HabitTemplatesEditor from '@/components/HabitTemplatesEditor';
import HourTemplatesEditor from '@/components/HourTemplatesEditor';
import TimeCategoriesEditor from '@/components/TimeCategoriesEditor';
import DeviceKeysPanel from '@/components/settings/DeviceKeysPanel';
import ReminderToggle from '@/components/settings/ReminderToggle';
import { useDemo } from '@/components/Providers';
import { disconnectSheet } from '@/components/shell/disconnectSheet';
import { useTheme } from '@/components/shell/useTheme';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import { signOutClean } from '@/lib/signOut';

const SECTIONS = [
  { id: 'activities', label: 'Your habits' },
  { id: 'time', label: 'Time categories' },
  { id: 'hours', label: 'Usual hours' },
  { id: 'habits', label: 'Usual habits per day' },
  { id: 'reminder', label: 'Reminder' },
  { id: 'devices', label: 'Devices' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'account', label: 'Account' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

// Demo has no reminders, devices, sheet or sign-out.
const DEMO_HIDDEN: readonly SectionId[] = ['reminder', 'devices', 'account'];

/**
 * Phone: a row that opens its section. Desktop (lg): always open, the side list scrolls to it.
 * The hosted component's own h2 stays for screen readers on phone (the row already shows the name).
 */
function Section({ id, label, open, onToggle, children }: { id: SectionId; label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section id={id} aria-label={label} className="scroll-mt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`section-${id}`}
        className="flex min-h-12 w-full items-center justify-between rounded-[10px] px-3 text-left text-[16px] font-medium lg:hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
      >
        {label}
        <ChevronDown size={18} aria-hidden="true" style={{ color: 'var(--text-2)', transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      <div id={`section-${id}`} className={`${open ? 'block pt-3' : 'hidden'} lg:block max-lg:[&_h2:not([role=dialog]_h2)]:sr-only`}>
        {children}
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const demo = useDemo();
  const [openId, setOpenId] = useState<SectionId | null>(null);
  const sections = demo ? SECTIONS.filter((s) => !DEMO_HIDDEN.includes(s.id)) : SECTIONS;

  // Legacy redirects land on /settings#activities etc.: open that section and scroll to it.
  useEffect(() => {
    function fromHash() {
      const id = window.location.hash.slice(1);
      const found = sections.find((s) => s.id === id);
      if (!found) return;
      setOpenId(found.id);
      requestAnimationFrame(() => document.getElementById(found.id)?.scrollIntoView({ block: 'start' }));
    }
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sections only changes with demo, which is fixed per load
  }, [demo]);

  const section = (id: SectionId, children: ReactNode) => (
    <Section id={id} label={SECTIONS.find((s) => s.id === id)!.label} open={openId === id} onToggle={() => setOpenId(openId === id ? null : id)}>
      {children}
    </Section>
  );
  const panel = (title: string, children: ReactNode) => (
    <Card className="space-y-3">
      <h2 className="text-[20px] font-semibold max-lg:sr-only" style={{ color: 'var(--text-1)' }}>{title}</h2>
      {children}
    </Card>
  );

  return (
    <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-8">
      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-6 space-y-1">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block rounded-[10px] px-3 py-2 text-[14px] hover:bg-[var(--surface-2)]" style={{ color: 'var(--text-2)' }}>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-3 lg:space-y-8">
        <PageHeader title="Settings" context={demo ? 'Your lists and usual days.' : 'Your lists, usual days, reminder, devices and account.'} />

        {section('activities', <ActivityList />)}
        {section('time', <TimeCategoriesEditor />)}
        {section('hours', <HourTemplatesEditor />)}
        {section('habits', <HabitTemplatesEditor />)}
        {!demo && section('reminder', panel('Reminder', <ReminderToggle />))}
        {!demo && section('devices', panel('Devices', <DeviceKeysPanel />))}
        {section(
          'appearance',
          panel(
            'Appearance',
            <Button variant="outline" onClick={toggle}>
              {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </Button>,
          ),
        )}
        {!demo && section(
          'account',
          panel(
            'Account',
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void disconnectSheet((p) => router.push(p))}>
                <Unplug size={16} aria-hidden="true" />
                Disconnect sheet
              </Button>
              <Button variant="outline" onClick={() => void signOutClean()}>
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </Button>
            </div>,
          ),
        )}
      </div>
    </div>
  );
}
