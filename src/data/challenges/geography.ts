import type { Challenge } from '@/lib/types'
import { make } from './shared'

const c = make('geography')

export const GEOGRAPHY_CHALLENGES: Challenge[] = [
  // easy
  c('easy', 'geo-everest-himalayas', 'Mount Everest', 'Himalayas'),
  c('easy', 'geo-nile-egypt', 'Nile', 'Egypt'),
  c('easy', 'geo-sahara-desert', 'Sahara', 'Desert'),
  c('easy', 'geo-amazon-river-brazil', 'Amazon River', 'Brazil'),
  c('easy', 'geo-eiffel-tower-paris', 'Eiffel Tower', 'Paris'),
  c('easy', 'geo-great-barrier-reef-coral', 'Great Barrier Reef', 'Coral'),

  // medium
  c('medium', 'geo-great-wall-silk-road', 'Great Wall of China', 'Silk Road'),
  c('medium', 'geo-taj-mahal-islamic-architecture', 'Taj Mahal', 'Islamic architecture'),
  c('medium', 'geo-antarctica-climate-change', 'Antarctica', 'Climate change'),
  c('medium', 'geo-venice-glass', 'Venice', 'Glass'),
  c('medium', 'geo-everest-oxygen', 'Mount Everest', 'Oxygen'),
  c('medium', 'geo-iceland-vikings', 'Iceland', 'Vikings'),

  // hard
  c('hard', 'geo-eiffel-tower-dinosaur', 'Eiffel Tower', 'Dinosaur'),
  c('hard', 'geo-sahara-jazz', 'Sahara', 'Jazz'),
  c('hard', 'geo-iceland-sushi', 'Iceland', 'Sushi'),
  c('hard', 'geo-nile-video-game', 'Nile', 'Video game'),
  c('hard', 'geo-everest-bitcoin', 'Mount Everest', 'Bitcoin'),
]
