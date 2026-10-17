/** Display either supported client-name format without changing stored identity fields. */
export function displayClientName(client:{fullName?:string|null;firstName?:string;lastName?:string}|null|undefined){return client?.fullName?.trim()||[client?.firstName,client?.lastName].filter(Boolean).join(' ');}
