Connect the existing KezSpeak application to the new Supabase project and replace the current fake/demo authentication with real Supabase authentication.

IMPORTANT:

* Do not redesign the existing KezSpeak UI.
* Keep the current KezSpeak landing page, login page, and dashboards.
* Only modify authentication, session handling, routing, and user data.
* Do not use fake authentication or hardcoded login credentials.
* Do not automatically send users to a dashboard when clicking Login.

## SUPABASE

Use the Supabase project connected to this application.

Use:

* Supabase Project URL
* Supabase publishable/anon key

Never use or expose the Supabase service-role key in frontend code.

Store credentials using environment variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

If this project uses a different environment-variable convention, follow the existing project structure.

---

# 1. SUPABASE CLIENT

Create a single reusable Supabase client.

Example:

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

Do not create multiple Supabase clients throughout the application.

---

# 2. LOGIN

Connect the existing KezSpeak login form to:

```ts
supabase.auth.signInWithPassword()
```

Login fields:

* Email
* Password

When the user clicks:

**Log In**

perform:

1. Validate email.
2. Validate password.
3. Show loading state.
4. Authenticate using Supabase.
5. If authentication fails, display an error.
6. If authentication succeeds, retrieve the user's profile.
7. Read the user's role.
8. Redirect to the correct dashboard.

Do NOT redirect before authentication succeeds.

---

# 3. ROLE-BASED REDIRECTION

Retrieve:

```text
public.profiles.role
```

Possible roles:

```text
student
tutor
admin
```

Redirect:

```text
student → /student
tutor → /tutor
admin → /admin
```

Example:

```text
Jamie
   ↓
Login
   ↓
Supabase Auth
   ↓
profiles
   ↓
role = student
   ↓
/student
```

---

# 4. AUTHENTICATION STATE

Create a global authentication state/provider.

The application should detect:

* Loading
* Authenticated
* Unauthenticated

Use Supabase session handling.

Listen for authentication changes using:

```ts
supabase.auth.onAuthStateChange()
```

The user's session should remain active when refreshing the page.

---

# 5. PROTECTED ROUTES

Protect:

```text
/student/*
/tutor/*
/admin/*
```

If a user is not authenticated:

```text
/student → /login
/tutor → /login
/admin → /login
```

Do not briefly display the dashboard before redirecting.

Show a loading screen while checking the authentication session.

Use a friendly KezSpeak loading state:

**“Loading your speaking journey...”**

---

# 6. ROLE PROTECTION

Users must only access their assigned dashboard.

For example:

A student attempting to visit:

```text
/admin
```

must NOT see the admin dashboard.

Redirect them to:

```text
/student
```

Similarly:

Tutor → cannot access Admin

Student → cannot access Tutor

Admin → can access administrative functionality

---

# 7. GET STARTED BUTTON

Fix the existing landing-page buttons.

When the user clicks:

**Get Started**

go to:

```text
/login
```

Do NOT go directly to `/student`.

When the user clicks:

**Log In**

go to:

```text
/login
```

Do NOT automatically authenticate the user.

---

# 8. SIGN UP

If the existing application has a registration page, connect it to:

```ts
supabase.auth.signUp()
```

Fields:

* Full Name
* Email
* Password
* Confirm Password

New users should receive the default role:

```text
student
```

Do not allow users to select:

```text
admin
```

or

```text
tutor
```

during public registration.

The database trigger should create the corresponding `profiles` record.

---

# 9. PROFILE DATA

After login, retrieve the user's profile:

```text
profiles
```

using the authenticated user's ID.

Display the profile information throughout the application.

For example:

```text
full_name
email
role
avatar_url
```

The dashboard greeting should use the actual user's name.

Instead of:

**Good morning, Jamie!**

use:

**Good morning, {profile.full_name}!**

---

# 10. LOGOUT

Connect the existing Log Out button to:

```ts
supabase.auth.signOut()
```

After logout:

```text
→ clear session
→ redirect to /login
```

The user should not be able to return to the dashboard using the browser Back button without logging in again.

---

# 11. LOGIN ERROR STATES

Implement polished error handling.

Invalid credentials:

**“Incorrect email or password.”**

Missing email:

**“Please enter your email address.”**

Invalid email:

**“Please enter a valid email address.”**

Missing password:

**“Please enter your password.”**

Network/database error:

**“We couldn't connect to KezSpeak. Please try again.”**

Do not expose raw Supabase/database errors to users.

---

# 12. LOGIN LOADING STATE

When logging in:

Disable the submit button.

Change:

**Log In**

to:

**Logging in...**

Prevent multiple login requests.

---

# 13. AUTHENTICATED USER EXPERIENCE

When the user opens KezSpeak:

### If not logged in:

Show the public landing page.

### If logged in:

Keep the user authenticated.

If they visit `/login` while already authenticated, redirect them to their appropriate dashboard based on their role.

Example:

```text
Already logged in as student
→ /login
→ /student
```

---

# 14. REMOVE FAKE AUTHENTICATION

Search the existing code for:

* hardcoded users
* fake login functions
* demo authentication
* localStorage-based authentication
* automatic dashboard redirects
* hardcoded roles
* mock session objects

Remove or replace these with the Supabase authentication system.

Do not break the existing UI.

---

# 15. DATABASE PROFILE LOOKUP

After successful authentication:

```ts
const { data: { user } } = await supabase.auth.getUser()
```

Then retrieve:

```text
profiles
```

where:

```text
id = user.id
```

Use the returned role for routing.

If the authenticated user has no profile:

Show:

**“Your KezSpeak profile could not be found. Please contact an administrator.”**

Do not silently create an incorrect profile from the frontend.

---

# 16. DEBUGGING

Add appropriate console logging during development for:

* authentication success/failure
* authenticated user ID
* profile lookup result
* detected role
* redirect destination

Do not log passwords, access tokens, or sensitive authentication information.

---

# FINAL EXPECTED FLOW

The application must now behave like this:

```text
KEZSPEAK LANDING PAGE
        │
        ├── Get Started
        │       ↓
        │     LOGIN
        │
        └── Log In
                ↓
        SUPABASE AUTH
                ↓
          AUTHENTICATED?
           /          \
         NO            YES
         ↓              ↓
      ERROR       GET PROFILE
                       ↓
                   CHECK ROLE
                 /      |      \
                ↓       ↓       ↓
            STUDENT   TUTOR    ADMIN
                ↓       ↓       ↓
          /student   /tutor   /admin
```

The login system should now be fully connected to Supabase while preserving the existing KezSpeak visual design.
