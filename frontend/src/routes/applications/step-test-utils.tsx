import { LocationProbe, renderRoutes } from '../../test/render-routes'

import ApplicationStepPage, { parseStepParam } from './step'

export const APPLICATION_ID = '446971cf-e530-4ab7-9d24-74404a053de0'
export const FORM_URL = `/api/v1/applicant-applications/${APPLICATION_ID}/form`

export const savedAnswers = {
  name: 'Ada Lovelace',
  dateOfBirth: '1815-12-10',
  country: 'United Kingdom',
  nationality: 'British',
  email: 'ada@example.com',
  phone: '+44 20 7946 0000',
  consentConfirmed: true,
  documentType: 'Passport',
  documentNumber: '123456789',
  documentCountry: 'United Kingdom',
  expiry: '2099-01-01',
  street: '12 St James Square',
  city: 'London',
  postal: 'SW1Y 4JH',
  residentialCountry: 'United Kingdom',
}

export function formDocument(
  answers: object = savedAnswers,
  { version = 7, documentPresent = false } = {},
) {
  return {
    data: {
      type: 'applicant-application-forms',
      id: APPLICATION_ID,
      attributes: {
        status: 'draft',
        currentStep: 'personal-details',
        steps: [
          { step: 'personal-details', state: 'current' },
          { step: 'identity-and-address', state: 'remaining' },
        ],
        answers,
        documentEvidence: { present: documentPresent },
        version,
      },
    },
  }
}

export function renderStep(step: string) {
  return renderRoutes(
    [
      {
        path: '/applications/:applicationId/:step',
        Component: ApplicationStepPage,
        loader: ({ params }) => ({ step: parseStepParam(params.step ?? '') }),
        ErrorBoundary: () => <p>Page not found</p>,
      },
      { path: '/applications/current', Component: LocationProbe },
      { path: '/sign-in', Component: LocationProbe },
    ],
    `/applications/${APPLICATION_ID}/${step}`,
  )
}
