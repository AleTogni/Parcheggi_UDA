import { supabase } from './supabaseClient';

export const getUserProfile = async (authId) => {
  const { data, error } = await supabase
    .from('persone')
    .select('*')
    .eq('supabase_uuid', authId)
    .single();
  
  if (error) console.error("Errore profilo:", error);
  return data;
};