import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiClient, ApiError } from '../services/api';
import type { AuthUser, PermissionKey } from '../../shared/auth';
interface AuthContext { api: ApiClient; user: AuthUser|null; isAuthenticated: boolean; loading: boolean; error: string|null; refresh: () => Promise<void>; login: (email:string,password:string)=>Promise<void>; logout:()=>Promise<void>; can:(permission:PermissionKey)=>boolean }
const Context=createContext<AuthContext|null>(null);
export function AuthProvider({children}:{children:ReactNode}) {
  const api=useMemo(()=>new ApiClient(),[]); const [user,setUser]=useState<AuthUser|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
  const refresh=useCallback(async()=>{ try { setUser(await api.get<AuthUser>('/auth/me')); setError(null); } catch(e) { if(e instanceof ApiError && e.status===401) {setUser(null);setError(null);} else setError(e instanceof Error?e.message:'No se pudo comprobar la sesión.'); } finally {setLoading(false);} },[api]);
  useEffect(()=>{ const unauthorized=()=>setUser(null); const changed=()=>{void refresh();}; window.addEventListener('pos:unauthorized',unauthorized); window.addEventListener('pos:datachanged',changed); queueMicrotask(()=>{void refresh();}); return()=>{window.removeEventListener('pos:unauthorized',unauthorized);window.removeEventListener('pos:datachanged',changed);}; },[refresh]);
  async function login(email:string,password:string) { setUser(await api.post<AuthUser>('/auth/login',{email,password})); setError(null); }
  async function logout() { await api.post('/auth/logout',{}); setUser(null); }
  return <Context.Provider value={{api,user,isAuthenticated:!!user,loading,error,refresh,login,logout,can:permission=>!!user?.permissions.includes(permission)}}>{children}</Context.Provider>;
}
export function useAuth(){const context=useContext(Context);if(!context)throw new Error('AuthProvider requerido');return context;}
export function Can({permission,children}:{permission:PermissionKey;children:ReactNode}){return useAuth().can(permission)?<>{children}</>:null;}
