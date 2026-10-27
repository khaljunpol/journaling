"use client";

import HourTemplatesEditor from '@/components/HourTemplatesEditor';
import TimeCategoriesEditor from '@/components/TimeCategoriesEditor';

export default function TimeCategoriesPage() {
  return (
    <div className="space-y-8">
      <TimeCategoriesEditor />
      <HourTemplatesEditor />
    </div>
  );
}
