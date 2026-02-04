import { AssetType } from '@/types/asset';

// The "Soft/Cute Isometric" Design System Parameters
export const DESIGN_SYSTEM_PARAMETERS = {
    visual_style_analysis_single_asset: {
        style_category: "Isometric Game Asset / Icon Design",
        sub_genre: "Soft/Cute Aesthetic Object",
        color_scheme: {
            overall_tone: "Warm & Pastel",
            saturation: "Low-to-Mid Saturation",
            brightness: "High Brightness",
            palette_application: [
                "Flat color filling",
                "Morandi colors",
                "Monochromatic & Analogous harmonies"
            ],
            background_handling: "Transparent Background"
        },
        form_and_perspective: {
            projection_type: "30-degree Isometric Projection",
            viewpoint: "Standard Isometric View",
            geometry_style: [
                "Simplified Geometry",
                "Rounded corners/edges",
                "Chunky/Cute proportions"
            ],
            volumetric_representation: "Volume defined by perspective lines"
        },
        composition_and_framing: {
            framing: "Single object centered",
            cropping: "Full object display, no cropping",
            negative_space: "Surrounding negative space"
        },
        line_work_and_details: {
            line_style: "Clean, consistent outlines",
            detail_level: "Low detail density",
            texture_representation: "Minimalist textures, material differentiation via color blocks"
        }
    }
};

export function generateAssetPrompt(type: string, name: string, description: string): string {
    const coreSubject = `Isometric ${type}: ${name}, ${description}`;

    // Construct a prompt that enforces the parameters
    return `
Subject: ${coreSubject}

Style Parameters:
- Type: ${DESIGN_SYSTEM_PARAMETERS.visual_style_analysis_single_asset.style_category} (${DESIGN_SYSTEM_PARAMETERS.visual_style_analysis_single_asset.sub_genre})
- Perspective: 30-degree Isometric, White Background (to be removed)
- Colors: Warm/Pastel Morandi palette. Soft Peach, Sage Green, Periwinkle, Warm Cream. High brightness, low saturation.
- Shapes: Chunky, rounded corners, "soft" friendly look. No sharp edges.
- Lines: Clear, consistent thick outlines (sticker style).

Strict Constraints:
- NO photorealism.
- NO dark shadows.
- SINGLE object centered.
`.trim();
}

export function getDesignJSON(type: string, name: string, description: string) {
    return {
        ...DESIGN_SYSTEM_PARAMETERS,
        subject_context: {
            type,
            name,
            description
        }
    };
}
