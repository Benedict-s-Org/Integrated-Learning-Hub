/*
  # Update Authentication System to Username-Based

  1. Changes to Tables
    - Drop existing `user_profiles` table and trigger
    - Create new `users` table with username-based authentication
      - `id` (uuid, primary key)
      - `username` (text, unique, not null) - User's login username
      - `password_hash` (text, not null) - Hashed password
      - `role` (text, not null) - User role (admin/user)
      - `force_password_change` (boolean, default false) - Forces password change on next login
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
    - Create `system_config` table for storing verification code securely
      - `key` (text, primary key) - Config key
      - `value` (text, not null) - Config value (encrypted)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on both tables
    - Users can only read their own user data
    - Users can update their own password
    - Admins can read all users
    - Admins can create and update users
    - Only admins can access system_config (for verification code checks)
    - System verification code is stored securely and never exposed in queries

  3. Initial Data
    - Create initial admin user with username "admin" and password "64165644"
    - Set force_password_change to true for initial admin
    - Store system verification code "949182" in system_config

  4. Notes
    - This is a custom authentication system (not using Supabase Auth)
    - Passwords will be hashed using pgcrypto extension
    - Verification code is used for sensitive operations like password resets
*/

-- Drop existing auth trigger and table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP TABLE IF EXISTS user_profiles;

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  force_password_change boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create system_config table for verification code
CREATE TABLE IF NOT EXISTS system_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  USING (id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can update own password"
  ON users
  FOR UPDATE
  USING (id = (current_setting('app.current_user_id', true))::uuid)
  WITH CHECK (id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (current_setting('app.current_user_id', true))::uuid
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert users"
  ON users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (current_setting('app.current_user_id', true))::uuid
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all users"
  ON users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (current_setting('app.current_user_id', true))::uuid
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (current_setting('app.current_user_id', true))::uuid
      AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete users"
  ON users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (current_setting('app.current_user_id', true))::uuid
      AND u.role = 'admin'
    )
  );

-- RLS Policies for system_config - only accessible by admins
CREATE POLICY "Admins can read system config"
  ON system_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (current_setting('app.current_user_id', true))::uuid
      AND u.role = 'admin'
    )
  );

-- Insert initial admin user (password: 64165644)
INSERT INTO users (username, password_hash, role, force_password_change)
VALUES (
  'admin',
  crypt('64165644', gen_salt('bf')),
  'admin',
  true
)
ON CONFLICT (username) DO NOTHING;

-- Insert system verification code (code: 949182)
INSERT INTO system_config (key, value)
VALUES (
  'verification_code',
  crypt('949182', gen_salt('bf'))
)
ON CONFLICT (key) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();