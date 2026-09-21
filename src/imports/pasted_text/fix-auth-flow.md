Fix the existing authentication system in this project.

### Current Problem

The app already has **Supabase connected**. Users can successfully create/sign up for an account, and the UI confirms that the account was created. However, when the same user tries to log in using the credentials they just registered, the login fails with:

> "Invalid email or password"

The login system is therefore not correctly recognizing valid registered Supabase users.

### Task

**Inspect, debug, and fix the existing authentication and login implementation. Do NOT replace the existing Supabase project or create a mock authentication system. Use the Supabase connection that is already configured in the project.**

### Check the Entire Authentication Flow

1. **Inspect Supabase configuration**

   * Verify the existing Supabase URL and anon/publishable key are being used correctly.
   * Make sure the Supabase client is initialized only once and imported consistently throughout the application.
   * Do not hardcode credentials or create a second Supabase client unnecessarily.

2. **Inspect Sign-Up**

   * Verify that the sign-up form calls the correct Supabase Auth method:
     `supabase.auth.signUp()`
   * Confirm that the email and password submitted during registration are actually passed correctly.
   * Check whether email confirmation is enabled in Supabase.
   * If email confirmation is required, handle the `user` / `session` response correctly and show an appropriate message instead of incorrectly treating the account as immediately logged in.
   * Make sure the sign-up success message is only displayed when Supabase actually creates the account successfully.
   * Handle duplicate emails and other Supabase errors properly.

3. **Inspect Login**

   * Verify that login uses:
     `supabase.auth.signInWithPassword()`
   * Ensure the exact email and password entered by the user are passed to Supabase.
   * Check for accidental `.trim()`, lowercasing, transformations, incorrect field names, stale state, or other logic that could alter the credentials.
   * Make sure the login function is not checking a separate users table instead of Supabase Auth.
   * Do not manually compare passwords in the frontend.
   * Do not use fake/mock credentials.
   * Do not store or retrieve passwords from the database.

4. **Check User Profile / Database Logic**

   * If the application has a `profiles`, `users`, or similar table, make sure this table is not being incorrectly used as the authentication source.
   * Supabase Auth (`auth.users`) should be responsible for authentication.
   * If a profile record is required after signup, make sure profile creation does not interfere with login.
   * Check foreign keys, triggers, RLS policies, and signup-related database logic for errors.

5. **Check Authentication State**

   * Verify that the application correctly handles:
     `supabase.auth.getSession()`
     `supabase.auth.onAuthStateChange()`
   * Make sure a successful login creates and persists the Supabase session.
   * Prevent the app from immediately clearing or overwriting a valid session.
   * Make sure protected routes/pages recognize the authenticated user.

6. **Inspect Error Handling**

   * Do not blindly display "Invalid email or password" for every possible error.
   * Display the actual useful Supabase error when appropriate during development.
   * Distinguish between:

     * Invalid credentials
     * Email not confirmed
     * User does not exist
     * Duplicate signup
     * Network/Supabase connection error
     * Database/profile creation error
   * Log useful errors to the console during debugging, but never log passwords.

### Important

Do NOT:

* Create a new authentication system.
* Create a fake login system.
* Hardcode a test email/password.
* Bypass authentication.
* Store passwords manually.
* Replace the existing Supabase project.
* Remove existing functionality just to make the login appear to work.
* Only modify the UI/error message.

### Expected Working Flow

**Sign Up**

1. User enters email + password.
2. App calls Supabase Auth signup.
3. Supabase creates the account.
4. App handles email confirmation requirements correctly.
5. User receives an accurate success/confirmation message.

**Login**

1. User enters the same registered email + password.
2. App calls `supabase.auth.signInWithPassword()`.
3. Supabase validates the credentials.
4. Successful authentication creates a session.
5. App recognizes the authenticated user.
6. User is redirected to/accesses the authenticated area.
7. Refreshing the page should preserve the session.

### Debugging Requirement

Before changing code, inspect the existing authentication implementation and identify the actual cause of the problem.

After fixing it, verify the complete flow end-to-end:

**Sign Up → Supabase Auth User Created → Login → Supabase Session Created → Auth State Updated → Protected Page Accessible**

If the issue is caused by Supabase email confirmation settings, RLS, profile creation, incorrect Supabase client configuration, or incorrect authentication API usage, fix the application code/configuration appropriately rather than working around the problem.

Keep the existing UI/design unless a UI change is necessary to correctly communicate authentication states and errors.
