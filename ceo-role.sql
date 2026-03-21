-- Ajouter la colonne role dans profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'vendor';

-- Te donner le rôle admin (remplace par ton vrai user_id depuis Supabase)
-- Va dans Supabase → Table Editor → profiles → trouve ton compte → modifie role = 'admin'
-- OU exécute cette requête avec ton email :
UPDATE public.profiles 
  SET role = 'admin' 
  WHERE email = 'kessahoud@gmail.com';

-- Vérifier
SELECT id, email, role FROM public.profiles WHERE role = 'admin';
