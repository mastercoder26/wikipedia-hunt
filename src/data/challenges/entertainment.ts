import type { Challenge } from '@/lib/types'
import { make } from './shared'

const c = make('entertainment')

export const ENTERTAINMENT_CHALLENGES: Challenge[] = [
  // easy
  c('easy', 'ent-beatles-rock-music', 'The Beatles', 'Rock music'),
  c('easy', 'ent-star-wars-george-lucas', 'Star Wars', 'George Lucas'),
  c('easy', 'ent-harry-potter-jk-rowling', 'Harry Potter', 'J. K. Rowling'),
  c('easy', 'ent-walt-disney-animation', 'Walt Disney', 'Animation'),
  c('easy', 'ent-mona-lisa-leonardo', 'Mona Lisa', 'Leonardo da Vinci'),
  c('easy', 'ent-shakespeare-hamlet', 'William Shakespeare', 'Hamlet'),

  // medium
  c('medium', 'ent-elvis-us-army', 'Elvis Presley', 'United States Army'),
  c('medium', 'ent-studio-ghibli-aviation', 'Studio Ghibli', 'Aviation'),
  c('medium', 'ent-lotr-philology', 'The Lord of the Rings', 'Philology'),
  c('medium', 'ent-netflix-algorithm', 'Netflix', 'Algorithm'),
  c('medium', 'ent-taylor-swift-copyright', 'Taylor Swift', 'Copyright'),
  c('medium', 'ent-anime-woodblock-printing', 'Anime', 'Woodblock printing in Japan'),

  // hard
  c('hard', 'ent-anime-penicillin', 'Anime', 'Penicillin'),
  c('hard', 'ent-ballet-black-hole', 'Ballet', 'Black hole'),
  c('hard', 'ent-us-cinema-photosynthesis', 'Cinema of the United States', 'Photosynthesis'),
  c('hard', 'ent-opera-bitcoin', 'Opera', 'Bitcoin'),
  c('hard', 'ent-michael-jackson-everest', 'Michael Jackson', 'Mount Everest'),
]
