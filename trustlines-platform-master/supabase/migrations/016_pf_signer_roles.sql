-- Migration 016: PF signer roles
-- Four roles for the Production Form signature chain. Roles in this DB are managed
-- via the role_definitions table (profiles.role is text), so we only register them
-- there — they then appear as assignable roles in the Team UI.

DO $$ BEGIN
  IF to_regclass('public.role_definitions') IS NOT NULL THEN
    INSERT INTO role_definitions (name, label, description, color_bg, color_fg, is_system, permissions)
    SELECT v.name, v.label, v.description, v.bg, v.fg, true, '{}'::jsonb
    FROM (VALUES
      ('production_manager', 'Production Manager', 'PF signature — Production Manager', '#fef3c7', '#b45309'),
      ('project_manager',    'Project Manager',    'PF signature — Project Manager',    '#dbeafe', '#1d4ed8'),
      ('general_manager',    'General Manager',    'PF signature — General Manager',    '#ede9fe', '#7c3aed'),
      ('accountant',         'Accountant',         'PF signature — Accountant',         '#dcfce7', '#15803d')
    ) AS v(name, label, description, bg, fg)
    WHERE NOT EXISTS (SELECT 1 FROM role_definitions r WHERE r.name = v.name);
  END IF;
END $$;
      