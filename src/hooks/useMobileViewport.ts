import {useEffect} from 'react';

export function useMobileViewport(){
 useEffect(()=>{
  const viewport=window.visualViewport;
  if(!viewport)return;
  const root=document.documentElement;
  let frame=0;
  let adjusted:Element|null=null;
  const sync=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const focused=document.activeElement;
    const editor=focused?.matches('textarea:not([readonly]), input:is([type=text],[type=email],[type=password],[type=search],[type=tel],[type=url],[type=number],:not([type])):not([readonly]), [contenteditable=true]');
    const keyboard=Boolean(window.matchMedia('(max-width:650px)').matches&&editor&&viewport.scale===1&&root.clientHeight-viewport.height>120);
    root.toggleAttribute('data-pos-keyboard',keyboard);
    if(keyboard){
     root.style.setProperty('--pos-viewport-height',`${viewport.height}px`);
     root.style.setProperty('--pos-viewport-top',`${viewport.offsetTop}px`);
     root.style.setProperty('--pos-viewport-cover',`${Math.max(0,root.clientHeight-viewport.height-viewport.offsetTop)}px`);
     if(focused&&focused!==adjusted){
      adjusted=focused;
      const dock=focused.closest('.registration-workspace,form')?.querySelector('.mobile-workflow-actions');
      const bottom=viewport.offsetTop+viewport.height-(dock?.getBoundingClientRect().height??0)-8;
      const rect=focused.getBoundingClientRect();
      if(rect.bottom>bottom||rect.top<viewport.offsetTop)focused.scrollIntoView({block:'center',inline:'nearest'});
     }
    }else{
     adjusted=null;
    }
   });
  };
  viewport.addEventListener('resize',sync);
  viewport.addEventListener('scroll',sync);
  document.addEventListener('focusin',sync);
  document.addEventListener('focusout',sync);
  return ()=>{
   cancelAnimationFrame(frame);
   viewport.removeEventListener('resize',sync);
   viewport.removeEventListener('scroll',sync);
   document.removeEventListener('focusin',sync);
   document.removeEventListener('focusout',sync);
   root.removeAttribute('data-pos-keyboard');
   for(const property of ['--pos-viewport-height','--pos-viewport-top','--pos-viewport-cover'])root.style.removeProperty(property);
  };
 },[]);
}
