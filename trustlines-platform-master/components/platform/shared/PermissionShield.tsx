import { Lock } from 'lucide-react';

interface PermissionShieldProps {
  label?: string;
  reason?: string;
}

export function PermissionShield({
  label = 'Restricted',
  reason,
}: PermissionShieldProps) {
  return (
    <span className="perm-stub" title={reason}>
      <Lock size={11} strokeWidth={2} />
      {label}
    </span>
  );
}
