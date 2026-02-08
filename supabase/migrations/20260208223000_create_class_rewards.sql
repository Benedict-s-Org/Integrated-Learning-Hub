create table if not exists public.class_rewards (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  coins integer not null, -- Positive for rewards, negative for consequences
  type text not null check (type in ('reward', 'consequence')),
  icon text not null, -- Lucide icon name
  color text, -- Tailwind color class
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.class_rewards enable row level security;

-- Policies
create policy "Public read access"
  on public.class_rewards for select
  to authenticated
  using (true);

create policy "Admin full access"
  on public.class_rewards for all
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Insert default data
insert into public.class_rewards (title, coins, type, icon, color) values
  ('Helping Others', 1, 'reward', 'Heart', 'text-pink-500 bg-pink-100'),
  ('On Task', 1, 'reward', 'Star', 'text-yellow-500 bg-yellow-100'),
  ('Participating', 1, 'reward', 'Zap', 'text-purple-500 bg-purple-100'),
  ('Teamwork', 2, 'reward', 'Users', 'text-blue-500 bg-blue-100'),
  ('Working Hard', 2, 'reward', 'Trophy', 'text-orange-500 bg-orange-100'),
  ('Homework', 5, 'reward', 'BookOpen', 'text-green-500 bg-green-100'),
  ('Distrupting', -1, 'consequence', 'AlertCircle', 'text-red-500 bg-red-100'),
  ('Late to Class', -1, 'consequence', 'Clock', 'text-orange-500 bg-orange-100'),
  ('No Homework', -2, 'consequence', 'XCircle', 'text-gray-500 bg-gray-100');
