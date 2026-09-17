import type { Challenge } from '@/lib/types'
import { make } from './shared'

const c = make('history')

export const HISTORY_CHALLENGES: Challenge[] = [
  // easy
  c('easy', 'his-julius-caesar-roman-empire', 'Julius Caesar', 'Roman Empire'),
  c('easy', 'his-napoleon-french-revolution', 'Napoleon', 'French Revolution'),
  c('easy', 'his-berlin-wall-cold-war', 'Berlin Wall', 'Cold War'),
  c('easy', 'his-cleopatra-ancient-egypt', 'Cleopatra', 'Ancient Egypt'),
  c('easy', 'his-genghis-khan-mongol-empire', 'Genghis Khan', 'Mongol Empire'),
  c('easy', 'his-apollo-11-nasa', 'Apollo 11', 'NASA'),

  // medium
  c('medium', 'his-silk-road-paper', 'Silk Road', 'Paper'),
  c('medium', 'his-vikings-canada', 'Vikings', 'Canada'),
  c('medium', 'his-industrial-revolution-football', 'Industrial Revolution', 'Association football'),
  c('medium', 'his-titanic-radio', 'Titanic', 'Radio'),
  c('medium', 'his-great-depression-jazz', 'Great Depression', 'Jazz'),
  c('medium', 'his-crusades-banking', 'Crusades', 'Bank'),

  // hard
  c('hard', 'his-french-revolution-sushi', 'French Revolution', 'Sushi'),
  c('hard', 'his-ancient-egypt-video-game', 'Ancient Egypt', 'Video game'),
  c('hard', 'his-cold-war-surfing', 'Cold War', 'Surfing'),
  c('hard', 'his-genghis-khan-antarctica', 'Genghis Khan', 'Antarctica'),
  c('hard', 'his-roman-empire-bitcoin', 'Roman Empire', 'Bitcoin'),
]
