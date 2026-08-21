import { useState } from 'react';
import type { Serviceanfrage } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconChevronDown } from '@tabler/icons-react';
import { GeoMapPicker } from '@/components/GeoMapPicker';
import { MapRouteLinks } from '@/components/widgets/MapWidget';
import { t, appLabel, fieldLabel, lookupLabel } from '@/i18n';

interface ServiceanfrageViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Serviceanfrage | null;
  onEdit: (record: Serviceanfrage) => void;
}

export function ServiceanfrageViewDialog({ open, onClose, record, onEdit }: ServiceanfrageViewDialogProps) {
  const [showCoords, setShowCoords] = useState(false);

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('view_entity', { entity: appLabel('serviceanfrage') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('serviceanfrage', 'problembeschreibung')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.problembeschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('serviceanfrage', 'dringlichkeit')}</Label>
            <Badge variant="secondary">{lookupLabel('serviceanfrage', 'dringlichkeit', record.fields.dringlichkeit?.key) ?? record.fields.dringlichkeit?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('serviceanfrage', 'strasse')}</Label>
            <p className="text-sm">{record.fields.strasse ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('serviceanfrage', 'hausnummer')}</Label>
            <p className="text-sm">{record.fields.hausnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('serviceanfrage', 'plz')}</Label>
            <p className="text-sm">{record.fields.plz ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('serviceanfrage', 'ort')}</Label>
            <p className="text-sm">{record.fields.ort ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('serviceanfrage', 'einsatzort_geo')}</Label>
            {record.fields.einsatzort_geo?.info && (
              <p className="text-sm text-muted-foreground break-words whitespace-normal">{record.fields.einsatzort_geo.info}</p>
            )}
            {record.fields.einsatzort_geo?.lat != null && record.fields.einsatzort_geo?.long != null && (
              <GeoMapPicker
                lat={record.fields.einsatzort_geo.lat}
                lng={record.fields.einsatzort_geo.long}
                readOnly
              />
            )}
            {record.fields.einsatzort_geo?.lat != null && record.fields.einsatzort_geo?.long != null && (
              <MapRouteLinks lat={record.fields.einsatzort_geo.lat} long={record.fields.einsatzort_geo.long} className="mt-1" />
            )}
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-1 max-sm:py-2 transition-colors" onClick={() => setShowCoords(v => !v)}>
              {showCoords ? t('fr_hide_coords') : t('fr_show_coords')}
              <IconChevronDown className={`h-3 w-3 transition-transform ${showCoords ? "rotate-180" : ""}`} />
            </button>
            {showCoords && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-xs text-muted-foreground">{t('fr_lat')}:</span> {record.fields.einsatzort_geo?.lat?.toFixed(6) ?? '—'}</div>
                <div><span className="text-xs text-muted-foreground">{t('fr_long')}:</span> {record.fields.einsatzort_geo?.long?.toFixed(6) ?? '—'}</div>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('serviceanfrage', 'vorname')}</Label>
            <p className="text-sm">{record.fields.vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('serviceanfrage', 'nachname')}</Label>
            <p className="text-sm">{record.fields.nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('serviceanfrage', 'telefon')}</Label>
            <p className="text-sm">{record.fields.telefon ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('serviceanfrage', 'email')}</Label>
            <p className="text-sm">{record.fields.email ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('serviceanfrage', 'erreichbarkeit')}</Label>
            <p className="text-sm">{record.fields.erreichbarkeit ?? '—'}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.SERVICEANFRAGE} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}