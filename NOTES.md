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
- **Route helper modules** start with `-`, which React Router ignores as routes. They keep route files small: field errors, the return-target check, session handling, step definitions and page states.
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
- **The unsaved-changes guard lives in the journey layout.** The step reports whether its answers differ from what the API last confirmed. The layout asks before in-app navigation (`useBlocker`) and before ending the session on Sign out. Closing the tab gets the browser's own prompt.

## Accessibility (WCAG 2.2 AA)

- Every input has a visible label marked "(required)". Fields carry `autocomplete` purposes (1.3.5). Hints and errors are linked with `aria-describedby`.
- On a failed submit, errors appear next to their fields and focus moves to the first invalid one. Form-level problems use an alert.
- Pending and success messages are announced through `role="status"` regions that stay mounted, so screen readers pick up changes. This works whether the form was submitted with a click or with Enter.
- Each page sets a descriptive `<title>`, and each step's title includes its position, such as "Step 1 of 2".
- `ConfirmDialog` is an alert dialog named by its heading. It traps focus, starts on the safe action, closes with Escape, and returns focus when it closes.
- The Sign out button on the blue header uses a high-contrast style with a visible focus outline.
- jest-axe runs in the component tests. Layouts were checked at 375px wide.

## Verification

From the repository root:

```sh
npm run quality                  # lint, typecheck, dependency rules, DS tests, DS build
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
  - If the API changes, the frontend only needs to drop the `email-already-registered` branch in `frontend/src/routes/-create-account-form.tsx` and reword the success screen.

## Known limitations and out of scope

- **Review and submit.** The review page is still the original prototype and submission is not implemented. Both are out of scope for TICKET-003.
- **Field validation.** Ticket 003 marks it as optional. Continue relies on the browser's required-field check, while Save accepts a partial draft on purpose.
- **Reviewer area.** Unchanged, apart from fixing a lint error that made `npm run quality` fail.
- **Formatting.** `frontend/tsconfig.json` was already failing the Prettier check on `main` and was left as it was.
