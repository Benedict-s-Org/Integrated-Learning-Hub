-- Add student_id and marker_id to public.users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS student_id VARCHAR(8) UNIQUE,
ADD COLUMN IF NOT EXISTS marker_id INTEGER UNIQUE CHECK (marker_id >= 0 AND marker_id <= 999);

-- Backfill existing users
DO $$
DECLARE
    r RECORD;
    next_student_id BIGINT := 1;
    next_marker_id INTEGER := 0;
    extracted_id VARCHAR;
BEGIN
    FOR r IN SELECT id, username FROM public.users ORDER BY created_at ASC LOOP
        extracted_id := NULL;
        IF r.username LIKE 's________@superleekam.edu.hk' THEN
            extracted_id := SUBSTRING(r.username FROM 2 FOR 8);
            IF NOT (extracted_id ~ '^[0-9]{8}$') THEN
                extracted_id := NULL;
            END IF;
        END IF;
        
        IF extracted_id IS NULL THEN
            extracted_id := LPAD(next_student_id::TEXT, 8, '0');
            next_student_id := next_student_id + 1;
        END IF;
        
        UPDATE public.users 
        SET student_id = extracted_id, marker_id = next_marker_id
        WHERE id = r.id;
        
        next_marker_id := next_marker_id + 1;
    END LOOP;
END $$;

-- Make columns NOT NULL if possible, but marker_id might fail if > 1000 users exist.
-- Assuming less than 1000 users now.
-- We won't strictly enforce NOT NULL yet just in case of edge cases during signup flows.

-- Create trigger function for new users
CREATE OR REPLACE FUNCTION generate_student_and_marker_id()
RETURNS TRIGGER AS $$
DECLARE
    next_student_id BIGINT;
    next_marker_id INTEGER;
    extracted_id VARCHAR;
BEGIN
    -- Only assign if not provided
    IF NEW.student_id IS NULL THEN
        IF NEW.username LIKE 's________@superleekam.edu.hk' THEN
            extracted_id := SUBSTRING(NEW.username FROM 2 FOR 8);
            IF extracted_id ~ '^[0-9]{8}$' THEN
                NEW.student_id := extracted_id;
            END IF;
        END IF;

        IF NEW.student_id IS NULL THEN
            -- Find max numeric student_id (excluding the superleekam ones which start with year likely e.g. 2023, might clash, but we'll try to find the max of pure increments)
            -- Actually, to avoid clash with true 20230001, we just take max of everything
            SELECT COALESCE(MAX(NULLIF(regexp_replace(student_id, '[^0-9]', '', 'g'), '')), '0')::BIGINT
            INTO next_student_id
            FROM public.users;
            
            IF next_student_id < 1 THEN
                next_student_id := 1;
            ELSE
                next_student_id := next_student_id + 1;
            END IF;
            
            NEW.student_id := LPAD(next_student_id::TEXT, 8, '0');
        END IF;
    END IF;

    IF NEW.marker_id IS NULL THEN
        SELECT COALESCE(MAX(marker_id), -1) + 1
        INTO next_marker_id
        FROM public.users;
        
        IF next_marker_id <= 999 THEN
            NEW.marker_id := next_marker_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS assign_student_and_marker_id ON public.users;
CREATE TRIGGER assign_student_and_marker_id
    BEFORE INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION generate_student_and_marker_id();
