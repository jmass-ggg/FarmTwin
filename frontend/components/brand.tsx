import Link from 'next/link';
import { Leaf } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="FarmTwin home">
      <span className="brand-mark" aria-hidden="true"><Leaf /></span>
      {!compact && <span>FarmTwin</span>}
    </Link>
  );
}
