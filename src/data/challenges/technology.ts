import type { Challenge } from '@/lib/types'
import { make } from './shared'

const c = make('technology')

export const TECHNOLOGY_CHALLENGES: Challenge[] = [
  // easy
  c('easy', 'tech-linux-linus-torvalds', 'Linux', 'Linus Torvalds'),
  c('easy', 'tech-iphone-apple', 'IPhone', 'Apple Inc.'),
  c('easy', 'tech-www-berners-lee', 'World Wide Web', 'Tim Berners-Lee'),
  c('easy', 'tech-python-programming-language', 'Python (programming language)', 'Programming language'),
  c('easy', 'tech-bitcoin-blockchain', 'Bitcoin', 'Blockchain'),
  c('easy', 'tech-transistor-semiconductor', 'Transistor', 'Semiconductor'),

  // medium
  c('medium', 'tech-alan-turing-world-war-ii', 'Alan Turing', 'World War II'),
  c('medium', 'tech-ai-chess', 'Artificial intelligence', 'Chess'),
  c('medium', 'tech-tesla-niagara-falls', 'Nikola Tesla', 'Niagara Falls'),
  c('medium', 'tech-semiconductor-sand', 'Semiconductor', 'Sand'),
  c('medium', 'tech-gps-general-relativity', 'Global Positioning System', 'General relativity'),
  c('medium', 'tech-printing-press-protestantism', 'Printing press', 'Protestantism'),

  // hard
  c('hard', 'tech-machine-learning-sushi', 'Machine learning', 'Sushi'),
  c('hard', 'tech-linux-ballet', 'Linux', 'Ballet'),
  c('hard', 'tech-bitcoin-honey-bee', 'Bitcoin', 'Honey bee'),
  c('hard', 'tech-smartphone-ancient-egypt', 'Smartphone', 'Ancient Egypt'),
  c('hard', 'tech-internet-volcano', 'Internet', 'Volcano'),
]
