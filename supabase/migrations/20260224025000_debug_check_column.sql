-- Migration: Check Spelling Levels Column
-- Description: Creates an RPC to check if the column exists.

CREATE OR REPLACE FUNCTION debug_check_column_exists(tbl_name text, col_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = tbl_name 
    AND column_name = col_name
    AND table_schema = 'public'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
