import { FaceRoundSoft, FaceOvalSoft, FaceRoundedSquare, FaceHeartSoft } from './parts/FaceParts';
import { EyesNeutralOpen, EyesHappySparkle, EyesSmileClosed, EyesSoftWink } from './parts/EyeParts';
import { MouthNeutralLine, MouthSmallSmile, MouthOpenLaugh, MouthSmileTeeth } from './parts/MouthParts';
import { HairShortNeat, HairMessyBangs, HairSidePart, HairPonytail } from './parts/HairParts';
import { TopCardigan, TopHoodie, TopTShirt, TopJacket } from './parts/TopParts';
import { LegsFixed, BottomJeans, BottomShorts, BottomSkirtALine, BottomSkirtPleated } from './parts/BottomParts';
import { ShoesSneakers, ShoesDress } from './parts/ShoeParts';
import { AccGlassesThick, AccBeret, AccBackpackSmall } from './parts/AccParts';

// Render priorities (lowest = background, highest = foreground)
// 0. Base Hair (back)
// 1. Legs
// 2. Shoes
// 3. Face
// 4. Accessories (Backpack back)
// 5. Mouth
// 6. Eyes
// 7. Tops
// 8. Bottoms
// 9. Skirt Overlay (if active)
// 10. Front Hair
// 11. Accessories (Hat, Glasses)

export const AvatarAssetRegistry: Record<string, React.FC<any>> = {
    // Faces
    'face-round-soft': FaceRoundSoft,
    'face-oval-soft': FaceOvalSoft,
    'face-rounded-square': FaceRoundedSquare,
    'face-heart-soft': FaceHeartSoft,

    // Eyes
    'eyes-neutral-open': EyesNeutralOpen,
    'eyes-happy-sparkle': EyesHappySparkle,
    'eyes-smile-closed': EyesSmileClosed,
    'eyes-soft-wink': EyesSoftWink,

    // Mouths
    'mouth-neutral-line': MouthNeutralLine,
    'mouth-small-smile': MouthSmallSmile,
    'mouth-open-laugh': MouthOpenLaugh,
    'mouth-smile-teeth': MouthSmileTeeth,

    // Hair
    'hair-short-neat': HairShortNeat,
    'hair-messy-bangs': HairMessyBangs,
    'hair-side-part': HairSidePart,
    'hair-ponytail': HairPonytail,

    // Tops
    'top-cardigan': TopCardigan,
    'top-hoodie': TopHoodie,
    'top-tshirt': TopTShirt,
    'top-jacket': TopJacket,

    // Bottoms
    'bottom-jeans': BottomJeans,
    'bottom-shorts': BottomShorts,
    'bottom-skirt-a-line': BottomSkirtALine,
    'bottom-skirt-pleated': BottomSkirtPleated,

    // Legs Fixed (cannot be equipped separately, always shown)
    'legs-fixed': LegsFixed,

    // Shoes
    'shoes-sneakers': ShoesSneakers,
    'shoes-dress': ShoesDress,

    // Accessories
    'acc-glasses-thick': AccGlassesThick,
    'acc-beret': AccBeret,
    'acc-backpack-small': AccBackpackSmall,
};
