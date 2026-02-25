// src/typings/html2canvas.d.ts
declare module 'html2canvas' {
  const html2canvas: (
    element: HTMLElement,
    options?: any,
  ) => Promise<HTMLCanvasElement>;
  export default html2canvas;
}

// src/typings/jspdf.d.ts
declare module 'jspdf' {
  class jsPDF {
    constructor(
      orientation: 'l' | 'p',
      unit: string,
      format: [number, number] | string,
    );
    addImage(
      imageData: string,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number,
    ): jsPDF;
    addPage(): jsPDF;
    save(filename: string): void;
  }
  export { jsPDF };
  export default jsPDF;
}
