import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, Landmark } from '@mediapipe/tasks-vision';

// ─── Constants ────────────────────────────────────────────────

const MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm';

// ─── Types ───────────────────────────────────────────────────

export type GripData = {
  thumbIndexAngle: number;
  wristAngle: number;
  fingerSpread: number;
  landmarkConfidence: number;
};

interface GripCameraProps {
  onGripData: (data: GripData) => void;
  sessionId: string;
}

// ─── Math Helpers ─────────────────────────────────────────────

const calculateAngle = (v1: Landmark, v2: Landmark, origin: Landmark): number => {
  const d1 = { x: v1.x - origin.x, y: v1.y - origin.y, z: v1.z - origin.z };
  const d2 = { x: v2.x - origin.x, y: v2.y - origin.y, z: v2.z - origin.z };
  
  const dot = d1.x * d2.x + d1.y * d2.y + d1.z * d2.z;
  const mag1 = Math.sqrt(d1.x ** 2 + d1.y ** 2 + d1.z ** 2);
  const mag2 = Math.sqrt(d2.x ** 2 + d2.y ** 2 + d2.z ** 2);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cos) * (180 / Math.PI);
};

const calculateDistance = (p1: Landmark, p2: Landmark): number => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2);
};

// ─── Component ───────────────────────────────────────────────

const GripCamera: React.FC<GripCameraProps> = ({ onGripData, sessionId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize MediaPipe
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_PATH,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
        
        if (active) {
          landmarkerRef.current = landmarker;
          setIsLoaded(true);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      }
    }

    init();
    return () => { active = false; };
  }, []);

  // Camera Access
  useEffect(() => {
    if (!isLoaded) return;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    startCamera();
    
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [isLoaded]);

  // Frame Processing Loop
  useEffect(() => {
    if (!isLoaded || !videoRef.current || !canvasRef.current) return;

    let rafId: number;
    const ctx = canvasRef.current.getContext('2d')!;

    const render = (time: number) => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || video.readyState !== 4) {
        rafId = requestAnimationFrame(render);
        return;
      }

      // Sync canvas size
      if (canvasRef.current.width !== video.videoWidth) {
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
      }

      const results = landmarker.detectForVideo(video, time);
      
      // Clear Overlay
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        const score = results.handedness[0][0].score;
        setConfidence(score);

        // Drawing Hand landmarks
        ctx.fillStyle = "#10b981"; // emerald-500
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;

        landmarks.forEach((p, idx) => {
          const x = p.x * canvasRef.current!.width;
          const y = p.y * canvasRef.current!.height;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        });

        // ─── Calculations ─────────────────────────────────────
        
        // 1. Thumb-Index Angle: wrist(0) to thumbTip(4) vs wrist(0) to indexMCP(5)
        const thumbIndexAngle = calculateAngle(landmarks[4], landmarks[5], landmarks[0]);

        // 2. Wrist Angle: extension/flexion
        // Approximation: angle between forearm (wrist-midpoint) and palm orientation
        // Since forearm is hidden, let's use the angle between wrist(0) and the mid-palm vs the horizontal axis
        const palmMid = {
          x: (landmarks[5].x + landmarks[17].x) / 2,
          y: (landmarks[5].y + landmarks[17].y) / 2,
          z: (landmarks[5].z + landmarks[17].z) / 2,
        };
        const wristAngle = calculateAngle(palmMid, { ...landmarks[0], x: landmarks[0].x + 0.1 }, landmarks[0]);

        // 3. Finger Spread: distance between adjacent MCPs (5-9, 9-13, 13-17)
        const d1 = calculateDistance(landmarks[5], landmarks[9]);
        const d2 = calculateDistance(landmarks[9], landmarks[13]);
        const d3 = calculateDistance(landmarks[13], landmarks[17]);
        const fingerSpread = (d1 + d2 + d3) / 3;

        // Emit Data
        onGripData({
          thumbIndexAngle,
          wristAngle,
          fingerSpread,
          landmarkConfidence: score,
        });
      } else {
        setConfidence(0);
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [isLoaded, onGripData]);

  const getConfidenceColor = () => {
    if (confidence >= 0.7) return 'bg-emerald-500';
    if (confidence >= 0.4) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getConfidenceText = () => {
    if (confidence >= 0.7) return 'High Confidence / 高信賴度';
    if (confidence >= 0.4) return 'Moderate Confidence / 中等信賴度';
    if (confidence === 0) return 'No Hand Detected / 未偵測到手部';
    return 'Low Confidence / 低信賴度';
  };

  if (error) return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-center">
      <p className="font-bold">Camera Initialization Error / 設定錯誤</p>
      <p className="text-sm mt-2">{error}</p>
    </div>
  );

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 shadow-2xl border-4 border-slate-800">
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-slate-900/80 backdrop-blur-sm text-white">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium">Initializing AI Hand Tracker... / 正在初始化...</p>
        </div>
      )}

      {/* Video Preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Landmark Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Accuracy Badge */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className={`px-4 py-2 rounded-full shadow-lg text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors ${getConfidenceColor()}`}>
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          {getConfidenceText()}
        </div>
        
        <div className="flex gap-2">
            <div className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-lg text-white text-[10px] font-bold border border-white/20">
              ID: {sessionId.slice(0, 8)}
            </div>
        </div>
      </div>

      {/* Helper Overlays */}
      <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end pointer-events-none">
        <div className="space-y-2">
          <div className="bg-black/40 backdrop-blur-md p-3 rounded-xl border border-white/20 text-white leading-tight">
            <p className="text-[10px] text-emerald-400 font-black uppercase mb-1">Observation Target / 觀察目標</p>
            <p className="text-sm">Position your hand clearly in view / 確保手部與筆桿清晰可見</p>
          </div>
        </div>
        
        <div className="w-24 h-24 border-2 border-emerald-500/20 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default GripCamera;
