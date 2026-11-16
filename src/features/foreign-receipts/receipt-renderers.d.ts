export interface ReceiptRenderRuntime {
 verificationUrl:string;
 canvas:()=>object;
 barcode417:(value:string,width:number,height:number)=>string;
}
interface RendererInput {
 cliente:{nombre:string;dni:string;tipoDocumento:string};
 ventas:{imeiEquipo:string;imei2Equipo?:string;sn?:string;marcaEquipo?:string;modeloEquipo?:string;nombreComercial:string;memoria?:string;color?:string;precio:string}[];
 equiposMap:Record<string,{imei2?:string;sn?:string;marca?:string;modelo?:string;nombreComercial:string;memoria?:string;color?:string}>;
 totalClp:number;
 totalUsd:number;
 fechaHora:string;
 nBoleta:number;
 emisor:Record<string,string|undefined>;
}
export type ReceiptRenderResult={blob:Blob;url:string;nombre:string};
interface Renderer {
 (data:RendererInput&{output:'bloburl'}):Promise<ReceiptRenderResult>;
 (data:RendererInput&{output:'bytes';runtime:ReceiptRenderRuntime}):Promise<ArrayBuffer>;
}
export const generarBoletaExtranjera:Renderer;
export const generarBoletaExtranjera2:Renderer;
export const generarBoletaExtranjera3:Renderer;
export const generarBoletaExtranjera4:Renderer;
export const generarBoletaExtranjera5:Renderer;
export const generarBoletaExtranjera6:Renderer;
export const generarBoletaExtranjera7:Renderer;
