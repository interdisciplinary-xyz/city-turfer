import * as migration_20261022_145351_staff from './20261022_145351_staff';

export const migrations = [
  {
    up: migration_20261022_145351_staff.up,
    down: migration_20261022_145351_staff.down,
    name: '20261022_145351_staff',
  },
];
