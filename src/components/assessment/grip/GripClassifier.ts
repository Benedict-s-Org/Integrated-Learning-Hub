import { GripData } from "./GripCamera";

// ─── Threshold Constants ──────────────────────────────────────

const DYNAMIC_TRIPOD_ANGLE_MIN = 25;
const DYNAMIC_TRIPOD_ANGLE_MAX = 45;
const DYNAMIC_TRIPOD_SPREAD_MIN = 0.3;
const DYNAMIC_TRIPOD_SPREAD_MAX = 0.6;
const DYNAMIC_TRIPOD_CONFIDENCE_MIN = 0.7;

const LATERAL_PINCH_ANGLE_MAX = 20;
const LATERAL_PINCH_SPREAD_MAX = 0.25;

const FISTED_GRIP_SPREAD_MAX = 0.2;
const FISTED_GRIP_WRIST_MIN = 30;

const EXTENDED_FINGER_SPREAD_MIN = 0.7;

const THUMB_WRAP_ANGLE_MAX = 15;
const THUMB_WRAP_WRIST_MAX = 10;

// ─── Types ────────────────────────────────────────────────────

export type GripType =
  | "dynamic_tripod"
  | "lateral_pinch"
  | "fisted_grip"
  | "extended_finger"
  | "thumb_wrap"
  | "unknown";

export type GripClassification = {
  gripType: GripType;
  confidence: number; // 0–1
  englishLabel: string;
  chineseLabel: string;
  recommendation: string;
  chineseRecommendation: string;
};

// ─── Classification Logic ─────────────────────────────────────

export function classifyGrip(data: GripData): GripClassification {
  const { thumbIndexAngle, wristAngle, fingerSpread, landmarkConfidence } = data;

  // 1. Dynamic Tripod (Ideal)
  if (
    thumbIndexAngle >= DYNAMIC_TRIPOD_ANGLE_MIN &&
    thumbIndexAngle <= DYNAMIC_TRIPOD_ANGLE_MAX &&
    fingerSpread >= DYNAMIC_TRIPOD_SPREAD_MIN &&
    fingerSpread <= DYNAMIC_TRIPOD_SPREAD_MAX &&
    landmarkConfidence >= DYNAMIC_TRIPOD_CONFIDENCE_MIN
  ) {
    return {
      gripType: "dynamic_tripod",
      confidence: landmarkConfidence,
      englishLabel: "Dynamic Tripod",
      chineseLabel: "動態三指握筆",
      recommendation: "Ideal grip. Encourage pencil control exercises.",
      chineseRecommendation: "理想握筆姿勢，鼓勵鉛筆控制練習。",
    };
  }

  // 2. Lateral Pinch
  if (
    thumbIndexAngle < LATERAL_PINCH_ANGLE_MAX &&
    fingerSpread < LATERAL_PINCH_SPREAD_MAX
  ) {
    return {
      gripType: "lateral_pinch",
      confidence: landmarkConfidence,
      englishLabel: "Lateral Pinch",
      chineseLabel: "側面夾筆",
      recommendation: "Thumb overlapping index finger. Try pencil grip aid.",
      chineseRecommendation: "拇指壓著食指，建議使用握筆輔助器。",
    };
  }

  // 3. Fisted Grip
  if (
    fingerSpread < FISTED_GRIP_SPREAD_MAX &&
    wristAngle > FISTED_GRIP_WRIST_MIN
  ) {
    return {
      gripType: "fisted_grip",
      confidence: landmarkConfidence,
      englishLabel: "Fisted Grip",
      chineseLabel: "拳式握筆",
      recommendation: "Whole hand gripping. Reduce pressure, use triangular pencil.",
      chineseRecommendation: "全手握筆，建議減少握力，改用三角鉛筆。",
    };
  }

  // 4. Extended Finger
  if (fingerSpread > EXTENDED_FINGER_SPREAD_MIN) {
    return {
      gripType: "extended_finger",
      confidence: landmarkConfidence,
      englishLabel: "Extended Finger",
      chineseLabel: "手指伸直握筆",
      recommendation: "Fingers too spread. May cause fatigue. Try finger positioning stickers.",
      chineseRecommendation: "手指過度展開，容易疲勞，建議使用手指定位貼紙。",
    };
  }

  // 5. Thumb Wrap
  if (
    thumbIndexAngle < THUMB_WRAP_ANGLE_MAX &&
    wristAngle < THUMB_WRAP_WRIST_MAX
  ) {
    return {
      gripType: "thumb_wrap",
      confidence: landmarkConfidence,
      englishLabel: "Thumb Wrap",
      chineseLabel: "拇指包圍握筆",
      recommendation: "Thumb wrapping over fingers. Restricts movement. Use pencil grip.",
      chineseRecommendation: "拇指包圍其他手指，限制活動，建議使用握筆器。",
    };
  }

  // 6. Fallback (Unknown)
  return {
    gripType: "unknown",
    confidence: 0,
    englishLabel: "Unknown",
    chineseLabel: "未能識別",
    recommendation: "Adjust camera angle for better hand visibility.",
    chineseRecommendation: "請調整鏡頭角度以清晰拍攝手部。",
  };
}

// ─── Debug Mode ───────────────────────────────────────────────

export type GripDebugInfo = {
  input: GripData;
  thresholdsChecked: Array<{
    gripType: GripType;
    passed: boolean;
    reason: string;
  }>;
  result: GripClassification;
};

export function classifyGripDebug(data: GripData): GripDebugInfo {
  const { thumbIndexAngle, wristAngle, fingerSpread, landmarkConfidence } = data;
  const thresholdsChecked: GripDebugInfo["thresholdsChecked"] = [];

  const addCheck = (gripType: GripType, field: string, value: number, op: string, threshold: string | number, passed: boolean) => {
    thresholdsChecked.push({
      gripType,
      passed,
      reason: `${field} ${Number.isFinite(value) ? value.toFixed(2) : value} ${op} ${threshold} [${passed ? "PASS" : "FAIL"}]`,
    });
    return passed;
  };

  const result = (() => {
    // 1. Dynamic Tripod
    const dtAngleRange = `[${DYNAMIC_TRIPOD_ANGLE_MIN}, ${DYNAMIC_TRIPOD_ANGLE_MAX}]`;
    const dtSpreadRange = `[${DYNAMIC_TRIPOD_SPREAD_MIN}, ${DYNAMIC_TRIPOD_SPREAD_MAX}]`;
    
    const dt1 = addCheck("dynamic_tripod", "thumbIndexAngle", thumbIndexAngle, "in", dtAngleRange, 
      thumbIndexAngle >= DYNAMIC_TRIPOD_ANGLE_MIN && thumbIndexAngle <= DYNAMIC_TRIPOD_ANGLE_MAX);
    const dt2 = dt1 && addCheck("dynamic_tripod", "fingerSpread", fingerSpread, "in", dtSpreadRange, 
      fingerSpread >= DYNAMIC_TRIPOD_SPREAD_MIN && fingerSpread <= DYNAMIC_TRIPOD_SPREAD_MAX);
    const dt3 = dt2 && addCheck("dynamic_tripod", "landmarkConfidence", landmarkConfidence, ">=", DYNAMIC_TRIPOD_CONFIDENCE_MIN, 
      landmarkConfidence >= DYNAMIC_TRIPOD_CONFIDENCE_MIN);

    if (dt3) return classifyGrip(data);

    // 2. Lateral Pinch
    const lp1 = addCheck("lateral_pinch", "thumbIndexAngle", thumbIndexAngle, "<", LATERAL_PINCH_ANGLE_MAX, 
      thumbIndexAngle < LATERAL_PINCH_ANGLE_MAX);
    const lp2 = lp1 && addCheck("lateral_pinch", "fingerSpread", fingerSpread, "<", LATERAL_PINCH_SPREAD_MAX, 
      fingerSpread < LATERAL_PINCH_SPREAD_MAX);
    
    if (lp2) return classifyGrip(data);

    // 3. Fisted Grip
    const fg1 = addCheck("fisted_grip", "fingerSpread", fingerSpread, "<", FISTED_GRIP_SPREAD_MAX, 
      fingerSpread < FISTED_GRIP_SPREAD_MAX);
    const fg2 = fg1 && addCheck("fisted_grip", "wristAngle", wristAngle, ">", FISTED_GRIP_WRIST_MIN, 
      wristAngle > FISTED_GRIP_WRIST_MIN);

    if (fg2) return classifyGrip(data);

    // 4. Extended Finger
    const ef1 = addCheck("extended_finger", "fingerSpread", fingerSpread, ">", EXTENDED_FINGER_SPREAD_MIN, 
      fingerSpread > EXTENDED_FINGER_SPREAD_MIN);

    if (ef1) return classifyGrip(data);

    // 5. Thumb Wrap
    const tw1 = addCheck("thumb_wrap", "thumbIndexAngle", thumbIndexAngle, "<", THUMB_WRAP_ANGLE_MAX, 
      thumbIndexAngle < THUMB_WRAP_ANGLE_MAX);
    const tw2 = tw1 && addCheck("thumb_wrap", "wristAngle", wristAngle, "<", THUMB_WRAP_WRIST_MAX, 
      wristAngle < THUMB_WRAP_WRIST_MAX);
    
    if (tw2) return classifyGrip(data);

    return classifyGrip(data);
  })();

  return {
    input: data,
    thresholdsChecked,
    result,
  };
}
