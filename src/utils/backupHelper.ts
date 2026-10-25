import { Debtor, Purchase, Installment, UserAccount } from '../types';
import { addAuditLog } from './auditLogger';

export interface FullBackupMetadata {
  exportedAt: string;
  exportedAtFormatted: string;
  fileName: string;
  debtorsCount: number;
  purchasesCount: number;
  installmentsCount: number;
  sizeBytes: number;
}

const LAST_BACKUP_META_PREFIX = 'haspaho_last_json_backup_meta_';

export function getLastBackupMetadata(userId?: string): FullBackupMetadata | null {
  try {
    const key = `${LAST_BACKUP_META_PREFIX}${userId || 'default'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as FullBackupMetadata;
  } catch {
    return null;
  }
}

export function exportFullDataBackupJson(params: {
  currentUser: UserAccount | null;
  debtors: Debtor[];
  purchases: Purchase[];
  installments: Installment[];
  deletedDebtors?: Debtor[];
}): FullBackupMetadata {
  const { currentUser, debtors, purchases, installments, deletedDebtors = [] } = params;
  const now = new Date();
  const datePart = now.toISOString().split('T')[0];
  const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const fileName = `haspaho-backup-completo-${datePart}-${timePart}.json`;

  const totalOpenAmount = installments
    .filter((i) => i.status !== 'paid')
    .reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

  const totalPaidAmount = installments
    .filter((i) => i.status === 'paid')
    .reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

  const backupPayload = {
    meta: {
      system: 'HASPAHO Tecnologia - Gestão de Devedores e Parcelamentos',
      formatVersion: '2.0',
      redundancyMode: 'LOCAL_STORAGE_AND_FIREBASE_REDUNDANCY',
      exportedAt: now.toISOString(),
      exportedAtFormatted: now.toLocaleString('pt-BR'),
      exportedBy: currentUser
        ? {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            companyName: currentUser.companyName,
            pixKey: currentUser.pixKey,
          }
        : null,
    },
    summary: {
      totalDebtors: debtors.length,
      totalPurchases: purchases.length,
      totalInstallments: installments.length,
      totalDeletedDebtorsInTrash: deletedDebtors.length,
      totalOpenAmount: Number(totalOpenAmount.toFixed(2)),
      totalPaidAmount: Number(totalPaidAmount.toFixed(2)),
    },
    data: {
      debtors,
      purchases,
      installments,
      deletedDebtors,
    },
  };

  const jsonString = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const sizeBytes = blob.size;

  // Trigger download to device's local storage
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  const metadata: FullBackupMetadata = {
    exportedAt: now.toISOString(),
    exportedAtFormatted: now.toLocaleString('pt-BR'),
    fileName,
    debtorsCount: debtors.length,
    purchasesCount: purchases.length,
    installmentsCount: installments.length,
    sizeBytes,
  };

  try {
    const key = `${LAST_BACKUP_META_PREFIX}${currentUser?.id || 'default'}`;
    localStorage.setItem(key, JSON.stringify(metadata));
  } catch {
    // Ignore storage quota errors
  }

  try {
    addAuditLog(
      'EXPORT_BACKUP_JSON',
      `Backup completo exportado em JSON (${debtors.length} devedores, ${purchases.length} compras, ${installments.length} parcelas) -> ${fileName}`,
      currentUser?.id
    );
  } catch {
    // Ignore audit log errors
  }

  return metadata;
}
