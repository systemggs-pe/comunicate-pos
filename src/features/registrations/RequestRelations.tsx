import { Link } from '../../app/router';
import type { Equipment } from '../../types/pos';
export function RequestRelations({equipment}:{equipment:Equipment}) {
  const requests=equipment.imeis.flatMap(imei=>imei.requests??[]);
  return <section className="related-section"><h2>Solicitudes de registro</h2>{requests.length?requests.map(request=><p key={request.id}><Link className="inline-link" to={`/registros/${request.id}`}>{request.code}</Link> · IMEI {equipment.imeis.find(i=>i.id===request.imeiId)?.slot} · {request.status==='REGISTERED'?'REGISTRADO':request.status==='PENDING'?'REGISTRO PENDIENTE':'BLOQUEADO'}</p>):<p>Sin solicitudes operativas. Los cambios técnicos históricos se conservan abajo.</p>}</section>;
}
