import { Box, Button, Stack, TextField, Typography } from '@kyc/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import {
  applicationSteps,
  type ApplicationForm,
  type ApplicationStep,
} from '../../api/applicant-applications'
import styles from '../application-step.module.css'

import {
  stepFields,
  stepTitles,
  valuesFromAnswers,
  type TextAnswerField,
} from './-application-steps'

export interface StepFormProps {
  applicationId: string
  step: ApplicationStep
  /** The saved form the fields start from. */
  form: ApplicationForm
}

export function StepForm({ applicationId, step, form }: StepFormProps) {
  const navigate = useNavigate()
  const [values, setValues] = useState(() => valuesFromAnswers(form.answers))
  const stepNumber = applicationSteps.indexOf(step) + 1
  const title = stepTitles[step]
  const isFirstStep = step === 'personal-details'
  const previousHref = isFirstStep
    ? '/applications/current'
    : `/applications/${applicationId}/personal-details`
  const nextHref = isFirstStep
    ? `/applications/${applicationId}/identity-and-address`
    : `/applications/${applicationId}/review`

  function setText(name: TextAnswerField, value: string) {
    setValues((current) => ({
      ...current,
      text: { ...current.text, [name]: value },
    }))
  }

  return (
    <main className={styles.page}>
      <title>{`${title} – Step ${stepNumber} of ${applicationSteps.length} | KYC`}</title>
      <Box component="div" className={styles.stepContent}>
        <Stack spacing={3}>
          <Typography component="p" variant="eyebrow" tone="accent">
            STEP {stepNumber} OF {applicationSteps.length}
          </Typography>
          <Typography component="h1" variant="heading">
            {title}
          </Typography>
          <Typography tone="muted">
            Save your answers at any time and come back to finish later.
          </Typography>
          <Stack
            component="form"
            className={styles.stepForm}
            onSubmit={(event) => {
              event.preventDefault()
              void navigate(nextHref)
            }}
            spacing={2}
          >
            {stepFields[step].map(({ name, label, autoComplete, type }) => (
              <TextField
                autoComplete={autoComplete}
                id={`answer-${name}`}
                key={name}
                label={`${label} (required)`}
                name={name}
                onChange={(event) => setText(name, event.target.value)}
                required
                type={type}
                value={values.text[name]}
              />
            ))}
            {isFirstStep ? (
              <label>
                <input
                  checked={values.consentConfirmed}
                  name="consentConfirmed"
                  onChange={(event) => {
                    const { checked } = event.target
                    setValues((current) => ({
                      ...current,
                      consentConfirmed: checked,
                    }))
                  }}
                  required
                  type="checkbox"
                />{' '}
                I confirm these details are accurate and belong to me.
              </label>
            ) : (
              <>
                <label htmlFor="document-evidence">
                  Document evidence (required)
                </label>
                <input
                  id="document-evidence"
                  type="file"
                  accept="image/jpeg,image/png"
                />
              </>
            )}
            <Stack
              component="div"
              className={styles.formActions}
              direction="row"
              spacing={2}
            >
              <Button
                type="button"
                variant="quiet"
                onPress={() => void navigate(previousHref)}
              >
                Back
              </Button>
              <Button type="submit">
                {isFirstStep ? 'Continue' : 'Save and review'}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </main>
  )
}
