export interface EvidenceStorageProvider {
 upload(key:string,bytes:Buffer):Promise<void>;
 download(key:string,maxBytes:number):Promise<Buffer>;
 delete(key:string):Promise<void>;
 exists(key:string):Promise<boolean>;
 authorizeUpload(key:string,mimeType:string,size:number):Promise<{url:string;headers:Record<string,string>;expiresIn:number}>;
 authorizeDownload(key:string,fileName?:string):Promise<{url:string;expiresIn:number}>;
}
