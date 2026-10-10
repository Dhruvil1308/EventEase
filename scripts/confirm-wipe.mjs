/**
 * Runs before `npm run db:reset`, which drops every table before re-seeding.
 * It only continues when the wipe is asked for explicitly:
 *
 *   SEED_WIPE=yes npm run db:reset
 */
if (process.env.SEED_WIPE !== "yes") {
  console.error(
    "\n✋ db:reset deletes the whole database that DATABASE_URL points at — every account, event and ticket.\n" +
      "   If you really mean to wipe it, run:  SEED_WIPE=yes npm run db:reset\n",
  );
  process.exit(1);
}
