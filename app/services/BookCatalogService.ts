import type { BookItem, BookPageData, ClassSection, ImmersiveBookData } from '~/types/learning-journey'
import {
  SHELF_BOOKS_CONFIG,
  getShelfBookById,
  getShelfBooksByClass,
  type ShelfBookConfig,
} from './BookshelfConfig'

export { SHELF_BOOKS_CONFIG, getShelfBookById, getShelfBooksByClass, type ShelfBookConfig }

// Genuine Real Books JSON imports
import ddiaBookJson from '../../public/books/ddia/book.json'
import systemArchJson from '../../public/books/system-arch/book.json'
import compArchJson from '../../public/books/comp-arch/book.json'
import mpmcJson from '../../public/books/mpmc/book.json'
import dsaAhoJson from '../../public/books/dsa-aho/book.json'
import ncertC1MathJson from '../../public/books/ncert-c1-math/book.json'
import ncertC1EnglishJson from '../../public/books/ncert-c1-english/book.json'
import ncertC2MathJson from '../../public/books/ncert-c2-math/book.json'
import ncertC2EnglishJson from '../../public/books/ncert-c2-english/book.json'
import ncertC3MathJson from '../../public/books/ncert-c3-math/book.json'
import ncertC3EvsJson from '../../public/books/ncert-c3-evs/book.json'
import ncertC4MathJson from '../../public/books/ncert-c4-math/book.json'
import ncertC4EvsJson from '../../public/books/ncert-c4-evs/book.json'

/**
 * Catalog Service for the Immersive Bookshelf
 */
export const BOOK_CATALOG: BookItem[] = [
  // 1. Featured Real PDF Books
  ddiaBookJson as unknown as BookItem,
  systemArchJson as unknown as BookItem,
  compArchJson as unknown as BookItem,
  mpmcJson as unknown as BookItem,
  dsaAhoJson as unknown as BookItem,
  ncertC1MathJson as unknown as BookItem,
  ncertC1EnglishJson as unknown as BookItem,
  ncertC2MathJson as unknown as BookItem,
  ncertC2EnglishJson as unknown as BookItem,
  ncertC3MathJson as unknown as BookItem,
  ncertC3EvsJson as unknown as BookItem,
  ncertC4MathJson as unknown as BookItem,
  ncertC4EvsJson as unknown as BookItem,
]

export const CLASS_SECTIONS: ClassSection[] = [
  {
    classNumber: 1,
    label: 'Class 1',
    sublabel: 'Foundations & Stories',
    shelfTierIndex: 0,
    books: [ncertC1MathJson as unknown as BookItem, ncertC1EnglishJson as unknown as BookItem],
  },
  {
    classNumber: 2,
    label: 'Class 2',
    sublabel: 'Numbers & Nature Discovery',
    shelfTierIndex: 1,
    books: [ncertC2MathJson as unknown as BookItem, ncertC2EnglishJson as unknown as BookItem],
  },
  {
    classNumber: 3,
    label: 'Class 3',
    sublabel: 'Mathematics & Distributed Systems',
    shelfTierIndex: 2,
    books: [
      ddiaBookJson as unknown as BookItem,
      ncertC3MathJson as unknown as BookItem,
      ncertC3EvsJson as unknown as BookItem,
      ncertC4MathJson as unknown as BookItem,
      ncertC4EvsJson as unknown as BookItem,
    ],
  },
  {
    classNumber: 4,
    label: 'Class 4',
    sublabel: 'Logic & Environment',
    shelfTierIndex: 2,
    books: [ncertC4MathJson as unknown as BookItem, ncertC4EvsJson as unknown as BookItem],
  },
  {
    classNumber: 5,
    label: 'Class 5',
    sublabel: 'Computer Systems & Architecture',
    shelfTierIndex: 3,
    books: [
      systemArchJson as unknown as BookItem,
      compArchJson as unknown as BookItem,
      mpmcJson as unknown as BookItem,
      dsaAhoJson as unknown as BookItem,
    ],
  },
]

export const BookCatalogService = {
  getAllBooks(): BookItem[] {
    return BOOK_CATALOG
  },

  getShelfBooks(): ShelfBookConfig[] {
    return SHELF_BOOKS_CONFIG
  },

  getShelfBookById(id: string): ShelfBookConfig | undefined {
    return getShelfBookById(id)
  },

  getBookById(id: string): BookItem {
    if (id === 'ddia-c5' || id === 'ddia') {
      return BOOK_CATALOG[0]!
    }
    const found = BOOK_CATALOG.find((b) => b.id === id)
    if (found) return found

    const shelfBook = getShelfBookById(id)
    if (shelfBook) {
      return {
        id: shelfBook.id,
        classGrade: shelfBook.classLevel,
        subject: shelfBook.subject,
        title: shelfBook.title,
        subtitle: shelfBook.subtitle || `${shelfBook.title} · Curriculum Edition`,
        coverColor: shelfBook.coverColor || '#0284c7',
        accentColor: shelfBook.accentColor || '#38bdf8',
        icon: shelfBook.icon || '📖',
        coverImage: shelfBook.coverImage,
        sourcePdf: shelfBook.sourcePdf,
        chapters: [
          {
            chapterNumber: 1,
            title: shelfBook.title,
            description: `Core curriculum and essential concepts in ${shelfBook.subject}`,
            pages: [
              {
                pageNumber: 1,
                header: shelfBook.title,
                subHeader: `${shelfBook.subject} · Class ${shelfBook.classLevel}`,
                title: 'Foundational Concepts & Principles',
                bulletPoints: [
                  `Explore the fundamental lessons and core insights of ${shelfBook.title}.`,
                  `Study the essential methodologies, definitions, and real-world paradigms.`,
                  'Review diagrams, core equations, and guided practice highlights.',
                ],
                footerText: `Page 1 of 4 · ${shelfBook.title}`,
              },
              {
                pageNumber: 2,
                header: shelfBook.title,
                subHeader: 'In-Depth Analysis & Key Insights',
                title: 'Architectural & Applied Frameworks',
                bulletPoints: [
                  `Mastering the key frameworks and structural principles of ${shelfBook.subject}.`,
                  'Deep-dive into component interactions, performance trade-offs, and design patterns.',
                  'Practical examples and problem-solving strategies for exams and systems design.',
                ],
                footerText: `Page 2 of 4 · ${shelfBook.title}`,
              },
              {
                pageNumber: 3,
                header: shelfBook.title,
                subHeader: 'Advanced Problem Solving & Case Studies',
                title: 'System Design & Real-World Applications',
                bulletPoints: [
                  'Comparative analysis of classical versus modern approaches.',
                  'Hands-on problem sets, algorithmic patterns, and optimization techniques.',
                  'Best practices and foundational theorems applied in industry and academia.',
                ],
                footerText: `Page 3 of 4 · ${shelfBook.title}`,
              },
              {
                pageNumber: 4,
                header: shelfBook.title,
                subHeader: 'Summary & Core Takeaways',
                title: 'Chapter Review & Key Takeaways',
                bulletPoints: [
                  `Summary: Comprehensive mastery of ${shelfBook.title}.`,
                  'Key formulas, definitions, and mental models to retain.',
                  'Ready to explore the next chapter or dive into hands-on exercises.',
                ],
                footerText: `Page 4 of 4 · ${shelfBook.title}`,
              },
            ],
          },
        ],
      }
    }

    return BOOK_CATALOG[0]!
  },

  getPageData(bookId: string, pageNumber: number): BookPageData | undefined {
    const book = this.getBookById(bookId)
    return book?.chapters?.[0]?.pages?.find((p) => p.pageNumber === pageNumber)
  },

  getBooksByClass(classGrade: number): BookItem[] {
    const direct = BOOK_CATALOG.filter((b) => b.classGrade === classGrade)
    if (direct.length > 0) return direct
    return getShelfBooksByClass(classGrade).map((b) => this.getBookById(b.id))
  },

  getDefaultBook(): BookItem {
    return BOOK_CATALOG[0]!
  },

  getClassSections(): ClassSection[] {
    return CLASS_SECTIONS
  },
}
