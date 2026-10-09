import { randomUUID } from 'node:crypto';
export const workflowClient={dni:'70876543',firstName:'Brand',lastName:'Prueba'};
export const workflowImeis=[{slot:1,value:'359708765430001',type:'PHYSICAL' as const},{slot:2,value:'359708765430002',type:'ESIM' as const}];
export const requestFields={operator:'CLARO' as const,phone:'912345678',referencePhone:null,address:'Dirección ficticia 123',department:'Lima',email:'fixture@example.test',price:'0',blockStatus:'NOT_BLOCKED' as const,hasBox:true,conditions:'Atención de prueba',occurredAt:'2026-10-09T12:30:00-05:00'};
export const workflowInput=()=>({idempotencyKey:randomUUID(),client:workflowClient,imeis:workflowImeis,equipment:{commercialName:'Galaxy S25',brand:'Samsung',model:'S25',ram:'12 GB',storage:'256 GB',color:'Azul'},requests:workflowImeis.map((imei,index)=>({...requestFields,value:imei.value,phone:index?'987654321':'912345678',status:'PENDING' as const}))});
