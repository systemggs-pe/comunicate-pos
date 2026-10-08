import { SaleLinks, money } from './common';
import { Link } from '../../app/router';
import { formatDate, StatusBadge } from '../../components/common';
import type { Equipment, Sale } from '../../types/pos';
export function ClientSales({ sales }: { sales: Sale[] }) { return <section className="related-section"><h2>Ventas como comprador</h2><SaleLinks sales={sales} /></section>; }
export function EquipmentSales({ equipment }: { equipment: Equipment }) { return equipment.origin === 'STORE' ? <section className="related-section"><h2>Información comercial</h2>{equipment.saleEquipment?.length ? equipment.saleEquipment.map(line => <article className="sale-item" key={line.id}><div className="section-heading"><Link className="inline-link" to={`/ventas/${line.sale.id}`}>{line.sale.code}</Link><StatusBadge status={line.sale.status} /></div><p>Comprador: <Link className="inline-link" to={`/clientes/${line.sale.buyerId}`}>{line.sale.buyer.firstName} {line.sale.buyer.lastName}</Link></p><p>Precio histórico: {money(line.unitPrice)}</p><p>{formatDate(line.sale.createdAt)}</p></article>) : <p className="muted">Este equipo todavía no está asociado a una venta.</p>}</section> : null; }
