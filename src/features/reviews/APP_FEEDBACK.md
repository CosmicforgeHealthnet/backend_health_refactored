# App feedback

Patients and doctors can share their overall Cosmic experience without an appointment.
The dashboard reviews pages now use these authenticated endpoints:

- `POST /api/reviews/feedback`: submit `{ experience, troubleAreas?, comment? }`.
- `GET /api/reviews/feedback/mine`: retrieve the authenticated user's feedback, newest first.

Experience is `smooth`, `some_difficulties`, or `could_not_finish`. Trouble areas are
role-specific and validated by `services/appFeedbackService.js`. Comments are optional
and limited to 2,000 characters. Author and role come from the authenticated JWT.

Responses contain `{ success: true, feedback }`, where feedback is a record for POST
and an array for GET. Invalid inputs return 400; unsupported roles return 403.

## Database rollout

Apply `1900000000060-CreateAppFeedback.js` to the intended database before releasing
the updated frontend. The normal development migration command is `npm run migration:run`;
it applies all pending migrations, so check `npm run migration:show` first. Production
must use the deployment's production environment configuration rather than the
development npm script. This migration was applied successfully to the database
configured by `.env.development` on 2026-09-16. Other environments still need their
own migration rollout.

Existing appointment reviews remain in `reviews`; new app feedback is stored in
`app_feedback`. Previous appointment reviews are not relabeled as app feedback.
