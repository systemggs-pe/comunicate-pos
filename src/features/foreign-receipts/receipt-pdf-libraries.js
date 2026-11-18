import {jsPDF} from 'jspdf';
import JsBarcode from 'jsbarcode';

let pdf417LoadPromise = null;

export function getPdfTools() {
  return {jsPDF, JsBarcode};
}

export async function getPdf417Generator() {
  if (!pdf417LoadPromise) {
    pdf417LoadPromise = import('pdf417/build/index.js')
      .then(module => {
        const imported = module?.default || module;
        const generator = imported?.default || imported;
        if (typeof generator !== 'function') throw new Error('PDF417_NOT_AVAILABLE');
        return generator;
      })
      .catch(error => {
        pdf417LoadPromise = null;
        if (error?.message === 'PDF417_NOT_AVAILABLE') throw error;
        throw new Error('PDF417_NOT_AVAILABLE', {cause: error});
      });
  }
  return pdf417LoadPromise;
}
