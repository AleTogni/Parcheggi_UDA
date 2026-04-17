import { supabase } from './supabaseClient';

export const getUserProfile = async (authId) => {
  const { data, error } = await supabase
    .from('PERSONA')
    .select('*')
    .eq('supabase_uuid', authId) // Il campo che hai appena aggiunto
    .single();
  
  if (error) console.error("Errore profilo:", error);
  return data;
};