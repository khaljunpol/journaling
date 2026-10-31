import Chip from '@/components/ui/Chip';

/** "+2 vs last week". Accent when up, quiet grey otherwise. Never red. */
export default function TrendChip({ text, delta }: { text: string; delta: number }) {
  return <Chip tone={delta > 0 ? 'accent' : 'neutral'}>{text}</Chip>;
}
