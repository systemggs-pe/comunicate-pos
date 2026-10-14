import {useEffect,useRef,type RefObject} from 'react';

export function focusFormHeading(heading:HTMLElement|null,scrollTarget:HTMLElement|null=heading) {
  if(!heading)return;
  heading.focus({preventScroll:true});
  (scrollTarget??heading).scrollIntoView({block:'start',behavior:'instant'});
}

export function useFormStepFocus(step:number,container:RefObject<HTMLElement|null>) {
  const previous=useRef(step);
  useEffect(()=>{
    if(previous.current===step)return;
    previous.current=step;
    const frame=requestAnimationFrame(()=>focusFormHeading(container.current?.querySelector<HTMLElement>('[data-step-heading]')??null,container.current?.parentElement?.querySelector<HTMLElement>('.form-progress')??null));
    return()=>cancelAnimationFrame(frame);
  },[step,container]);
}
