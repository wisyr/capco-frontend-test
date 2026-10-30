# Submission notes

These notes explain what was built for the three tickets, the main decisions behind it, and how to check it. The tickets are in [`tickets/`](tickets/); setup is in the [README](README.md).

## What was delivered

| Ticket                                                                            | Result                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [TICKET-001](tickets/TICKET-001-frontend-registration.md) Registration            | Form with email, password and confirmation. Client-side rules match the API password policy. Accessible errors for invalid input, duplicate email, rate limiting, network failure and unexpected responses. The success screen links to sign-in without signing the applicant in.                                                                                                               |
| [TICKET-002](tickets/TICKET-002-frontend-login.md) Login                          | Required-field checks. One form-level error for wrong credentials that never reveals whether an email is registered. The email stays filled in after an error. Pending state blocks a second submit and is announced. On success the applicant goes to the journey URL returned by the API, after checking it is safe.                                                                          |
| [TICKET-003](tickets/TICKET-003-frontend-save-and-resume-form.md) Save and resume | Loads the saved draft into both steps, including the consent checkbox and whether a document is already on file. Save confirms only after the API does. Answers survive signing out and back in because they are always read from the API. Failed saves keep what was typed, and the applicant can retry. Expired sessions, validation errors and version conflicts each get their own message. |

Beyond the tickets:

- **Sign out.** Needed to show "log out, then log in again" from TICKET-003 in the app itself.
- **Identity document upload.** The step already asked for the document, so saving now uploads it.
- **Unsaved-changes guard.** Leaving a step or signing out with unsaved answers asks first.
- **Date format hints.** The date fields now say which format to use.
- **ConfirmDialog.** A new design-system component, used by the unsaved-changes guard.

## Architecture

The work follows the existing layout: route modules handle behaviour, presentation components render, and shared UI comes from `@kyc/ui` (`DS/`).

- **`frontend/src/api/`** is the only place that talks HTTP.
  - `json-api-client.ts` sends JSON:API requests. It sets the media type and adds the `X-XSRF-TOKEN` header from the `XSRF-TOKEN` cookie on state-changing requests.
  - Every response is checked against a Zod schema. Errors become typed classes: `ApiError`, `NetworkError` and `UnexpectedResponseError`.
  - Each resource (`applicant-accounts`, `applicant-sessions`, `applicant-applications`) has its own module with request functions and TanStack Query options.
- **`query-client.ts`** retries only failures that might be temporary: network errors and 5xx. A 401 or a contract violation fails straight away, so an expired session redirects without delay.
- **Folder structure.** Pages and logic are kept apart. Tests and styles sit next to the code they cover.
  - `routes/` holds only the page modules listed in `routes.ts` (for example `applications/layout.tsx` and `applications/step.tsx`), plus the tests that drive them through the router.
  - `features/<area>/` holds each area's components and logic: `account-access` (registration and sign-in), `applicant-journey` (session handling, the unsaved-changes guard, page states) and `application-form` (steps, validation, document evidence, review).
  - `shared/` holds small pieces used across features: field errors, the pending-status region and the email pattern.
  - Features never import from `routes/`, so dependencies only point one way. The starter code's `-` prefix for non-route files is no longer needed.
- **Server state lives in TanStack Query.** Only the answers being edited are local component state.

## Key decisions

- **The API is the source of truth for saved answers.** Nothing is kept in browser storage. Resuming always reloads the form from the API.
- **Optimistic concurrency.**
  - Each save sends the `version` the edited answers started from.
  - A background refetch never advances that version. Otherwise a save could silently overwrite changes made in another tab.
  - A `409 form-version-conflict` explains what happened and offers to reload the saved answers.
- **Data-first rendering.** Once a step has loaded, a failed background refetch never replaces the form with an error or a redirect, so typed answers can't vanish. If the session has expired, the next Save reports it.
- **Session expiry.** A 401 while loading sends the applicant to sign-in, with a safe `returnTo` and a "your session has ended" notice. A 401 while saving keeps the answers on screen and links to sign in again.
- **Safe redirects.** `returnTo` and the journey URL from the API are accepted only if they resolve inside `/applications/`. Dot segments are resolved first, so `/applications/../evil` is rejected.
- **Sign-out clears cached data only after the journey unmounts.** Clearing it earlier made the open page refetch without a session.
- **Credentials are not kept.** The password is cleared after a failed sign-in, and the mutation cache is cleared on success.
- **Document upload runs after the answers are saved.** If the upload fails, the message says the answers were saved but the document was not, and saving again retries with the new version.
- **Date fields stay text inputs.** `type="date"` would show an empty field for any saved value that isn't an ISO date, and the API accepts any string. A format hint meets WCAG 3.3.2 without that risk.
- **Step validation (optional in TICKET-003, added).** Errors appear beside each field, focus moves to the first one, and nothing is sent to the API until the step is valid. An error clears as soon as its field is fixed.
  - **Continue / Save and review** needs a complete step: every answer, the consent and the document.
  - **Save** accepts a half-finished step, which is the point of save and resume. Anything filled in must still be valid, though, so an invalid email can't be saved. With no changes it says so instead of calling the API.
  - **Formats:** email as `name@example.com`, and dates as real `YYYY-MM-DD` dates. Date of birth must be in the past and expiry today or later. Phone and the other text answers only need to be filled in.
  - The design-system `Form` uses React Aria's `validationBehavior="aria"`, which turns off the browser's own required-field check. Validation therefore runs in code, as it does on registration and sign-in.
- **The unsaved-changes guard lives in the journey layout.** The step reports whether its answers differ from what the API last confirmed. The layout asks before in-app navigation (`useBlocker`) and before ending the session on Sign out. Closing the tab gets the browser's own prompt.

## Accessibility (WCAG 2.2 AA)

- Every input has a visible label marked "(required)". Fields carry `autocomplete` purposes (1.3.5). Hints and errors are linked with `aria-describedby`.
- On a failed submit, errors appear next to their fields and focus moves to the first invalid one. Form-level problems use an alert.
- Pending and success messages are announced through `role="status"` regions that stay mounted, so screen readers pick up changes. This works whether the form was submitted with a click or with Enter.
- Each page sets a descriptive `<title>`, and each step's title includes its position, such as "Step 1 of 2".
- `ConfirmDialog` is an alert dialog named by its heading. It traps focus, starts on the safe action, closes with Escape, and returns focus when it closes.
- The Sign out button on the blue header uses a high-contrast style with a visible focus outline.
- jest-axe runs in the component tests, but jsdom cannot check colour contrast. A Playwright scan with `@axe-core/playwright` (`frontend/e2e/accessibility.spec.ts`) therefore checks the real pages in Chromium against WCAG 2.2 A and AA, contrast included. It covers sign-in, registration, the journey page, both steps, the review page, their error states and the leave dialog. React Aria's hidden live region is excluded, because a pending button's announcement there is left unnamed once the button is gone. Layouts were checked at 375px wide.

## Verification

From the repository root:

```sh
npm run quality                  # lint, typecheck, dependency rules, DS tests, DS build
npm run format:check             # Prettier, including JSON, CSS and Markdown
npm run typecheck -w frontend
npm test -w frontend             # unit and component tests (Vitest, MSW, jest-axe)
npx playwright install chromium  # once
npm run test:e2e -w frontend     # Playwright against the real backend
```

- **Component tests** render routes through React Router's `createRoutesStub` and use MSW to answer requests in the shapes defined by the OpenAPI contract.
- **Regression tests** for bugs found in review were each checked to fail without their fix.
- **End-to-end tests** start their own backend (port 18080) and frontend (port 13000) on a separate database. They cover:
  - registration
  - login
  - saving, signing out and resuming
  - the expired-session message
  - the unsaved-changes guard
  - step validation, and the header link back to the journey

### Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request to `main` and `develop`. It has three parallel jobs:

- **Lint, format and types:** ESLint, the Prettier check, design-system dependency rules, and TypeScript for the design system and the frontend.
- **Unit tests and build:** design-system and frontend tests, then both production builds.
- **End-to-end tests:** sets up Node 26 and Temurin JDK 25, compiles the backend first so its cold start fits the runner's two-minute wait, and runs the Playwright suite against it. On failure, the HTML report and traces are uploaded as an artifact. Failures are also annotated on the pull request.

A newer push to the same branch cancels the older run, and the workflow only has read access to the repository.

## Process

- **Git.**
  - Each ticket was built on its own `feature/TICKET-00X-…` branch from `develop` and merged with `--no-ff`, so each ticket stays visible in the history.
  - Commits follow Conventional Commits and are small enough to review on their own.
  - Fixes from reviews are separate commits, each with its own test.
- **AI-assisted development.**
  - The code was written with Claude Code.
  - Each ticket was planned before implementation. After each ticket the changes were reviewed for correctness, accessibility and fit with the existing architecture, and every finding was fixed in its own commit with a test.
  - Examples of what the reviews caught: an email check stricter than the API, a `returnTo` bypass using dot segments, and a failed background refetch wiping unsaved answers.

## Security notes

- **Registration reveals whether an email address is registered (account enumeration).**
  - The API answers a duplicate email with `409 email-already-registered`, and TICKET-001 asks for "useful feedback for duplicate email". The form therefore says an account already exists and links to sign-in.
  - Hiding this only in the UI would not protect anyone. The 409 is visible to anyone who calls the API directly or opens the browser's network tab, so the fix has to be on the server.
  - Sign-in does not reveal it: wrong credentials share one `401` and one message, as TICKET-002 requires.
  - Recommended backend change, out of scope here because the API contract is fixed: answer every registration the same way, for example "Check your email to continue". Then email the owner of an existing account instead of creating a second one. The API's rate limiting (`429`, which the form already explains) slows down automated guessing in the meantime.
  - If the API changes, the frontend only needs to drop the `email-already-registered` branch in `frontend/src/features/account-access/create-account-form.tsx` and reword the success screen.

## Known limitations and out of scope

- **Review and submit.** Final submission is out of scope for TICKET-003, so the review page is still the prototype. It requires the confirmation checkbox, but Submit only opens the receipt page: nothing is sent to the API (`PATCH /api/v1/applicant-applications/{applicationId}`), and the receipt is not real.
- **Plain text inputs for dates, countries and document type.** A real form would use a date picker and searchable lists. They stay as text inputs because nothing defines the values to store: the README and tickets don't mention input types, the API types every answer as a free `string` with no `format` or `enum`, and TICKET-003 rules out changing form fields. Lists in the frontend alone would invent codes the backend and reviewers don't know, and drafts already saved as free text might not match any option, which would break "populate every saved answer". The recommended approach, together with a contract update:
  - **Date of birth and expiry:** a design-system `DatePicker` built on React Aria, storing ISO `YYYY-MM-DD` (`format: date` in the contract). The current validation already enforces this format.
  - **Country, nationality, document country and residential country:** a searchable design-system `ComboBox` storing ISO 3166-1 alpha-2 codes, with names shown in the user's language through `Intl.DisplayNames`. The design system's `SelectField` would be hard to use with about 250 options.
  - **Document type:** a `SelectField` with fixed options, such as Passport, National ID card and Driving licence, defined as an `enum` in the contract.
  - **Phone:** already `type="tel"`. It could be checked against an international format such as E.164.
- **Show/hide password toggle.** Recommended by NIST SP 800-63B and the GOV.UK Design System, because it helps people catch typos, especially on mobile. Left out because no ticket asks for it. It would be a shared design-system `PasswordField`: hidden by default, hidden again on submit, and announcing its state to screen readers.
- **Reviewer area.** Unchanged, apart from fixing a lint error that made `npm run quality` fail.
- **Formatting.** `frontend/tsconfig.json` was already failing the Prettier check on `main` and was left as it was.
