import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AvatarCategory } from '../avatar/avatarParts';
import { Upload, X, Check, Loader2, Image as ImageIcon } from 'lucide-react';

const CATEGORIES: { id: AvatarCategory; label: string; defaultZ: number }[] = [
    { id: 'background', label: 'Background', defaultZ: 10 },
    { id: 'body', label: 'Body Base', defaultZ: 20 },
    { id: 'face', label: 'Face Shape', defaultZ: 30 },
    { id: 'eyes', label: 'Eyes', defaultZ: 50 },
    { id: 'mouth', label: 'Mouth', defaultZ: 50 },
    { id: 'bottoms', label: 'Bottoms', defaultZ: 60 },
    { id: 'shoes', label: 'Shoes', defaultZ: 65 },
    { id: 'tops', label: 'Tops', defaultZ: 70 },
    { id: 'hair_back', label: 'Hair (Back)', defaultZ: 15 },
    { id: 'hair_front', label: 'Hair (Front)', defaultZ: 90 },
    { id: 'accessories', label: 'Accessories', defaultZ: 100 },
];

export const AdminAssetUploader: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Form fields
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<AvatarCategory>('body');
    const [zIndex, setZIndex] = useState<number>(20); // Defaults match initial category selection
    const [basePrice, setBasePrice] = useState<number>(0);
    const [isDefault, setIsDefault] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));

            // Auto-fill name if empty
            if (!name) {
                setName(selectedFile.name.split('.')[0].replace(/[-_]/g, ' '));
            }
        }
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value as AvatarCategory;
        setCategory(selectedId);

        // Auto-update suggested Z-index based on category
        const catConfig = CATEGORIES.find(c => c.id === selectedId);
        if (catConfig) setZIndex(catConfig.defaultZ);
    };

    const clearForm = () => {
        setFile(null);
        setPreviewUrl(null);
        setName('');
        setDescription('');
        setCategory('body');
        setZIndex(20);
        setBasePrice(0);
        setIsDefault(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        if (!file) {
            setError('Please select an image file first.');
            return;
        }

        if (!name.trim()) {
            setError('Please provide a name for this asset.');
            return;
        }

        setUploading(true);

        try {
            // 1. Upload file to Storage Bucket
            const fileExt = file.name.split('.').pop();
            const fileName = `${category}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${category}/${fileName}`;

            const { error: uploadError, data: uploadData } = await supabase.storage
                .from('avatar-assets')
                .upload(filePath, file, { cacheControl: '3600', upsert: false });

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatar-assets')
                .getPublicUrl(filePath);

            // 3. Insert Database Record
            const { error: dbError } = await supabase
                .from('avatar_items')
                .insert({
                    name: name.trim(),
                    description: description.trim() || null,
                    category,
                    image_url: publicUrl,
                    layer_z_index: zIndex,
                    base_price: basePrice,
                    is_default: isDefault
                });

            if (dbError) throw dbError;

            setSuccessMsg(`Successfully uploaded ${name}!`);
            clearForm();
        } catch (err: any) {
            console.error('Upload Error:', err);
            setError(err.message || 'Failed to upload asset.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden max-w-4xl mx-auto">
            <div className="bg-slate-50 border-b border-gray-100 p-6 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 font-display">Avatar Asset Uploader</h2>
                    <p className="text-sm text-gray-500 mt-1">Upload PNGs or SVGs to the database to be equipped by users in the builder.</p>
                </div>
                <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                    <ImageIcon className="w-6 h-6" />
                </div>
            </div>

            <form onSubmit={handleUpload} className="p-6">

                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-3">
                        <X className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-semibold">Upload Failed</h4>
                            <p className="text-sm opacity-90">{error}</p>
                        </div>
                    </div>
                )}

                {successMsg && (
                    <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-3">
                        <Check className="w-5 h-5" />
                        <span className="font-medium">{successMsg}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* LEFT: File Selection & Preview */}
                    <div className="space-y-4">
                        <label className="block text-sm font-semibold text-gray-700">Image Asset (PNG/SVG)</label>

                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`
                                relative w-full aspect-square md:aspect-auto md:h-64 rounded-xl border-2 border-dashed 
                                flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-slate-50
                                ${previewUrl ? 'border-amber-400 bg-amber-50/20' : 'border-gray-300'}
                            `}
                        >
                            {previewUrl ? (
                                <img src={previewUrl} alt="Preview" className="max-w-[80%] max-h-[80%] object-contain drop-shadow-md" />
                            ) : (
                                <div className="text-center text-gray-400">
                                    <Upload className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                    <p className="font-medium">Click to select file</p>
                                    <p className="text-xs mt-1">Supports transparent PNG, SVG</p>
                                </div>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png, image/svg+xml"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </div>

                        {previewUrl && (
                            <button
                                type="button"
                                onClick={clearForm}
                                className="text-sm text-red-500 font-medium hover:text-red-700"
                            >
                                Clear Selection
                            </button>
                        )}
                    </div>

                    {/* RIGHT: Metadata Fields */}
                    <div className="space-y-5">

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Asset Name *</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g., Red Short Hair"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Category *</label>
                            <select
                                value={category}
                                onChange={handleCategoryChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow outline-none bg-white"
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1" title="Determines rendering order (lower = back, higher = front)">
                                    Layer Z-Index *
                                </label>
                                <input
                                    type="number"
                                    required
                                    value={zIndex}
                                    onChange={e => setZIndex(parseInt(e.target.value) || 0)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow outline-none"
                                />
                                <p className="text-[10px] text-gray-500 mt-1 pl-1">Default for {category}: {CATEGORIES.find(c => c.id === category)?.defaultZ}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1" title="Cost in Learning Coins to equip this item">
                                    Base Price (Coins)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={basePrice}
                                    onChange={e => setBasePrice(parseInt(e.target.value) || 0)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Description (Optional)</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={2}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow outline-none resize-none"
                            />
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <input
                                type="checkbox"
                                id="isDefault"
                                checked={isDefault}
                                onChange={e => setIsDefault(e.target.checked)}
                                className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500 border-gray-300"
                            />
                            <label htmlFor="isDefault" className="text-sm font-medium text-gray-700 cursor-pointer">
                                Give to all users by default? <span className="text-gray-500 font-normal">(Users will own this without buying it)</span>
                            </label>
                        </div>

                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                    <button
                        type="submit"
                        disabled={uploading || !file}
                        className={`
                            flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all
                            ${uploading || !file
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-amber-500 hover:bg-amber-600 hover:shadow-lg hover:-translate-y-0.5'}
                        `}
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Uploading to DB...
                            </>
                        ) : (
                            <>
                                <Upload className="w-5 h-5" />
                                Upload Avatar Asset
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};
