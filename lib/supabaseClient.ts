
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hwhpntkjdjddltllrohb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3aHBudGtqZGpkZGx0bGxyb2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MDk1NjksImV4cCI6MjA3ODk4NTU2OX0.FvbghzrwzqYZKS5ObCaE5svoyLJ98d9g26tY9h2ND10';

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getDistinctValues(table: string, column: string): Promise<string[]> {
    try {
        const { data, error } = await supabase
            .from(table)
            .select(column)
            .limit(1000); // Limit to avoid massive fetches that might timeout

        if (error) {
            console.warn(`Error fetching distinct values for ${column} from ${table}:`, error.message);
            return [];
        }

        if (!data) {
            return [];
        }

        const uniqueValues = new Set<string>();

        if (Array.isArray(data)) {
            data.forEach((item: any) => {
                const value = item?.[column];
                if (value) {
                    uniqueValues.add(String(value).trim().toUpperCase());
                }
            });
        }
        
        return Array.from(uniqueValues).sort();
    } catch (error: any) {
        console.warn(`Network error fetching distinct values for ${column} from ${table}:`, error.message);
        return [];
    }
}

export async function saveAutocompleteValue(category: string, value: string) {
    if (!value) return;
    const cleanValue = value.trim().toUpperCase();
    // Uses onConflict to ignore duplicates (requires unique constraint on category, value)
    const { error } = await supabase
        .from('saved_entries')
        .upsert({ category, value: cleanValue }, { onConflict: 'category,value' });
    
    if (error) {
        console.warn(`Error saving autocomplete value for ${category}:`, error.message);
    }
}

export async function getSavedAutocompleteValues(category: string): Promise<string[]> {
    try {
        const { data, error } = await supabase
            .from('saved_entries')
            .select('value')
            .eq('category', category);

        if (error) {
            console.warn(`Error fetching saved values for ${category}:`, error.message);
            return [];
        }

        return (data || []).map((item: any) => item.value).sort();
    } catch (error: any) {
        console.warn(`Network error fetching saved values for ${category}:`, error.message);
        return [];
    }
}
