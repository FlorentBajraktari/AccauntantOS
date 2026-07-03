# Production Checklist

## Environment

- Set `APP_ENV=production`.
- Set a unique `DEFAULT_TENANT_ID` for the deployed environment.
- Set `JWT_SECRET` to a strong 32+ byte secret.
- Set `ADMIN_PASSWORD` to a strong password manager-generated secret.
- Set `CORS_ORIGINS` to the exact frontend origins.
- Disable self-registration unless explicitly needed.
- Disable demo-data seeding.
- Disable admin-password reset on startup.

## Infrastructure

- Put the FastAPI app behind HTTPS termination.
- Run MongoDB with authentication enabled and network restrictions.
- Store secrets outside Git and outside the app directory.
- Restrict inbound access to backend and database ports.
- Use separate production and staging databases.

## Application Controls

- Create staff users through admin invitations only.
- Assign client users only to the companies they should access.
- Verify `/api/health/live` and `/api/health/ready` in the deployment environment.
- Review recent admin audit activity after onboarding or role changes.

## Monitoring

- Probe `/api/health/live` every 30-60 seconds.
- Probe `/api/health/ready` every 1-5 minutes.
- Alert on repeated non-200 responses, high latency, or MongoDB connection failures.
- Capture backend logs and retain audit logs according to policy.

## Backups

- Schedule `backup-mongodb.ps1` at least daily.
- Store backups off-host.
- Encrypt backup storage.
- Test restore procedures regularly.
- Keep a retention policy for daily, weekly, and monthly backups.

## Go-Live Verification

- Confirm admin login works with production credentials.
- Confirm invitation onboarding works for a non-admin user.
- Confirm password reset works end to end.
- Confirm client users cannot access staff-only pages or other companies.
- Confirm exports, uploads, and reports work against production data.