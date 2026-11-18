export function FormProgress({steps,current}:{steps:string[];current:number}) {
  return <div className="form-progress">
    <p className="form-progress-current" role="status">Paso {current+1} de {steps.length}: {steps[current]}</p>
    <ol className="workflow-steps" aria-label="Etapas del formulario">{steps.map((label,index)=><li key={label} aria-current={index===current?'step':undefined}>{index+1}. {label}</li>)}</ol>
  </div>;
}
