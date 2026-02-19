-- Function to sync question counts
CREATE OR REPLACE FUNCTION public.sync_spaced_repetition_question_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.spaced_repetition_sets
        SET total_questions = (
            SELECT count(*)
            FROM public.spaced_repetition_questions
            WHERE set_id = NEW.set_id
        ),
        updated_at = now()
        WHERE id = NEW.set_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.spaced_repetition_sets
        SET total_questions = (
            SELECT count(*)
            FROM public.spaced_repetition_questions
            WHERE set_id = OLD.set_id
        ),
        updated_at = now()
        WHERE id = OLD.set_id;
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Handle case where a question is moved to a different set
        IF (OLD.set_id <> NEW.set_id) THEN
            UPDATE public.spaced_repetition_sets
            SET total_questions = (
                SELECT count(*)
                FROM public.spaced_repetition_questions
                WHERE set_id = OLD.set_id
            ),
            updated_at = now()
            WHERE id = OLD.set_id;
            
            UPDATE public.spaced_repetition_sets
            SET total_questions = (
                SELECT count(*)
                FROM public.spaced_repetition_questions
                WHERE set_id = NEW.set_id
            ),
            updated_at = now()
            WHERE id = NEW.set_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for syncing counts
DROP TRIGGER IF EXISTS tr_sync_spaced_repetition_question_count ON public.spaced_repetition_questions;
CREATE TRIGGER tr_sync_spaced_repetition_question_count
AFTER INSERT OR DELETE OR UPDATE OF set_id ON public.spaced_repetition_questions
FOR EACH ROW EXECUTE FUNCTION public.sync_spaced_repetition_question_count();

-- One-time update to fix existing counts
UPDATE public.spaced_repetition_sets s
SET total_questions = (
    SELECT count(*)
    FROM public.spaced_repetition_questions q
    WHERE q.set_id = s.id
);
