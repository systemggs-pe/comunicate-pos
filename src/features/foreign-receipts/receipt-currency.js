export function penToClp(pen) {
  const raw = parseFloat(pen || 0) * 266.67; // tasa aproximada
  // Redondear al múltiplo de 5000 más cercano.
  return Math.round(raw / 5000) * 5000;
}
export function formatClp(clp) {
  return clp.toLocaleString('es-CL');
}

export function penToUsd(pen, penPerUsd = 3.75) {
  const rate = Number(penPerUsd);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round((Number(pen || 0) / rate) * 100) / 100;
}

export function formatUsd(usd) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(usd || 0));
}
