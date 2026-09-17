import { Suspense, lazy } from 'react'
import { LazyMotion, domAnimation } from 'motion/react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from '@/routes/Home'

// Home is in the initial bundle because it is the first paint. Everything else
// is fetched when the player actually goes there, which keeps the landing
// payload from carrying the challenge catalog, the article reader and confetti.
const Play = lazy(() => import('@/routes/Play').then((m) => ({ default: m.Play })))
const Race = lazy(() => import('@/routes/Race').then((m) => ({ default: m.Race })))
const Results = lazy(() => import('@/routes/Results').then((m) => ({ default: m.Results })))
const Daily = lazy(() => import('@/routes/Daily').then((m) => ({ default: m.Daily })))
const Stats = lazy(() => import('@/routes/Stats').then((m) => ({ default: m.Stats })))
const LiveHome = lazy(() => import('@/routes/LiveHome').then((m) => ({ default: m.LiveHome })))
const LiveRoom = lazy(() => import('@/routes/LiveRoom').then((m) => ({ default: m.LiveRoom })))
const NotFound = lazy(() => import('@/routes/NotFound').then((m) => ({ default: m.NotFound })))

export default function App() {
  return (
    <LazyMotion features={domAnimation} strict>
      <BrowserRouter>
      {/* Blank rather than a spinner: these chunks resolve in a frame or two on
          a warm cache, and a flashed spinner reads worse than nothing. */}
      <Suspense fallback={<div className="min-h-full bg-[var(--paper)]" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/race" element={<Race />} />
          <Route path="/results" element={<Results />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/live" element={<LiveHome />} />
          <Route path="/live/:code" element={<LiveRoom />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </BrowserRouter>
    </LazyMotion>
  )
}
