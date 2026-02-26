-- Fix Foreign Keys for bulk-created users
-- The bulk create tool inserts directly into public.users, bypassing auth.users.
-- We must update critical tables to reference public.users instead of auth.users
-- to prevent foreign key errors when awarding coins or recording history.

DO $$ 
BEGIN
    -- user_room_data
    ALTER TABLE public.user_room_data DROP CONSTRAINT IF EXISTS user_room_data_user_id_fkey;
    ALTER TABLE public.user_room_data ADD CONSTRAINT user_room_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

    -- student_records
    ALTER TABLE public.student_records DROP CONSTRAINT IF EXISTS student_records_student_id_fkey;
    ALTER TABLE public.student_records ADD CONSTRAINT student_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;

    ALTER TABLE public.student_records DROP CONSTRAINT IF EXISTS student_records_created_by_fkey;
    ALTER TABLE public.student_records ADD CONSTRAINT student_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

    -- coin_transactions
    ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_user_id_fkey;
    ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

    ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_created_by_fkey;
    ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
    
    -- notification_templates
    ALTER TABLE public.notification_templates DROP CONSTRAINT IF EXISTS notification_templates_created_by_fkey;
    ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
    
    -- shared_links
    ALTER TABLE public.shared_links DROP CONSTRAINT IF EXISTS shared_links_created_by_fkey;
    ALTER TABLE public.shared_links ADD CONSTRAINT shared_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;
END $$;
