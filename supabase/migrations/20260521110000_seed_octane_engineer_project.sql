-- Seed Octane Engineer as a connected project for internal typecheck / dispatch queue.
insert into public.connected_projects (name)
values ('octane_engineer')
on conflict (name) do nothing;
