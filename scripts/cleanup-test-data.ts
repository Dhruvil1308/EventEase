/**
 * Removes everything the `@e2e.test` accounts made — auth users, profiles,
 * their events, registrations, gate logs, call records and uploaded files.
 * It is the cleanup that runs after `npm run test:e2e`; run it yourself after a
 * manual UAT session in which you signed up with `@e2e.test` emails.
 *
 *   npm run test:cleanup
 *
 * Only `@e2e.test` accounts are touched, so real users and demo data are safe.
 */
import teardown from "../tests/e2e/global-teardown";

teardown().catch((error) => {
  console.error(error);
  process.exit(1);
});
