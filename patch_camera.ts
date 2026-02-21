import { readFileSync, writeFileSync } from 'fs';

const file = 'src/pages/InteractiveScanQuizPage.tsx';
let content = readFileSync(file, 'utf-8');

const oldState = `    // Placeholder Scanner State for Compilation
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    const detectorRef = useRef<any>(null);
    const stopScan = () => {};`;

const newState = `    // Scanner State
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    const animationFrameId = useRef<number>();
    const detectorRef = useRef<any>(null);
    const lastDetectTime = useRef<number>(0);

    const startScan = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setIsScanning(true);
                processFrame();
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("Could not access camera.");
        }
    };

    const stopScan = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        setIsScanning(false);
    };

    const processFrame = () => {
        if (!videoRef.current || !canvasRef.current || !detectorRef.current || !isScanning) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
            animationFrameId.current = requestAnimationFrame(processFrame);
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const now = performance.now();
        if (now - lastDetectTime.current > 200) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let markers = detectorRef.current.detect(imageData);
            if (markers.length > 0) {
                drawMarkers(ctx, markers);
                processMarkers(markers);
            }
            lastDetectTime.current = performance.now();
        }

        animationFrameId.current = requestAnimationFrame(processFrame);
    };

    const getAnswerFromRotation = (marker: any): string => {
        const c0 = marker.corners[0];
        const c1 = marker.corners[1];
        const c3 = marker.corners[3];
        const dxTop = c1.x - c0.x;
        const dyTop = c1.y - c0.y;
        const dxLeft = c0.x - c3.x;
        const dyLeft = c0.y - c3.y;
        
        const lenTop = Math.sqrt(dxTop * dxTop + dyTop * dyTop);
        const lenLeft = Math.sqrt(dxLeft * dxLeft + dyLeft * dyLeft);
        
        const dirXTop = dxTop / lenTop;
        const dirYTop = dyTop / lenTop;
        const dirXLeft = dxLeft / lenLeft;
        const dirYLeft = dyLeft / lenLeft;

        // A is Up: Vector 0->1 is horizontal to the right (1, 0), Vector 3->0 is vertical up (0, -1)
        if (dirXTop > 0.7 && dirYLeft < -0.7) return 'A';
        // B is Up: Vector 0->1 is vertical down (0, 1), Vector 3->0 is horizontal right (1, 0)
        if (dirYTop > 0.7 && dirXLeft > 0.7) return 'B';
        // C is Up: Vector 0->1 is horizontal left (-1, 0), Vector 3->0 is vertical down (0, 1)
        if (dirXTop < -0.7 && dirYLeft > 0.7) return 'C';
        // D is Up: Vector 0->1 is vertical up (0, -1), Vector 3->0 is horizontal left (-1, 0)
        if (dirYTop < -0.7 && dirXLeft < -0.7) return 'D';

        return 'A'; // Default fallback
    };

    const processMarkers = async (markers: any[]) => {
        if (!activeSession || activeSession.status !== 'polling' || !activeSession.current_question_id) return;

        const updates: any[] = [];
        const uniqueStudentIds = new Set<string>();

        markers.forEach(marker => {
            const answer = getAnswerFromRotation(marker);
            // Mock map marker ID to student ID based on class formatting for now.
            // In a real scenario, this would look up the user by marker_id.
            const studentId = \`\${selectedClass}-\${marker.id}\`;
            
            if (!uniqueStudentIds.has(studentId) && responses[studentId] !== answer) {
                uniqueStudentIds.add(studentId);
                updates.push({
                    session_id: activeSession.id,
                    question_id: activeSession.current_question_id!,
                    student_id: studentId,
                    answer: answer
                });
            }
        });

        if (updates.length > 0) {
            const { error } = await supabase
                .from('interactive_quiz_responses' as any)
                .upsert(updates, { onConflict: 'session_id,question_id,student_id' });

            if (!error) {
                const newResponses = { ...responses };
                updates.forEach(u => newResponses[u.student_id] = u.answer);
                setResponses(newResponses);
            }
        }
    };

    const drawMarkers = (ctx: CanvasRenderingContext2D, markers: any[]) => {
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#10b981"; // Emerald
        markers.forEach(marker => {
            ctx.beginPath();
            ctx.moveTo(marker.corners[0].x, marker.corners[0].y);
            ctx.lineTo(marker.corners[1].x, marker.corners[1].y);
            ctx.lineTo(marker.corners[2].x, marker.corners[2].y);
            ctx.lineTo(marker.corners[3].x, marker.corners[3].y);
            ctx.closePath();
            ctx.stroke();

            // Mark top edge
            ctx.strokeStyle = "#ef4444"; // Red
            ctx.beginPath();
            ctx.moveTo(marker.corners[0].x, marker.corners[0].y);
            ctx.lineTo(marker.corners[1].x, marker.corners[1].y);
            ctx.stroke();
            ctx.strokeStyle = "#10b981";

            const cx = (marker.corners[0].x + marker.corners[2].x) / 2;
            const cy = (marker.corners[0].y + marker.corners[2].y) / 2;
            
            // Draw background for ID pill
            ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
            ctx.beginPath();
            ctx.roundRect(cx - 30, cy - 20, 60, 40, 8);
            ctx.fill();

            // Draw ID
            ctx.fillStyle = "#10b981";
            ctx.font = "bold 24px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(marker.id.toString(), cx, cy);
        });
    };`;

content = content.replace(oldState, newState);

const oldCameraHtml = `                    {/* Camera Feed */}
                    <div className="flex-1 bg-black rounded-3xl border-4 border-slate-800 shadow-2xl relative overflow-hidden flex items-center justify-center">
                        <Video size={64} className="text-slate-700" />
                        <span className="absolute bottom-6 font-bold text-slate-500 tracking-widest uppercase">Scanner Active</span>
                    </div>`;

const newCameraHtml = `                    {/* Camera Feed */}
                    <div className="flex-1 bg-black rounded-3xl border-4 border-slate-800 shadow-2xl relative overflow-hidden">
                        {isScanning ? (
                            <>
                                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover hidden" playsInline />
                                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button onClick={stopScan} className="bg-red-500 hover:bg-red-400 text-white p-3 rounded-full shadow-lg transition active:scale-90">
                                        <Square fill="currentColor" size={20} />
                                    </button>
                                </div>
                                {activeSession?.status === 'polling' && (
                                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur text-emerald-400 px-4 py-2 rounded-full font-bold flex items-center gap-2 animate-pulse mt-2 ml-2 shadow-lg">
                                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                                        Scanning Active
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <Video size={64} className="text-slate-700 mb-6" />
                                <button
                                    onClick={startScan}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-full font-black text-lg shadow-[0_0_40px_rgba(16,185,129,0.3)] transition transform active:scale-95 flex items-center gap-2"
                                >
                                    <Play fill="currentColor" /> Start Camera
                                </button>
                            </div>
                        )}
                    </div>`;

content = content.replace(oldCameraHtml, newCameraHtml);

writeFileSync(file, content);
