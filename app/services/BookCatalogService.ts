import type { BookItem, BookPageData, ClassSection, ImmersiveBookData } from '~/types/learning-journey'

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
 * Data-driven Bookshelf Configuration with 4 Clean Tiers (Zero Books Sticking Out!)
 * Row 1 (Tier 1): Class 1 Foundations & Stories
 * Row 2 (Tier 2): Class 2 Numbers & Nature Discovery
 * Row 3 (Tier 3): Class 3 & 4 Curriculum + DDIA (Eye-Level Reading)
 * Row 4 (Tier 4): Class 5 & Advanced Computer Systems & Architecture
 * ALL books on the shelf are fully interactive, hoverable, and readable!
 */
export const SHELF_BOOKS_CONFIG: ImmersiveBookData[] = [
  // =========================================================================
  // ROW 4 (TIER 4): Class 5 & Advanced Computer Systems & Architecture
  // =========================================================================
  {
    id: 'system-arch',
    classLevel: 5,
    subject: 'System Architecture',
    title: 'Systems Architecting',
    subtitle: 'A Business-Enabling Engineering Discipline',
    coverColor: '#1e3a8a',
    accentColor: '#60a5fa',
    coverImage: '/books/system-arch/cover.png',
    sourcePdf: '/books/system-arch/SystemArchitectureBook.pdf',
    icon: '🏛️',
    isInteractive: true,
  },
  {
    id: 'comp-arch',
    classLevel: 5,
    subject: 'Computer Systems',
    title: 'Computer System Architecture',
    subtitle: 'Hardware Organization & Architecture (3rd Ed)',
    coverColor: '#065f46',
    accentColor: '#34d399',
    coverImage: '/books/comp-arch/cover.png',
    sourcePdf: '/books/comp-arch/computer-systems-Architecture.pdf',
    icon: '💻',
    isInteractive: true,
  },
  {
    id: 'mpmc',
    classLevel: 5,
    subject: 'Microprocessors',
    title: 'Microprocessors & Microcontrollers',
    subtitle: '8086, 8051 & ARM System Architecture',
    coverColor: '#9a3412',
    accentColor: '#fb923c',
    coverImage: '/books/mpmc/cover.png',
    sourcePdf: '/books/mpmc/mpmc_textbook_godse.pdf',
    icon: '⚡',
    isInteractive: true,
  },
  {
    id: 'dsa-aho',
    classLevel: 5,
    subject: 'Algorithms',
    title: 'Data Structures and Algorithms',
    subtitle: 'Design, Analysis & Complexity',
    coverColor: '#4338ca',
    accentColor: '#818cf8',
    coverImage: '/books/dsa-aho/cover.png',
    sourcePdf: '/books/dsa-aho/dsa_aho_hopcroft_ullman.pdf',
    icon: '🌲',
    isInteractive: true,
  },
  {
    id: 'comp-org',
    classLevel: 5,
    subject: 'Hardware',
    title: 'Computer Organization & Design',
    subtitle: 'The Hardware/Software Interface',
    coverColor: '#0369a1',
    accentColor: '#38bdf8',
    icon: '🖥️',
    isInteractive: true,
  },
  {
    id: 'os-concepts',
    classLevel: 5,
    subject: 'Operating Systems',
    title: 'Operating System Concepts',
    subtitle: 'Processes, Memory & Concurrency',
    coverColor: '#1e293b',
    accentColor: '#94a3b8',
    icon: '⚙️',
    isInteractive: true,
  },
  {
    id: 'compilers',
    classLevel: 5,
    subject: 'Compilers',
    title: 'Compilers: Principles & Tools',
    subtitle: 'Lexical Analysis, Parsing & Code Generation',
    coverColor: '#831843',
    accentColor: '#f472b6',
    icon: '🐉',
    isInteractive: true,
  },
  {
    id: 'networks',
    classLevel: 5,
    subject: 'Networking',
    title: 'Computer Networks',
    subtitle: 'Protocols, Routing & Network Architectures',
    coverColor: '#1c1917',
    accentColor: '#a8a29e',
    icon: '🌐',
    isInteractive: true,
  },
  {
    id: 'clrs-algo',
    classLevel: 5,
    subject: 'Algorithms',
    title: 'Introduction to Algorithms',
    subtitle: 'Foundational Analysis & Dynamic Programming',
    coverColor: '#14532d',
    accentColor: '#4ade80',
    icon: '📚',
    isInteractive: true,
  },
  {
    id: 'dist-algos',
    classLevel: 5,
    subject: 'Distributed Systems',
    title: 'Distributed Algorithms',
    subtitle: 'Consensus, Clock Sync & Fault Tolerance',
    coverColor: '#0f766e',
    accentColor: '#2dd4bf',
    icon: '🔄',
    isInteractive: true,
  },
  {
    id: 'sicp',
    classLevel: 5,
    subject: 'Computer Science',
    title: 'Structure & Interpretation (SICP)',
    subtitle: 'Abstractions & Metalinguistic Design',
    coverColor: '#4a044e',
    accentColor: '#e879f9',
    icon: '🧙‍♂️',
    isInteractive: true,
  },
  {
    id: 'db-concepts',
    classLevel: 5,
    subject: 'Databases',
    title: 'Database System Concepts',
    subtitle: 'Relational Models, Transactions & Storage',
    coverColor: '#064e3b',
    accentColor: '#34d399',
    icon: '🗄️',
    isInteractive: true,
  },

  // =========================================================================
  // ROW 3 (TIER 3): Class 3 & 4 Curriculum + DDIA (Eye Level)
  // =========================================================================
  {
    id: 'ddia',
    classLevel: 3,
    subject: 'Systems',
    title: 'Designing Data-Intensive Applications',
    subtitle: 'Reliable, Scalable, and Maintainable Systems',
    coverColor: '#b91c1c',
    accentColor: '#f87171',
    coverImage: '/books/ddia/cover.png',
    sourcePdf: '/books/ddia/Designing_Data_Intensive_Applications.pdf',
    icon: '🐗',
    isInteractive: true,
  },
  {
    id: 'ncert-c3-math',
    classLevel: 3,
    subject: 'Mathematics',
    title: 'Math-Magic',
    subtitle: 'NCERT Multiplication, Place Values & Time',
    coverColor: '#15803d',
    accentColor: '#4ade80',
    coverImage: '/books/ncert-c3-math/cover.png',
    sourcePdf: '/books/ncert-c3-math/ncert_class3_math_magic.pdf',
    icon: '📐',
    isInteractive: true,
  },
  {
    id: 'ncert-c3-evs',
    classLevel: 3,
    subject: 'Science & EVS',
    title: 'Looking Around',
    subtitle: 'NCERT Science, Nature & Plants',
    coverColor: '#047857',
    accentColor: '#34d399',
    coverImage: '/books/ncert-c3-evs/cover.png',
    sourcePdf: '/books/ncert-c3-evs/ncert_class3_looking_around.pdf',
    icon: '🌿',
    isInteractive: true,
  },
  {
    id: 'ncert-c4-math',
    classLevel: 4,
    subject: 'Mathematics',
    title: 'Math-Magic',
    subtitle: 'NCERT Fractions, Building with Bricks & Division',
    coverColor: '#1d4ed8',
    accentColor: '#60a5fa',
    coverImage: '/books/ncert-c4-math/cover.png',
    sourcePdf: '/books/ncert-c4-math/ncert_class4_math_magic.pdf',
    icon: '🧮',
    isInteractive: true,
  },
  {
    id: 'ncert-c4-evs',
    classLevel: 4,
    subject: 'Science & EVS',
    title: 'Looking Around',
    subtitle: 'NCERT Going to School, Animals & Rivers',
    coverColor: '#0f766e',
    accentColor: '#2dd4bf',
    coverImage: '/books/ncert-c4-evs/cover.png',
    sourcePdf: '/books/ncert-c4-evs/ncert_class4_looking_around.pdf',
    icon: '🌍',
    isInteractive: true,
  },
  {
    id: 'db-internals',
    classLevel: 3,
    subject: 'Databases',
    title: 'Database Internals',
    subtitle: 'B-Trees, LSM-Trees & Distributed Engines',
    coverColor: '#0f172a',
    accentColor: '#94a3b8',
    icon: '🧱',
    isInteractive: true,
  },
  {
    id: 'sre-google',
    classLevel: 3,
    subject: 'Systems',
    title: 'Site Reliability Engineering',
    subtitle: 'How Google Runs Production Systems',
    coverColor: '#1e3a8a',
    accentColor: '#38bdf8',
    icon: '🛡️',
    isInteractive: true,
  },
  {
    id: 'streaming-sys',
    classLevel: 3,
    subject: 'Distributed Systems',
    title: 'Streaming Systems',
    subtitle: 'Event-Time, Watermarks & Streaming Engines',
    coverColor: '#047857',
    accentColor: '#34d399',
    icon: '🌊',
    isInteractive: true,
  },
  {
    id: 'hpbn',
    classLevel: 3,
    subject: 'Networking',
    title: 'High Performance Browser Networking',
    subtitle: 'TCP, UDP, TLS & HTTP/2 Protocols',
    coverColor: '#c2410c',
    accentColor: '#fb923c',
    icon: '🚀',
    isInteractive: true,
  },
  {
    id: 'kafka-guide',
    classLevel: 3,
    subject: 'Distributed Systems',
    title: 'Kafka: The Definitive Guide',
    subtitle: 'Real-Time Data Pipelines & Broker Clusters',
    coverColor: '#4338ca',
    accentColor: '#818cf8',
    icon: '📨',
    isInteractive: true,
  },
  {
    id: 'clean-arch',
    classLevel: 3,
    subject: 'Architecture',
    title: 'Clean Architecture',
    subtitle: 'A Craftsman\'s Guide to Software Structure',
    coverColor: '#0284c7',
    accentColor: '#38bdf8',
    icon: '📐',
    isInteractive: true,
  },
  {
    id: 'science-exp',
    classLevel: 4,
    subject: 'Science',
    title: 'Junior Science & Experiments',
    subtitle: 'Hands-on Optics, Motion & Magnetism',
    coverColor: '#0369a1',
    accentColor: '#38bdf8',
    icon: '🔬',
    isInteractive: true,
  },

  // =========================================================================
  // ROW 2 (TIER 2): Class 2 Numbers & Nature Discovery
  // =========================================================================
  {
    id: 'ncert-c2-math',
    classLevel: 2,
    subject: 'Mathematics',
    title: 'Math-Magic',
    subtitle: 'NCERT Addition, Counting & Shapes',
    coverColor: '#0369a1',
    accentColor: '#38bdf8',
    coverImage: '/books/ncert-c2-math/cover.png',
    sourcePdf: '/books/ncert-c2-math/ncert_class2_math_magic.pdf',
    icon: '➕',
    isInteractive: true,
  },
  {
    id: 'ncert-c2-english',
    classLevel: 2,
    subject: 'English',
    title: 'Marigold',
    subtitle: 'NCERT Stories, Friends & Poetry',
    coverColor: '#b45309',
    accentColor: '#fde047',
    coverImage: '/books/ncert-c2-english/cover.png',
    sourcePdf: '/books/ncert-c2-english/ncert_class2_marigold.pdf',
    icon: '📖',
    isInteractive: true,
  },
  {
    id: 'plants-trees',
    classLevel: 2,
    subject: 'Nature',
    title: 'Green Trees & Forest Flora',
    subtitle: 'Roots, Leaves, Sunshine & Flowers',
    coverColor: '#15803d',
    accentColor: '#4ade80',
    icon: '🌳',
    isInteractive: true,
  },
  {
    id: 'animal-kingdom',
    classLevel: 2,
    subject: 'Nature',
    title: 'Animal Kingdom & Bird Life',
    subtitle: 'Habitats, Food Chains & Wildlife',
    coverColor: '#9333ea',
    accentColor: '#c084fc',
    icon: '🦁',
    isInteractive: true,
  },
  {
    id: 'weather-seasons',
    classLevel: 2,
    subject: 'Science',
    title: 'Sun, Rain & Changing Seasons',
    subtitle: 'Atmosphere, Wind & Seasonal Cycles',
    coverColor: '#0284c7',
    accentColor: '#38bdf8',
    icon: '⛅',
    isInteractive: true,
  },
  {
    id: 'mental-math-2',
    classLevel: 2,
    subject: 'Mathematics',
    title: 'Counting Games & Mental Math',
    subtitle: 'Playful Arithmetic & Place Values',
    coverColor: '#c2410c',
    accentColor: '#fb923c',
    icon: '🎲',
    isInteractive: true,
  },
  {
    id: 'storyland-2',
    classLevel: 2,
    subject: 'English',
    title: 'Adventures in Storyland',
    subtitle: 'Classic Bedtime Fables & Tales',
    coverColor: '#6b21a8',
    accentColor: '#a855f7',
    icon: '✨',
    isInteractive: true,
  },
  {
    id: 'shapes-art-2',
    classLevel: 2,
    subject: 'Art',
    title: 'Shapes & Patterns Around Us',
    subtitle: 'Visual Symmetry & Geometry in Everyday Life',
    coverColor: '#16a34a',
    accentColor: '#86efac',
    icon: '🎨',
    isInteractive: true,
  },
  {
    id: 'water-rivers',
    classLevel: 2,
    subject: 'Science',
    title: 'Water, Rivers & Clouds',
    subtitle: 'The Hydrological Cycle & Aquatic Habitats',
    coverColor: '#0e7490',
    accentColor: '#22d3ee',
    icon: '💧',
    isInteractive: true,
  },
  {
    id: 'curious-kids',
    classLevel: 2,
    subject: 'General',
    title: 'Curious Questions for Young Minds',
    subtitle: 'Everyday Wonders & Science Riddles',
    coverColor: '#b45309',
    accentColor: '#fde047',
    icon: '❓',
    isInteractive: true,
  },

  // =========================================================================
  // ROW 1 (TIER 1): Class 1 Foundations & Stories
  // =========================================================================
  {
    id: 'ncert-c1-math',
    classLevel: 1,
    subject: 'Mathematics',
    title: 'Math-Magic',
    subtitle: 'NCERT Joyful Mathematics & Shapes',
    coverColor: '#0284c7',
    accentColor: '#38bdf8',
    coverImage: '/books/ncert-c1-math/cover.png',
    sourcePdf: '/books/ncert-c1-math/ncert_class1_math_magic.pdf',
    icon: '🔢',
    isInteractive: true,
  },
  {
    id: 'ncert-c1-english',
    classLevel: 1,
    subject: 'English',
    title: 'Marigold',
    subtitle: 'NCERT English Stories & Rhymes',
    coverColor: '#c2410c',
    accentColor: '#fb923c',
    coverImage: '/books/ncert-c1-english/cover.png',
    sourcePdf: '/books/ncert-c1-english/ncert_class1_marigold.pdf',
    icon: '🌸',
    isInteractive: true,
  },
  {
    id: 'alphabet-book',
    classLevel: 1,
    subject: 'English',
    title: 'Illustrated Alphabet Picture Book',
    subtitle: 'Phonics, Vowels & Letters A to Z',
    coverColor: '#b45309',
    accentColor: '#fde047',
    icon: '🔤',
    isInteractive: true,
  },
  {
    id: 'numbers-1-50',
    classLevel: 1,
    subject: 'Mathematics',
    title: 'Playful Numbers 1 to 50',
    subtitle: 'Counting, Bundles & Grouping',
    coverColor: '#047857',
    accentColor: '#34d399',
    icon: '🔟',
    isInteractive: true,
  },
  {
    id: 'colors-drawing',
    classLevel: 1,
    subject: 'Art',
    title: 'Colors, Drawing & Painting',
    subtitle: 'Rainbow Hues & Elementary Shapes',
    coverColor: '#6b21a8',
    accentColor: '#a855f7',
    icon: '🖍️',
    isInteractive: true,
  },
  {
    id: 'nursery-melodies',
    classLevel: 1,
    subject: 'Music',
    title: 'Classic Nursery Rhymes',
    subtitle: 'Musical Songs, Chants & Poetry',
    coverColor: '#991b1b',
    accentColor: '#f87171',
    icon: '🎵',
    isInteractive: true,
  },
  {
    id: 'first-words',
    classLevel: 1,
    subject: 'Language',
    title: 'First Words & Picture Cards',
    subtitle: 'Everyday Objects & Vocabulary',
    coverColor: '#0284c7',
    accentColor: '#38bdf8',
    icon: '🗂️',
    isInteractive: true,
  },
  {
    id: 'counting-friends',
    classLevel: 1,
    subject: 'Mathematics',
    title: 'Counting Kittens & Puppies',
    subtitle: 'Visual Math & Animal Quantities',
    coverColor: '#16a34a',
    accentColor: '#86efac',
    icon: '🐱',
    isInteractive: true,
  },
  {
    id: 'green-garden',
    classLevel: 1,
    subject: 'Nature',
    title: 'My Green Garden & Flowers',
    subtitle: 'Seeds, Sprouts & Sunlight',
    coverColor: '#15803d',
    accentColor: '#4ade80',
    icon: '🌻',
    isInteractive: true,
  },
  {
    id: 'lullabies-music',
    classLevel: 1,
    subject: 'Music',
    title: 'Lullabies & Sweet Melodies',
    subtitle: 'Gentle Music & Peaceful Night Songs',
    coverColor: '#7c2d12',
    accentColor: '#fb923c',
    icon: '🌙',
    isInteractive: true,
  },
]

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

  getShelfBooks(): ImmersiveBookData[] {
    return SHELF_BOOKS_CONFIG
  },

  getShelfBookById(id: string): ImmersiveBookData | undefined {
    return SHELF_BOOKS_CONFIG.find((b) => b.id === id)
  },

  getBookById(id: string): BookItem {
    if (id === 'ddia-c5' || id === 'ddia') {
      return BOOK_CATALOG[0]!
    }
    const found = BOOK_CATALOG.find((b) => b.id === id)
    if (found) return found

    const shelfBook = SHELF_BOOKS_CONFIG.find((b) => b.id === id)
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
    return SHELF_BOOKS_CONFIG.filter((b) => b.classLevel === classGrade).map((b) => this.getBookById(b.id))
  },

  getDefaultBook(): BookItem {
    return BOOK_CATALOG[0]!
  },

  getClassSections(): ClassSection[] {
    return CLASS_SECTIONS
  },
}
