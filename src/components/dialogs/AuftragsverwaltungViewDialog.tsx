import type { Auftragsverwaltung, Serviceanfrage } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { IconPencil } from '@tabler/icons-react';
import { t, appLabel, fieldLabel, lookupLabel, dateFnsLocale, dateFormat } from '@/i18n';
import { format, parseISO } from 'date-fns';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), dateFormat(), { locale: dateFnsLocale() }); } catch { return d; }
}

interface AuftragsverwaltungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Auftragsverwaltung | null;
  onEdit: (record: Auftragsverwaltung) => void;
  serviceanfrageList: Serviceanfrage[];
}

export function AuftragsverwaltungViewDialog({ open, onClose, record, onEdit, serviceanfrageList }: AuftragsverwaltungViewDialogProps) {
  function getServiceanfrageDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return serviceanfrageList.find(r => r.record_id === id)?.fields.strasse ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('view_entity', { entity: appLabel('auftragsverwaltung') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('auftragsverwaltung', 'anfrage')}</Label>
            <p className="text-sm">{getServiceanfrageDisplayName(record.fields.anfrage)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('auftragsverwaltung', 'erledigt')}</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.erledigt ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.erledigt ? t('yes') : t('no')}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('auftragsverwaltung', 'erledigungsdatum')}</Label>
            <p className="text-sm">{formatDate(record.fields.erledigungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('auftragsverwaltung', 'notizen')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.notizen ?? '—'}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.AUFTRAGSVERWALTUNG} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}