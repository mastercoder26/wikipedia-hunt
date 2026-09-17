import type { Challenge } from '@/lib/types'
import { make } from './shared'

const c = make('science')

export const SCIENCE_CHALLENGES: Challenge[] = [
  // easy: same field, two or three hops
  c('easy', 'sci-beagle-dog-breed', 'Beagle', 'Dog breed'),
  c('easy', 'sci-photosynthesis-chlorophyll', 'Photosynthesis', 'Chlorophyll'),
  c('easy', 'sci-dna-gene', 'DNA', 'Gene'),
  c('easy', 'sci-jupiter-solar-system', 'Jupiter', 'Solar System'),
  c('easy', 'sci-penicillin-antibiotic', 'Penicillin', 'Antibiotic'),
  c('easy', 'sci-earthquake-plate-tectonics', 'Earthquake', 'Plate tectonics'),

  // medium: different domains, several plausible bridges
  c('medium', 'sci-marie-curie-manhattan-project', 'Marie Curie', 'Manhattan Project'),
  c('medium', 'sci-volcano-roman-empire', 'Volcano', 'Roman Empire'),
  c('medium', 'sci-honey-bee-coffee', 'Honey bee', 'Coffee'),
  c('medium', 'sci-albert-einstein-violin', 'Albert Einstein', 'Violin'),
  c('medium', 'sci-dinosaur-petroleum', 'Dinosaur', 'Petroleum'),
  c('medium', 'sci-vaccine-cattle', 'Vaccine', 'Cattle'),

  // hard: wildly unrelated, needs a hub article
  c('hard', 'sci-mitochondria-jazz', 'Mitochondria', 'Jazz'),
  c('hard', 'sci-periodic-table-sushi', 'Periodic table', 'Sushi'),
  c('hard', 'sci-quantum-mechanics-chess', 'Quantum mechanics', 'Chess'),
  c('hard', 'sci-black-hole-pizza', 'Black hole', 'Pizza'),
  c('hard', 'sci-photosynthesis-hip-hop', 'Photosynthesis', 'Hip-hop'),
]
