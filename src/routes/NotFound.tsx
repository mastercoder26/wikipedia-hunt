import { Page } from '@/components/Shell'
import { ButtonLink, EmptyState } from '@/components/ui'

export function NotFound() {
  return (
    <Page>
      <EmptyState
        title="Dead end"
        body="There is no article here and no link out."
        action={
          <ButtonLink to="/" variant="primary">
            Back to WikiDash
          </ButtonLink>
        }
      />
    </Page>
  )
}
