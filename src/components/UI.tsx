import type { PropsWithChildren, ReactNode } from 'react';
export function Card({children,className=''}:PropsWithChildren<{className?:string}>){ return <section className={`card ${className}`}>{children}</section>; }
export function Chip({active,children,onClick}:{active?:boolean;children:ReactNode;onClick?:()=>void}){ return <button type="button" onClick={onClick} className={`chip ${active?'active':''}`}>{children}</button>; }
export function PrimaryButton({children,onClick,type='button',disabled=false}:{children:ReactNode;onClick?:()=>void;type?:'button'|'submit';disabled?:boolean}){return <button className="btn primary" type={type} onClick={onClick} disabled={disabled}>{children}</button>}
export function Empty({title,action}:{title:string;action?:ReactNode}){return <div className="empty"><div>✦</div><strong>{title}</strong>{action}</div>}
