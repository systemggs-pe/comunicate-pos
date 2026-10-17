import {useState} from 'react';
import {useDniLookup} from '../hooks/useDniLookup';
import {DniClientFields} from '../features/clients/DniClientFields';
import {emptyClient} from '../features/clients/ClientFields';
import {PageHeading} from '../components/common';
export function PhotoDniPage(){const [value,setValue]=useState(emptyClient),lookup=useDniLookup(value,setValue);return <section className="reference-panel photo-dni-page"><PageHeading title="Foto DNI" description="Identifica al cliente para consultar y conservar su documentación privada con autorización."/><DniClientFields value={value} onChange={setValue} lookup={lookup}/></section>;}
