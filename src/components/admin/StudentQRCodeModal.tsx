
import { X, Printer, Download } from 'lucide-react';
import { QRCodeGenerator } from './QRCodeGenerator';

interface StudentQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id: string;
    name: string;
    qrToken: string;
  } | null;
}

/**
 * Modal to display and print a student's QR code.
 */
export function StudentQRCodeModal({ isOpen, onClose, student }: StudentQRCodeModalProps) {
  if (!isOpen || !student) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rewardUrl = `${window.location.origin}/quick-reward/${student.qrToken}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${student.name}</title>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .container {
              text-align: center;
              padding: 40px;
              border: 3px dashed #ccc;
              border-radius: 20px;
            }
            #qr-canvas { margin-bottom: 20px; }
            .name { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
            .hint { color: #888; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <canvas id="qr-canvas"></canvas>
            <div class="name">${student.name}</div>
            <div class="hint">Scan to award coins</div>
          </div>
          <script>
            QRCode.toCanvas(document.getElementById('qr-canvas'), '${rewardUrl}', { 
              width: 200,
              margin: 2,
              errorCorrectionLevel: 'H'
            }, function (error) {
              if (error) console.error(error);
              setTimeout(() => window.print(), 500);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = () => {
    // Create a canvas from the SVG and download as PNG
    const svg = document.querySelector('#qr-modal-svg svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.download = `qr-${student.name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Student QR Code</h2>
            <p className="text-sm text-gray-500">{student.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* QR Code Display */}
        <div className="p-8 flex justify-center" id="qr-modal-svg">
          <QRCodeGenerator
            qrToken={student.qrToken}
            size={250}
            studentName={student.name}
            includeBorder={true}
          />
        </div>

        {/* Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors"
          >
            <Printer size={20} />
            Print
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-colors"
          >
            <Download size={20} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

export default StudentQRCodeModal;
