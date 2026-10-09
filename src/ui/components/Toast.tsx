import { useEffect } from 'react';
import { useGame } from '../../state/store';

export function Toast() {
  const toast = useGame((s) => s.toast);
  const showToast = useGame((s) => s.showToast);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => showToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast, showToast]);
  if (!toast) return null;
  return (
    <div className="toast" role="status" onClick={() => showToast(null)}>
      {toast}
    </div>
  );
}
