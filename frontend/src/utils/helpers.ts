export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export function getSeverityColor(severity: string | null): string {
  switch (severity?.toUpperCase()) {
    case 'HIGH':
    case 'CRITICAL':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'MEDIUM':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'LOW':
      return 'text-green-600 bg-green-50 border-green-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

export function getDiscrepancyLabel(type: string): string {
  const labels: Record<string, string> = {
    MISSING_ASSET: 'Missing Asset',
    UNTRACKED_ASSET: 'Untracked Asset',
    CONFIG_MISMATCH: 'Config Mismatch',
    NAMING_MISMATCH: 'Naming Mismatch',
  };
  return labels[type] || type;
}

export function getDiscrepancyColor(type: string): string {
  const colors: Record<string, string> = {
    MISSING_ASSET: '#ef4444',
    UNTRACKED_ASSET: '#f59e0b',
    CONFIG_MISMATCH: '#8b5cf6',
    NAMING_MISMATCH: '#3b82f6',
  };
  return colors[type] || '#6b7280';
}

export function hasRole(userRole: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(userRole);
}
