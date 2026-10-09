import { createContext, useContext, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';

const Fields = createContext<{ errors: Record<string, string>; prefix: string }>({ errors: {}, prefix: '' });
export function FormValidation({ errors, children }: { errors: Record<string, string>; children: ReactNode }) {
  return <Fields.Provider value={{ errors, prefix: '' }}>{children}</Fields.Provider>;
}
export function FieldScope({ prefix, children }: { prefix: string; children: ReactNode }) {
  const parent = useContext(Fields);
  return <Fields.Provider value={{ ...parent, prefix: [parent.prefix, prefix].filter(Boolean).join('.') }}>{children}</Fields.Provider>;
}
export function ValidatedInput({ name, onChange, onInvalid, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const { errors, prefix } = useContext(Fields), id = useId();
  const [nativeError, setNativeError] = useState('');
  const path = name ? [prefix, name].filter(Boolean).join('.') : undefined;
  const message = (path ? errors[path] : undefined) || nativeError;
  return <><input {...props} name={path} aria-invalid={!!message} aria-describedby={message ? id : props['aria-describedby']} onInvalid={event => { setNativeError(event.currentTarget.validationMessage); onInvalid?.(event); }} onChange={event => { setNativeError(''); onChange?.(event); }} />{message && <span id={id} className="field-error" role="alert">{message}</span>}</>;
}
