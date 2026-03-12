-- Fix the "no unique constraint matching ON CONFLICT" error
ALTER TABLE public.kyc ADD CONSTRAINT kyc_user_id_key UNIQUE (user_id);

-- Remember to go to Settings -> API -> "Reload Schema Cache" after running this!
