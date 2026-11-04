-- Starting data. scripts/migrate.mjs runs this once, then records settings.seeded.

insert into settings (key, value) values
  ('water_goal', '8'),
  ('apps_per_week', '5')
on conflict (key) do nothing;

insert into habits (slug, label, note, category, sort) values
  ('workout',   'Work out',              'Any session counts. Logging a workout checks this off.', 'health', 1),
  ('practice',  'Data science practice', '30 min of SQL, Python or a portfolio project',           'career', 2),
  ('jobsearch', 'Job search block',      'Apply, tailor your resume or reach out to someone',      'career', 3)
on conflict (slug) do nothing;

insert into goals (title, category, metric, target_change, unit, start_date, due_date) values
  ('Lose 20 lb', 'personal', 'weight', -20, 'lb', '2026-11-03', '2027-01-03');

insert into goals (title, category, metric, start_date, due_date) values
  ('Land a data science job', 'career', 'job', '2026-11-03', '2027-01-31');

insert into settings (key, value) values ('seeded', 'true')
on conflict (key) do nothing;
