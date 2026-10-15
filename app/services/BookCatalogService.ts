import { shallowRef } from 'vue'
import type { BookItem, BookPageData, ClassSection } from '~/types/learning-journey'
import {
  SHELF_BOOKS_CONFIG,
  getShelfBookById,
  getShelfBooksByClass,
  type ShelfBookConfig,
} from './BookshelfConfig'

export { SHELF_BOOKS_CONFIG, getShelfBookById, getShelfBooksByClass, type ShelfBookConfig }

// Lazy per-book loaders: each book.json becomes its own chunk that is only fetched when the book is
// needed, instead of inlining ~4.6MB of curriculum JSON into the main JS bundle.
const bookJsonLoaders = import.meta.glob<BookItem>('../../public/books/*/book.json', { import: 'default' })

const loaderByFolder = new Map<string, () => Promise<BookItem>>()
for (const [path, loader] of Object.entries(bookJsonLoaders)) {
  const folder = path.split('/').slice(-2, -1)[0]
  if (folder) loaderByFolder.set(folder, loader)
}

const loadedBooks = new Map<string, BookItem>()
const pendingLoads = new Map<string, Promise<BookItem | null>>()

/** Bumped whenever a book finishes loading so Vue computeds can re-evaluate. */
export const bookCatalogVersion = shallowRef(0)

const DEFAULT_BOOK_ID = 'ddia'

function resolveId(id: string): string {
  return id === 'ddia-c5' ? 'ddia' : id
}

function buildPlaceholderBook(shelfBook: ShelfBookConfig | undefined, id: string): BookItem {
  const title = shelfBook?.title || 'Study Book'
  const subject = shelfBook?.subject || 'General'
  return {
    id,
    classGrade: shelfBook?.classLevel || 5,
    subject,
    title,
    subtitle: shelfBook?.subtitle || `${title} · Curriculum Edition`,
    coverColor: shelfBook?.coverColor || '#0284c7',
    accentColor: shelfBook?.accentColor || '#38bdf8',
    icon: shelfBook?.icon || '📖',
    coverImage: shelfBook?.coverImage,
    sourcePdf: shelfBook?.sourcePdf,
    chapters: [
      {
        chapterNumber: 1,
        title,
        description: 'Loading curriculum…',
        pages: [
          {
            pageNumber: 1,
            header: title,
            subHeader: subject,
            title: 'Loading…',
            footerText: title,
          },
        ],
      },
    ],
  }
}

export const BookCatalogService = {
  /** True once the full book.json for this id is in memory (or the id has no book.json at all). */
  isBookLoaded(id: string): boolean {
    const targetId = resolveId(id)
    return loadedBooks.has(targetId) || !loaderByFolder.has(targetId)
  },

  /** Fetches (once) and caches the full curriculum for a book. */
  ensureBookLoaded(id: string): Promise<BookItem | null> {
    const targetId = resolveId(id)
    const loaded = loadedBooks.get(targetId)
    if (loaded) return Promise.resolve(loaded)

    const loader = loaderByFolder.get(targetId)
    if (!loader) {
      // Shelf-only books borrow the default curriculum, so make sure that one is available.
      return targetId === DEFAULT_BOOK_ID ? Promise.resolve(null) : this.ensureBookLoaded(DEFAULT_BOOK_ID)
    }

    let pending = pendingLoads.get(targetId)
    if (!pending) {
      pending = loader()
        .then((book) => {
          loadedBooks.set(targetId, book)
          bookCatalogVersion.value++
          return book
        })
        .catch((err) => {
          console.warn(`[BookCatalogService] Could not load book "${targetId}":`, err)
          return null
        })
        .finally(() => {
          pendingLoads.delete(targetId)
        })
      pendingLoads.set(targetId, pending)
    }
    return pending
  },

  getAllBooks(): BookItem[] {
    return Array.from(loadedBooks.values())
  },

  getShelfBooks(): ShelfBookConfig[] {
    return SHELF_BOOKS_CONFIG
  },

  getShelfBookById(id: string): ShelfBookConfig | undefined {
    return getShelfBookById(id)
  },

  getBookById(id: string): BookItem {
    const targetId = resolveId(id)
    const found = loadedBooks.get(targetId)
    if (found) return found

    const shelfBook = getShelfBookById(targetId)

    // Book has its own curriculum that simply hasn't arrived yet
    if (loaderByFolder.has(targetId)) {
      return buildPlaceholderBook(shelfBook, targetId)
    }

    const defaultBook = loadedBooks.get(DEFAULT_BOOK_ID)
    if (shelfBook) {
      if (!defaultBook) return buildPlaceholderBook(shelfBook, shelfBook.id)
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

    return this.getDefaultBook()
  },

  getPageData(bookId: string, pageNumber: number): BookPageData | undefined {
    const book = this.getBookById(bookId)
    return book?.chapters?.[0]?.pages?.find((p) => p.pageNumber === pageNumber)
  },

  getBooksByClass(classGrade: number): BookItem[] {
    // Shelf config mirrors every book.json's classGrade; sorting by id keeps the original folder order.
    return [...getShelfBooksByClass(classGrade)]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((b) => this.getBookById(b.id))
  },

  getDefaultBook(): BookItem {
    return (
      loadedBooks.get(DEFAULT_BOOK_ID) ||
      buildPlaceholderBook(getShelfBookById(DEFAULT_BOOK_ID), DEFAULT_BOOK_ID)
    )
  },

  getClassSections(): ClassSection[] {
    return [
      { classNumber: 1, label: 'Class 1', sublabel: 'Foundations & Early Reading', shelfTierIndex: 0 },
      { classNumber: 2, label: 'Class 2', sublabel: 'Numbers & Nature Discovery', shelfTierIndex: 1 },
      { classNumber: 3, label: 'Class 3', sublabel: 'Mathematics & Distributed Systems', shelfTierIndex: 2 },
      { classNumber: 4, label: 'Class 4', sublabel: 'Logic & Environment', shelfTierIndex: 2 },
      { classNumber: 5, label: 'Class 5', sublabel: 'Computer Systems & Architecture', shelfTierIndex: 3 },
    ].map((section) => ({ ...section, books: this.getBooksByClass(section.classNumber) }))
  },
}
