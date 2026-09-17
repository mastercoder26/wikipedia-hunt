import type { Challenge } from '@/lib/types'
import { make } from './shared'

const c = make('random')

export const RANDOM_CHALLENGES: Challenge[] = [
  // easy
  c('easy', 'ran-pizza-italian-cuisine', 'Pizza', 'Italian cuisine'),
  c('easy', 'ran-coffee-caffeine', 'Coffee', 'Caffeine'),
  c('easy', 'ran-chocolate-cocoa-bean', 'Chocolate', 'Cocoa bean'),
  c('easy', 'ran-bicycle-wheel', 'Bicycle', 'Wheel'),
  c('easy', 'ran-chess-board-game', 'Chess', 'Board game'),
  c('easy', 'ran-tea-camellia-sinensis', 'Tea', 'Camellia sinensis'),

  // medium
  c('medium', 'ran-kimchi-olympic-games', 'Kimchi', 'Olympic Games'),
  c('medium', 'ran-coffee-ottoman-empire', 'Coffee', 'Ottoman Empire'),
  c('medium', 'ran-umbrella-monsoon', 'Umbrella', 'Monsoon'),
  c('medium', 'ran-denim-california-gold-rush', 'Denim', 'California gold rush'),
  c('medium', 'ran-natural-rubber-amazon-rainforest', 'Natural rubber', 'Amazon rainforest'),
  c('medium', 'ran-salt-roman-empire', 'Salt', 'Roman Empire'),

  // hard
  c('hard', 'ran-kimchi-black-hole', 'Kimchi', 'Black hole'),
  c('hard', 'ran-pizza-nuclear-reactor', 'Pizza', 'Nuclear reactor'),
  c('hard', 'ran-chocolate-apollo-11', 'Chocolate', 'Apollo 11'),
  c('hard', 'ran-bicycle-dinosaur', 'Bicycle', 'Dinosaur'),
  c('hard', 'ran-coffee-antarctica', 'Coffee', 'Antarctica'),
]
