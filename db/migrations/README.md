# Migrations

- Numbered pairs: `0001_name.up.sql` and `0001_name.down.sql`. Numbers are contiguous from 0001.
- Every migration must be reversible. The down file undoes exactly what the up file did.
- **No migration is written until its schema is APPROVED in `docs/DECISIONS.md`.**
- Run with `pnpm db:migrate up | down [steps] | status`. Requires `DATABASE_URL` and
  `LISTAPPS_DB_TARGET=local` or `development`. Production is refused by design.
- Bookkeeping lives in the `listapps_meta` schema, never in `public`.
