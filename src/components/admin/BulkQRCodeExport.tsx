import { useState } from 'react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Download, Loader2 } from 'lucide-react';

interface StudentForExport {
    id: string;
    display_name: string | null;
    class_number: number | null;
    qr_token?: string;
}

interface BulkQRCodeExportProps {
    students: StudentForExport[];
}

export function BulkQRCodeExport({ students }: BulkQRCodeExportProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);

    const generateQRCodeImage = async (student: StudentForExport): Promise<{ blob: Blob | null, filename: string }> => {
        return new Promise(async (resolve) => {
            try {
                if (!student.qr_token) {
                    resolve({ blob: null, filename: '' });
                    return;
                }

                const size = 600; // Resolution
                const padding = 40;
                const textBoxHeight = 160;
                const canvasHeight = size + textBoxHeight;

                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = canvasHeight;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    resolve({ blob: null, filename: '' });
                    return;
                }

                // 1. White Background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // 2. Generate QR Code
                const rewardUrl = `${window.location.origin}/quick-reward/${student.qr_token}`;
                // Use qrcode to draw directly to a temporary canvas or get data URL
                const qrDataUrl = await QRCode.toDataURL(rewardUrl, {
                    width: size - (padding * 2),
                    margin: 2,
                    errorCorrectionLevel: 'H'
                });

                const qrImage = new Image();
                qrImage.src = qrDataUrl;
                await new Promise((r) => { qrImage.onload = r; });

                // Draw QR centered
                ctx.drawImage(qrImage, padding, padding);

                // 3. Draw Text Details
                ctx.fillStyle = '#1e293b'; // Slate-800
                ctx.textAlign = 'center';

                // Name
                ctx.font = 'bold 48px sans-serif'; // Larger font
                const nameY = size + 10; // Start text below QR
                ctx.fillText(student.display_name || 'Unnamed', size / 2, nameY + 50);

                // Class Info
                ctx.fillStyle = '#64748b'; // Slate-500
                ctx.font = '32px sans-serif';
                const classText = `Class No. ${student.class_number || 'N/A'}`;
                ctx.fillText(classText, size / 2, nameY + 100);

                // 4. Convert to Blob
                canvas.toBlob((blob) => {
                    // Filename sanitization
                    const safeName = (student.display_name || 'student').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const studentNum = student.class_number !== null ? student.class_number.toString().padStart(2, '0') : 'XX';
                    const filename = `${studentNum}_${safeName}.jpg`;
                    resolve({ blob, filename });
                }, 'image/jpeg', 0.9);

            } catch (err) {
                console.error('Error generating QR for', student.display_name, err);
                resolve({ blob: null, filename: '' });
            }
        });
    };

    const handleExport = async () => {
        if (students.length === 0) return;
        setIsExporting(true);
        setProgress(0);

        try {
            const zip = new JSZip();
            const folder = zip.folder("student_qr_codes");

            let processed = 0;
            // Process in chunks to avoid freezing UI
            const chunkSize = 5;
            for (let i = 0; i < students.length; i += chunkSize) {
                const chunk = students.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (student) => {
                    const result = await generateQRCodeImage(student);
                    if (result.blob && folder) {
                        folder.file(result.filename, result.blob);
                    }
                }));
                processed += chunk.length;
                setProgress(Math.round((processed / students.length) * 100));
                // Small delay to let UI breathe
                await new Promise(r => setTimeout(r, 10));
            }

            // Generate ZIP
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `student_qr_codes_${new Date().toISOString().split('T')[0]}.zip`);

        } catch (err) {
            console.error('Export failed:', err);
            alert('Failed to export QR codes');
        } finally {
            setIsExporting(false);
            setProgress(0);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={isExporting || students.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isExporting ? (
                <>
                    <Loader2 size={20} className="animate-spin" />
                    Exporting {progress}%
                </>
            ) : (
                <>
                    <Download size={20} />
                    Export QR Codes
                </>
            )}
        </button>
    );
}
