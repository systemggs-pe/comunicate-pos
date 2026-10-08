import {describe,it,expect,vi,afterEach} from 'vitest';
import {hashPassword,verifyPassword} from '../../server/lib/password';
import {hashToken} from '../../server/services/auth.service';
import {cookieOptions,cookieName} from '../../server/auth/middleware';
import {emailSchema,passwordSchema,roleUpdateSchema,permissionKeys} from '../../shared/auth';
afterEach(()=>vi.unstubAllEnvs());
describe('Fronteras puras de autenticación',()=>{
 it('normaliza email',()=>expect(emailSchema.parse(' ADMIN@COMUNICATE.PE ')).toBe('admin@comunicate.pe'));
 it.each(['short','x'.repeat(129)])('política rechaza extremo %s',password=>expect(passwordSchema.safeParse(password).success).toBe(false));
 it('permite frase sin composición artificial',()=>expect(passwordSchema.parse('una frase larga')).toBe('una frase larga'));
 it('Argon2id salado verifica sin plaintext',async()=>{const a=await hashPassword('test-password-only'),b=await hashPassword('test-password-only');expect(a).toMatch(/^\$argon2id\$/);expect(a).not.toBe(b);expect(await verifyPassword(a,'test-password-only')).toBe(true);expect(await verifyPassword(a,'wrong')).toBe(false);});
 it('hash malformado no autentica',async()=>expect(await verifyPassword('invalid','test-password-only')).toBe(false));
 it('token hash SHA256 estable y diferente',()=>{expect(hashToken('a')).toHaveLength(64);expect(hashToken('a')).not.toBe('a');expect(hashToken('a')).not.toBe(hashToken('b'));});
 it('cookie productiva segura y Host prefijo',()=>{vi.stubEnv('NODE_ENV','production');expect(cookieOptions()).toEqual({httpOnly:true,secure:true,sameSite:'lax',path:'/'});expect(cookieName()).toBe('__Host-pos_session');});
 it('cookie localhost compatible',()=>{vi.stubEnv('NODE_ENV','test');expect(cookieOptions().secure).toBe(false);});
 it('permisos desconocidos/repetidos rechazados',()=>{expect(roleUpdateSchema.safeParse({permissions:['sales.create','sales.create']}).success).toBe(false);expect(roleUpdateSchema.safeParse({permissions:['tenant.admin']}).success).toBe(false);expect(permissionKeys).toHaveLength(21);});
});
