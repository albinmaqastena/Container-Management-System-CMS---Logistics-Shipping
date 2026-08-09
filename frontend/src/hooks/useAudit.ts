import { useContext } from 'react';
import { AuditContext } from '../contexts/AuditContext';

export const useAudit = () => {
  const context = useContext(AuditContext);

  if (context === undefined) {
    throw new Error('useAudit must be used within an AuditProvider');
  }

  return context;
};

export default useAudit;