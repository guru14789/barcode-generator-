
import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeDisplayProps {
  value: string;
  format?: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  className?: string;
}

const BarcodeDisplay: React.FC<BarcodeDisplayProps> = ({ 
  value, 
  format = 'CODE128', 
  width = 2, 
  height = 100, 
  displayValue = true,
  className = ""
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, value, {
          format,
          width,
          height,
          displayValue,
          fontSize: 14,
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (err) {
        console.error('Barcode generation failed:', err);
      }
    }
  }, [value, format, width, height, displayValue]);

  return (
    <div className={`flex justify-center bg-white p-4 rounded-xl shadow-inner border border-slate-100 ${className}`}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default BarcodeDisplay;
