import type { BookItem, BookPageData, ClassSection, ImmersiveBookData } from '~/types/learning-journey'
import {
  SHELF_BOOKS_CONFIG,
  getShelfBookById,
  getShelfBooksByClass,
  type ShelfBookConfig,
} from './BookshelfConfig'

export { SHELF_BOOKS_CONFIG, getShelfBookById, getShelfBooksByClass, type ShelfBookConfig }

// Dynamically load all 44 rich book.json catalogs for all shelf volumes
const bookJsonModules = import.meta.glob<{ default: BookItem }>(
  '../../public/books/*/book.json',
  { eager: true }
)

export const BOOK_CATALOG: BookItem[] = Object.values(bookJsonModules).map(
  (mod) => ((mod as any).default || mod) as unknown as BookItem
)

export const CLASS_SECTIONS: ClassSection[] = [
  {
    classNumber: 1,
    label: 'Class 1',
    sublabel: 'Foundations & Early Reading',
    shelfTierIndex: 0,
    books: BOOK_CATALOG.filter((b) => b.classGrade === 1),
  },
  {
    classNumber: 2,
    label: 'Class 2',
    sublabel: 'Numbers & Nature Discovery',
    shelfTierIndex: 1,
    books: BOOK_CATALOG.filter((b) => b.classGrade === 2),
  },
  {
    classNumber: 3,
    label: 'Class 3',
    sublabel: 'Mathematics & Distributed Systems',
    shelfTierIndex: 2,
    books: BOOK_CATALOG.filter((b) => b.classGrade === 3),
  },
  {
    classNumber: 4,
    label: 'Class 4',
    sublabel: 'Logic & Environment',
    shelfTierIndex: 2,
    books: BOOK_CATALOG.filter((b) => b.classGrade === 4),
  },
  {
    classNumber: 5,
    label: 'Class 5',
    sublabel: 'Computer Systems & Architecture',
    shelfTierIndex: 3,
    books: BOOK_CATALOG.filter((b) => b.classGrade === 5),
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
    const targetId = id === 'ddia-c5' ? 'ddia' : id
    const found = BOOK_CATALOG.find((b) => b.id === targetId)
    if (found) return found

    const shelfBook = getShelfBookById(targetId)
    if (shelfBook) {
      const defaultBook = BOOK_CATALOG.find((b) => b.id === 'ddia') || BOOK_CATALOG[0]!
      return {
        ...defaultBook,
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
      }
    }

    return BOOK_CATALOG.find((b) => b.id === 'ddia') || BOOK_CATALOG[0]!
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
    return BOOK_CATALOG.find((b) => b.id === 'ddia') || BOOK_CATALOG[0]!
  },

  getClassSections(): ClassSection[] {
    return CLASS_SECTIONS
  },
}
