# Royal HigherLife administrator setup

## Initial Super Admin

From the backend project directory, run this once in an interactive terminal:

```powershell
npm run admin:create-initial
```

The command uses the existing `MONGO_URI`, refuses to run without `JWT_SECRET`, checks that no Super Admin already exists, and prompts for the account details. Password entry is hidden, passwords must match and be at least 12 characters, and the password is stored only as a bcrypt hash. It never runs as part of server startup. It does not promote or edit an existing account.

Use the production database only when you intend to create the first production Super Admin and have an approved backup available. For development, configure the existing development database URI first. The command does not change a database name.

## Direct account creation and sign-in

An authenticated Super Admin creates accounts from **Admin → Administrator Access** or the protected `/admin/register` and `/register/admin` routes. The form asks for a name, email, password, confirmation and role. The backend enforces the Super Admin permission, accepts only Super Admin, Content Admin or Media Admin as the assigned role, validates a strong password, hashes it with bcrypt and records an audit event. The account remains inactive until the existing email verification flow verifies its address; the existing Gmail SMTP sends that verification message. No invitation token or invitation email is used. The Super Admin can edit account names and email addresses, change permitted roles, suspend or reactivate accounts, revoke administrator access, and review the audit log. Changing an administrator's email requires email verification again. After verification, the administrator can sign in at `/login/admin` or `/admin/login`.

The initial Super Admin command above is the only out-of-band setup. It never runs at server startup and refuses to create another Super Admin if one already exists. Regular public registration and email verification continue to work independently. The default administrator JWT lifetime is eight hours (`JWT_ADMIN_EXPIRES_IN` can override it). Logout, password changes, suspension, role changes, and revocation invalidate prior tokens through `tokenVersion`.

Configure the existing SMTP settings (`EMAIL_PROVIDER=gmail-smtp`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`) and `FRONTEND_URL` in the hosting environment. Do not commit `.env` files or put secrets in the frontend.
