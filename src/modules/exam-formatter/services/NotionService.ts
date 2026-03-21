import { supabase } from '@/integrations/supabase/client';
import { Block, BlockType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class NotionService {
    /**
     * Helper to extract text from various Notion property types
     */
    private static getText(properties: any, name: string): string {
        const prop = properties[name] || properties[name.toLowerCase()];
        if (!prop) return '';
        if (prop.type === 'title') return prop.title?.map((t: any) => t.plain_text).join('') || '';
        if (prop.type === 'rich_text') return prop.rich_text?.map((t: any) => t.plain_text).join('') || '';
        if (prop.type === 'select') return prop.select?.name || '';
        return '';
    }

    private static getNumber(properties: any, name: string): number | null {
        const prop = properties[name] || properties[name.toLowerCase()];
        return prop?.type === 'number' ? prop.number : null;
    }

    private static getMultiSelect(properties: any, name: string): string[] {
        const prop = properties[name] || properties[name.toLowerCase()];
        if (prop?.type === 'multi_select') {
            return prop.multi_select.map((s: any) => s.name);
        }
        return [];
    }

    /**
     * Fetch questions from a Notion Database
     */
    static async fetchDatabase(databaseId: string, session: any): Promise<Block[]> {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const { data, error } = await supabase.functions.invoke('notion-api', {
            headers: {
                'Authorization': `Bearer ${session?.access_token || anonKey}`,
                'apikey': anonKey
            },
            body: { 
                databaseId: databaseId.trim(),
                action: 'query-mcq-database'
            }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        const results = data.results || [];
        
        return results.map((entry: any) => {
            const props = entry.properties;
            
            // Map properties
            const stem = this.getText(props, 'Question') || this.getText(props, 'Question Stem') || this.getText(props, 'text');
            const marks = this.getNumber(props, 'Marks') || this.getNumber(props, 'Points');
            
            // Try formatting options
            let options = this.getMultiSelect(props, 'Options');
            if (options.length === 0) {
                const optionsRaw = this.getText(props, 'Options');
                if (optionsRaw) {
                    options = optionsRaw.split(',').map(s => s.trim());
                }
            }

            const blockType: BlockType = options.length > 0 ? 'QUESTION' : 'QUESTION'; // Could infer differently if needed

            const block: Block = {
                id: uuidv4(),
                type: blockType,
                content: {
                    stem,
                    ...(marks && { marks }),
                    ...(options.length > 0 && { options })
                },
                sourceRef: {
                    notionId: entry.id,
                    lastEditedTime: entry.last_edited_time
                }
            };

            return block;
        });
    }

    /**
     * Update content back to Notion
     */
    static async updatePageFields(pageId: string, updates: any, session: any) {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const { data, error } = await supabase.functions.invoke('notion-api', {
            headers: {
                'Authorization': `Bearer ${session?.access_token || anonKey}`,
                'apikey': anonKey
            },
            body: { 
                action: 'update-page-properties',
                pageId: pageId,
                properties: updates
            }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);
        return data;
    }
}
