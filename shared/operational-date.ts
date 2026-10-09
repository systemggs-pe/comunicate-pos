// La empresa opera en Lima (UTC-5, sin horario de verano).
export function limaDateTimeNow() { return new Date(Date.now()-5*60*60*1000).toISOString().slice(0,16); }
export function limaDateTimeIso(value:string) { return new Date(`${value}:00-05:00`).toISOString(); }
