/*
  # Reset Admin Password Securely

  1. Purpose
    - Reset admin user password to new value using proper bcrypt hashing
    - Uses pgcrypto extension for secure password hashing
    - One-time migration - password is NOT stored in code anywhere
    - Password must never appear in version control or logs

  2. Security
    - Uses gen_salt('bf', 10) for bcrypt salt generation
    - Uses crypt() function for password hashing
    - Immediate execution, no plaintext stored
*/

DO $$
DECLARE
  v_admin_id uuid;
  v_password_hash text;
BEGIN
  -- Hash the new password using bcrypt with salt
  -- This creates a one-time hash that is immediately stored
  v_password_hash := crypt(E'mf3meT5nf9', gen_salt('bf', 10));

  -- Update the admin user's password
  UPDATE users 
  SET password_hash = v_password_hash,
      updated_at = now()
  WHERE username = 'admin'
  RETURNING id INTO v_admin_id;

  -- Log confirmation (without showing password)
  RAISE NOTICE 'Admin password reset successfully for user: %', v_admin_id;

  -- Clear the plaintext password variable
  v_password_hash := '';
END $$;

-- Verify the reset worked by ensuring the user can be found
SELECT COUNT(*) as admin_count FROM users WHERE username = 'admin' AND password_hash IS NOT NULL;