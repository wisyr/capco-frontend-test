import { Card, CardContent } from '@kyc/ui'

import styles from './account-access.module.css'

import type { ReactNode } from 'react'

/** Page layout shared by the registration and sign-in screens. */
export function AccountAccessCard({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>{children}</CardContent>
      </Card>
    </main>
  )
}
