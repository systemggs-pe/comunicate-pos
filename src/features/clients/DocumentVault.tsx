import {useAuth} from '../../app/AuthProvider';
import type {ClientDocumentView} from '../../../shared/client-documents';
import {IdentityPhotoLookup} from './IdentityPhotoLookup';
export interface DocumentHistory {id:string;category:string;requestId:string;requestCode:string;equipmentId:string;imeiId:string;createdAt:string;linkedDocumentId:string|null}
export interface VaultData {documents:(ClientDocumentView&{references?:{requestId:string;requestCode:string;equipmentId:string}[]})[];history:DocumentHistory[]}
export function DocumentVault({clientId}:{clientId:string}){
 const {can}=useAuth();
 if(!can('client.documents.read'))return <p>Tu rol no tiene permiso para consultar fotografías privadas.</p>;
 return <IdentityPhotoLookup key={clientId} clientId={clientId}/>;
}
