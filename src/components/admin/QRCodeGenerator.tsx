
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeGeneratorProps {
    /** The unique QR token for the student */
    qrToken: string;
    /** Size of the QR code in pixels */
    size?: number;
    /** Whether to include a border for printing */
    includeBorder?: boolean;
    /** Student name for label */
    studentName?: string;
}

/**
 * Generates a QR code that links to the reward page for a specific student.
 */
export function QRCodeGenerator({
    qrToken,
    size = 200,
    includeBorder = true,
    studentName
}: QRCodeGeneratorProps) {
    // Generate the reward URL based on current origin
    const rewardUrl = `${window.location.origin}/reward/${qrToken}`;

    return (
        <div
            className={`flex flex-col items-center gap-4 ${includeBorder ? 'p-6 border-2 border-dashed border-gray-300 rounded-xl bg-white' : ''}`}
        >
            <QRCodeSVG
                value={rewardUrl}
                size={size}
                level="H" // High error correction for better scanning
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#000000"
            />
            {studentName && (
                <div className="text-center">
                    <div className="font-bold text-gray-800 text-lg">{studentName}</div>
                    <div className="text-xs text-gray-400 mt-1">Scan to award coins</div>
                </div>
            )}
        </div>
    );
}

export default QRCodeGenerator;
