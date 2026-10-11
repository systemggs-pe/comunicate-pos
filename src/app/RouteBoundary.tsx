import {Component,type ReactNode} from 'react';
export class RouteBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<section role="alert" className="form-panel"><h1>No se pudo cargar esta sección</h1><p>Comprueba tu conexión y vuelve a intentarlo.</p><button type="button" className="secondary-button" onClick={()=>window.location.reload()}>Volver a intentar</button></section>:this.props.children;}
}
