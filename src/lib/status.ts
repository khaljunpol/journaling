import type { ActivityStatus } from './types';

export function normalizeStatus(s?: string): ActivityStatus {
  return s === 'stopped' ? 'to stop' : 'to continue';
}

export function toBackendStatus(s: ActivityStatus): 'active' | 'stopped' {
  return s === 'to stop' ? 'stopped' : 'active';
}
