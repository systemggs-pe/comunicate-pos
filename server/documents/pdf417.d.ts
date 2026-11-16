declare module 'pdf417/build/index.js' {
 type Barcode=(value:string,width:number,height:number)=>string;
 const generator:Barcode|{default:Barcode};
 export default generator;
}
