import {useState} from 'react';
import {Fingerprint,ShieldCheck} from 'lucide-react';
import {useAuth} from '../../app/AuthProvider';
import {navigate} from '../../app/router';
import {useSubmit} from '../../hooks/useSubmit';
import {ErrorNotice} from '../../components/common';
import {loginSchema} from '../../../shared/auth';

export function Login(){
 const {login}=useAuth(),submit=useSubmit();
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 return <div className="central-login">
  <header className="central-login-header"><span className="workspace-brand"><span>CM</span><strong>COMUNIC@TE POS</strong></span><span><ShieldCheck size={14}/> Acceso restringido</span></header>
  <main className="central-login-columns">
   <section className="central-login-intro">
    <p className="eyebrow">OPERACIÓN CENTRALIZADA</p>
    <h1>Claridad para <br/>cada equipo, <br/>venta y <br/>cliente.</h1>
    <p>Un espacio de trabajo preciso para mantener la operación ordenada, segura y fácil de consultar.</p>
    <small><ShieldCheck size={16}/>Acceso restringido a cuentas autorizadas.</small>
   </section>
   <section className="central-login-card">
    <span className="module-icon"><Fingerprint size={27}/></span><p className="eyebrow">BIENVENIDO</p>
    <h2>Inicia sesión</h2>
    <form className="administrative-login" onSubmit={async e=>{
     e.preventDefault();
     const result=await submit.run(async()=>{
      const input=loginSchema.parse({email,password});
      await login(input.email,input.password);
      return true;
     });
     if(result){setPassword('');navigate('/dashboard');}
    }}>
     <fieldset disabled={submit.busy}>
      <label>Correo<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Contraseña<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <ErrorNotice message={submit.error}/>
      <button className="primary-button">{submit.busy?'Iniciando sesión...':'Iniciar sesión'}</button>
     </fieldset>
    </form>
    <small>Si necesitas acceso, contacta al administrador de COMUNIC@TE.</small>
   </section>
  </main>
 </div>;
}
