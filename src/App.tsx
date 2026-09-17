import { Suspense, lazy } from 'react'
import { LazyMotion, domAnimation } from 'motion/react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from '@/routes/Home'

const NotFound = lazy(() => import('@/routes/NotFound').then((m) => ({ default: m.NotFound })))

export default function App() {
  return (
    <LazyMotion features={domAnimation} strict>
      <BrowserRouter>
      <Suspense fallback={<div className="min-h-full bg-[var(--paper)]" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </BrowserRouter>
    </LazyMotion>
  )
}
