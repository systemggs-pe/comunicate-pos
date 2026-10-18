/** Keep known DNI types together; a manual upload can complete either missing side. */
export function selectIdentityDocuments<T extends {category:string;documentType:string}>(documents:T[],knownTypes:string[]=[]):T[]{
 const known=[...new Set(knownTypes.filter(type=>type!=='MANUAL'))];
 if(known.length>1)return [];
 const types=known.length?known:[...new Set(documents.map(d=>d.documentType).filter(type=>type!=='MANUAL')),'MANUAL'];
 const groups=types.map(type=>['DNI_FRONT','DNI_BACK'].flatMap(category=>{
  const exact=documents.filter(d=>d.category===category&&d.documentType===type);
  const candidates=exact.length?exact:documents.filter(d=>d.category===category&&d.documentType==='MANUAL');
  return candidates.length===1?candidates:[];
 }));
 return groups.find(group=>group.length===2)??groups.find(group=>group.length)??[];
}
