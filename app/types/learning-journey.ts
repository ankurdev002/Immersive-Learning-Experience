/**
 * Types and interfaces for the Immersive Learning Journey
 * Extends the existing 3D study room flow:
 * Chapter -> Look Inside -> Enter Room -> Explore Bookshelf -> Select Class -> Select Book -> Fly to Table -> Read Book
 */

export type ChamberPhase =
  | 'room-view'         // Wide Japanese room overview
  | 'shelf-explore'     // Camera focused on bookshelf sections & class tiers
  | 'book-flying'       // Book arcing from shelf to study desk
  | 'on-table'          // Book placed flat on desk, ready to explore
  | 'book-open'         // Book cover opened, viewing chapter pages

export interface ImmersiveBookData {
  id: string
  classLevel: number
  subject: string
  title: string
  subtitle?: string
  model?: string
  coverTexture?: string
  coverImage?: string
  sourcePdf?: string
  coverColor?: string
  accentColor?: string
  icon?: string
  slot?: number
  isInteractive?: boolean
}

export interface BookPageData {
  pageNumber: number
  header: string
  subHeader: string
  title: string
  bulletPoints?: string[]
  formulaOrSummary?: string
  objectives?: string[]
  diagramType?: 'ray-optics' | 'math-counting' | 'math-addition' | 'generic'
  imageUrl?: string
  tip?: string
  footerText?: string
}

export interface BookChapterData {
  chapterNumber: number
  title: string
  description: string
  pages: BookPageData[]
}

export interface BookItem {
  id: string
  classGrade: number
  subject: string
  title: string
  subtitle: string
  coverColor: string
  accentColor: string
  icon: string
  coverImage?: string
  sourcePdf?: string
  chapters: BookChapterData[]
}

export interface ClassSection {
  classNumber: number
  label: string
  sublabel: string
  shelfTierIndex: number
  books: BookItem[]
}
