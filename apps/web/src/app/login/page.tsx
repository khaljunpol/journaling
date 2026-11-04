import { isDemo } from '@/lib/demo';
import { LoginClient } from './LoginClient';

export default function LoginPage() {
  return <LoginClient demo={isDemo()} />;
}
