import { ARUCO_DICT_4X4_1000 } from '../../lib/aruco-dictionary';

interface ArucoMarkerProps {
    id: number;
    className?: string;
}

export function ArucoMarker({ id, className = "w-full h-full" }: ArucoMarkerProps) {
    if (id < 0 || id >= ARUCO_DICT_4X4_1000.length) {
        return null;
    }

    const hexStr = ARUCO_DICT_4X4_1000[id];
    const num = parseInt(hexStr, 16);

    const rects = [];

    // Outer black border (6x6 modules)
    rects.push(<rect key="bg" x="0" y="0" width="6" height="6" fill="black" />);
    // Inner white background (4x4 modules)
    rects.push(<rect key="inner-bg" x="1" y="1" width="4" height="4" fill="white" />);

    // Draw the bits (0 = black, 1 = white)
    // OpenCV DICT_4X4 stores the MSB as the first bit (row 0, col 0)
    for (let i = 0; i < 16; i++) {
        const bit = (num >> (15 - i)) & 1;
        if (bit === 0) {
            const x = 1 + (i % 4);
            const y = 1 + Math.floor(i / 4);
            rects.push(<rect key={`bit-${i}`} x={x} y={y} width="1" height="1" fill="black" />);
        }
    }

    return (
        <svg
            className={className}
            viewBox="0 0 6 6"
            xmlns="http://www.w3.org/2000/svg"
            style={{ shapeRendering: 'crispEdges' }}
        >
            {rects}
        </svg>
    );
}
