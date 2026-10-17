import {DirectoryPage,DirectoryDetails} from '../features/clients/Directory';
import { navigate } from '../app/router';
import { BackLink, PageHeading } from '../components/common';
import { ClientForm } from '../features/clients/ClientForm';

export const ClientsPage=DirectoryPage;
export function NewClientPage() { return <><BackLink to="/clientes">Clientes</BackLink><PageHeading title="Nuevo cliente" description="El DNI identifica a la persona y no se podrá editar." /><ClientForm onSaved={client => navigate(`/clientes/${client.id}?saved=1`)} onCancel={() => navigate('/clientes')} /></>; }
export const ClientDetailsPage=DirectoryDetails;
