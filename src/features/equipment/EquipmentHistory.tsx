import { useApiQuery } from '../../hooks/useApiQuery';
import type { Equipment, HistoryEvent } from '../../types/pos';
import { ErrorNotice, formatDate, Loading, statusLabels } from '../../components/common';

const events: Record<string, string> = { EQUIPMENT_CREATED: 'Equipo creado', OWNER_ASSIGNED: 'Propietario asignado', OWNER_CHANGED: 'Propietario cambiado', IMEI_ADDED: 'IMEI añadido', IMEI_REGISTRATION_STARTED: 'Registro de IMEI iniciado', IMEI_REGISTERED: 'IMEI registrado', IMEI_REGISTRATION_REJECTED: 'Registro de IMEI rechazado', IMEI_REGISTRATION_CANCELLED: 'Registro de IMEI cancelado', IMEI_REGISTRATION_UPDATED: 'Estado de IMEI actualizado', EQUIPMENT_UPDATED: 'Datos del equipo actualizados', SOLD: 'Operación comercial', SALE_CANCELLED: 'Venta cancelada' };
const priority = ['EQUIPMENT_CREATED', 'OWNER_ASSIGNED', 'IMEI_ADDED', 'IMEI_REGISTRATION_STARTED', 'IMEI_REGISTERED', 'IMEI_REGISTRATION_REJECTED', 'IMEI_REGISTRATION_CANCELLED', 'IMEI_REGISTRATION_UPDATED', 'EQUIPMENT_UPDATED'];
export function EquipmentHistory({ equipment }: { equipment: Equipment }) {
  const query = useApiQuery<HistoryEvent[]>(`/equipment/${equipment.id}/history`);
  const ordered = query.data ? [...query.data].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || priority.indexOf(a.eventType) - priority.indexOf(b.eventType) || a.id.localeCompare(b.id)) : [];
  return <section className="history-section"><h2>Historial del equipo</h2>{query.loading && <Loading />}<ErrorNotice message={query.error?.message} retry={query.refresh} />{!query.loading && !query.error && (ordered.length ? <ol className="timeline">{ordered.map(event => {
    const imei = equipment.imeis.find(i => i.id === event.imeiId);
    const from = typeof event.metadata?.from === 'string' ? event.metadata.from : '';
    const to = typeof event.metadata?.to === 'string' ? event.metadata.to : '';
    return <li key={event.id}><time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time><div><strong>{events[event.eventType] ?? 'Evento del equipo'}{imei ? ` · IMEI ${imei.slot}` : ''}</strong>{from && to && <p>{statusLabels[from] ?? from} → {statusLabels[to] ?? to}</p>}</div></li>;
  })}</ol> : <p className="muted">Todavía no hay eventos registrados.</p>)}</section>;
}
