import type { Challenge } from '@/lib/types'
import { make } from './shared'

const c = make('sports')

export const SPORTS_CHALLENGES: Challenge[] = [
  // easy
  c('easy', 'spo-messi-world-cup', 'Lionel Messi', 'FIFA World Cup'),
  c('easy', 'spo-jordan-nba', 'Michael Jordan', 'National Basketball Association'),
  c('easy', 'spo-wimbledon-tennis', 'Wimbledon Championships', 'Tennis'),
  c('easy', 'spo-babe-ruth-baseball', 'Babe Ruth', 'Baseball'),
  c('easy', 'spo-tour-de-france-cycling', 'Tour de France', 'Cycling'),
  c('easy', 'spo-pele-brazil-team', 'Pelé', 'Brazil national football team'),

  // medium
  c('medium', 'spo-formula-one-aerodynamics', 'Formula One', 'Aerodynamics'),
  c('medium', 'spo-olympic-games-ancient-greece', 'Olympic Games', 'Ancient Greece'),
  c('medium', 'spo-sumo-shinto', 'Sumo', 'Shinto'),
  c('medium', 'spo-marathon-achaemenid-empire', 'Marathon', 'Achaemenid Empire'),
  c('medium', 'spo-cricket-british-empire', 'Cricket', 'British Empire'),
  c('medium', 'spo-skiing-norway', 'Skiing', 'Norway'),

  // hard
  c('hard', 'spo-basketball-black-hole', 'Basketball', 'Black hole'),
  c('hard', 'spo-skateboarding-french-revolution', 'Skateboarding', 'French Revolution'),
  c('hard', 'spo-surfing-quantum-mechanics', 'Surfing', 'Quantum mechanics'),
  c('hard', 'spo-chess-penicillin', 'Chess', 'Penicillin'),
  c('hard', 'spo-baseball-volcano', 'Baseball', 'Volcano'),
]
