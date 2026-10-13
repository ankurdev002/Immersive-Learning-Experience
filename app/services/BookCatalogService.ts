import type { BookItem, BookPageData, ClassSection, ImmersiveBookData } from '~/types/learning-journey'
import ddiaBookJson from '../../public/books/ddia/book.json'

/**
 * Data-driven Bookshelf Configuration
 * Tiers: Class 1, Class 2, Class 3, Class 4, Class 5
 * All shelf books are fully interactive!
 */
export const SHELF_BOOKS_CONFIG: ImmersiveBookData[] = [
  // Class 1
  { id: 'c1-b1', classLevel: 1, subject: 'English', title: 'Alphabet Stories', coverColor: '#b45309', slot: 1, isInteractive: true },
  { id: 'c1-b2', classLevel: 1, subject: 'Math', title: 'Numbers 1-20', coverColor: '#0369a1', slot: 2, isInteractive: true },
  { id: 'c1-b3', classLevel: 1, subject: 'Art', title: 'Colors & Shapes', coverColor: '#15803d', slot: 3, isInteractive: true },
  { id: 'c1-b4', classLevel: 1, subject: 'Nature', title: 'My Pet Friends', coverColor: '#6b21a8', slot: 4, isInteractive: true },
  { id: 'c1-b5', classLevel: 1, subject: 'Music', title: 'Rhymes & Tunes', coverColor: '#991b1b', slot: 5, isInteractive: true },

  // Class 2
  { id: 'c2-b1', classLevel: 2, subject: 'Math', title: 'Addition Fun', coverColor: '#0284c7', slot: 1, isInteractive: true },
  { id: 'c2-b2', classLevel: 2, subject: 'Nature', title: 'Plants & Trees', coverColor: '#16a34a', slot: 2, isInteractive: true },
  { id: 'c2-b3', classLevel: 2, subject: 'English', title: 'Short Stories', coverColor: '#9333ea', slot: 3, isInteractive: true },
  { id: 'c2-b4', classLevel: 2, subject: 'Science', title: 'Seasons & Days', coverColor: '#b45309', slot: 4, isInteractive: true },
  { id: 'c2-b5', classLevel: 2, subject: 'Grammar', title: 'Naming Words', coverColor: '#0e7490', slot: 5, isInteractive: true },

  // Class 3
  { id: 'c3-b1', classLevel: 3, subject: 'Science', title: 'Living Things', coverColor: '#15803d', slot: 1, isInteractive: true },
  { id: 'c3-b2', classLevel: 3, subject: 'English', title: 'Story Magic', coverColor: '#b45309', slot: 2, isInteractive: true },
  { id: 'c3-b3', classLevel: 3, subject: 'Social', title: 'Our Neighborhood', coverColor: '#6b21a8', slot: 3, isInteractive: true },
  {
    id: 'math-class-3',
    classLevel: 3,
    subject: 'Mathematics',
    title: 'Numbers and Counting',
    subtitle: 'Elementary Arithmetic & Place Values',
    coverColor: '#0284c7',
    accentColor: '#38bdf8',
    icon: '📐',
    slot: 4,
    isInteractive: true,
  },
  // Featured Real Book: Designing Data-Intensive Applications on Class 3 eye-level shelf right next to Mathematics!
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
    slot: 5,
    isInteractive: true,
  },

  // Class 4
  { id: 'c4-b1', classLevel: 4, subject: 'Math', title: 'Fractions & Shapes', coverColor: '#0369a1', slot: 1, isInteractive: true },
  { id: 'c4-b2', classLevel: 4, subject: 'Science', title: 'Habitats & Food Chains', coverColor: '#16a34a', slot: 2, isInteractive: true },
  { id: 'c4-b3', classLevel: 4, subject: 'Social', title: 'Landforms & Rivers', coverColor: '#6b21a8', slot: 3, isInteractive: true },
  { id: 'c4-b4', classLevel: 4, subject: 'English', title: 'Poetry & Prose', coverColor: '#991b1b', slot: 4, isInteractive: true },
  { id: 'c4-b5', classLevel: 4, subject: 'History', title: 'Ancient Kings', coverColor: '#b45309', slot: 5, isInteractive: true },

  // Class 5
  { id: 'c5-b1', classLevel: 5, subject: 'Math', title: 'Decimals & Percentages', coverColor: '#0284c7', slot: 1, isInteractive: true },
  { id: 'c5-b2', classLevel: 5, subject: 'Science', title: 'Human Body Systems', coverColor: '#15803d', slot: 2, isInteractive: true },
  { id: 'c5-b3', classLevel: 5, subject: 'History', title: 'Freedom Fighters', coverColor: '#b45309', slot: 3, isInteractive: true },
  { id: 'c5-b4', classLevel: 5, subject: 'Geography', title: 'Continents & Oceans', coverColor: '#0e7490', slot: 4, isInteractive: true },
  {
    id: 'ddia-c5',
    classLevel: 5,
    subject: 'Systems',
    title: 'Designing Data-Intensive Applications',
    subtitle: 'Reliable, Scalable, and Maintainable Systems',
    coverColor: '#b91c1c',
    accentColor: '#f87171',
    coverImage: '/books/ddia/cover.png',
    sourcePdf: '/books/ddia/Designing_Data_Intensive_Applications.pdf',
    icon: '🐗',
    slot: 5,
    isInteractive: true,
  },
]

/**
 * Catalog Service for the Immersive Bookshelf
 */
export const BOOK_CATALOG: BookItem[] = [
  // 1. Featured Book: Designing Data-Intensive Applications (Full 613 Pages Edition!)
  (ddiaBookJson as unknown as BookItem),

  // 2. Class 3 Mathematics
  {
    id: 'math-class-3',
    classGrade: 3,
    subject: 'Mathematics',
    title: 'Numbers and Counting',
    subtitle: 'Elementary Arithmetic & Place Values',
    coverColor: '#0284c7', // Sky Blue
    accentColor: '#38bdf8',
    icon: '📐',
    chapters: [
      {
        chapterNumber: 1,
        title: 'Numbers and Counting',
        description: 'Count numbers from 1 to 100, place values, and comparisons',
        pages: [
          {
            pageNumber: 1,
            header: 'Chapter 1: Numbers and Counting',
            subHeader: 'NCERT Class 3 Mathematics · Foundation Module',
            title: 'Learning Objectives',
            objectives: [
              'Count numbers from 1 to 100 confidently and accurately',
              'Understand place values (Ones, Tens, and Hundreds)',
              'Compare numbers using greater than (>) and less than (<)',
              'Solve simple visual addition and subtraction problems',
            ],
            tip: '💡 Tip: Grouping items into bundles of 10 makes counting much faster!',
            diagramType: 'math-counting',
            footerText: 'Page 1 of 3 · IRE Mathematics',
          },
          {
            pageNumber: 2,
            header: 'Chapter 1: Visual Addition & Practice',
            subHeader: 'Addition Concepts & Equation Solving',
            title: 'Visual Addition Equations',
            bulletPoints: [
              'Addition means putting two or more numbers together to find the total sum.',
              '5 + 3 = 8 (Combine 5 apples with 3 apples)',
              '7 + 2 = 9 (Count up 2 steps starting from 7)',
            ],
            formulaOrSummary: 'Sum = Addend 1 + Addend 2',
            diagramType: 'math-addition',
            footerText: 'Page 2 of 3 · IRE Mathematics',
          },
          {
            pageNumber: 3,
            header: 'Chapter 1: Practice & Counting Challenges',
            subHeader: 'Interactive Math Worksheets · Class 3',
            title: 'Test Your Skills',
            bulletPoints: [
              'Exercise 1: Write numbers from 21 to 30 in your notebook.',
              'Exercise 2: How many tens and ones are in the number 85?',
              'Exercise 3: Solve 14 + 6 and check using the number line.',
            ],
            formulaOrSummary: 'Practice makes math easy and fun!',
            tip: '💡 Tip: Always double check your sums by counting backwards!',
            footerText: 'Page 3 of 3 · IRE Mathematics',
          },
        ],
      },
    ],
  },

  // 3. Class 3 Science: Living Things
  {
    id: 'c3-b1',
    classGrade: 3,
    subject: 'Science',
    title: 'Living Things',
    subtitle: 'Plants, Animals & Living Systems',
    coverColor: '#15803d',
    accentColor: '#4ade80',
    icon: '🌱',
    chapters: [
      {
        chapterNumber: 1,
        title: 'Living vs Non-Living Things',
        description: 'Explore characteristics of living organisms',
        pages: [
          {
            pageNumber: 1,
            header: 'Chapter 1: Living Things',
            subHeader: 'Class 3 Science · Natural Science Module',
            title: 'Characteristics of Living Organisms',
            objectives: [
              'Living things can grow, breathe, and reproduce',
              'Living things need food, water, and sunlight to survive',
              'Living things respond to changes in their environment',
            ],
            tip: '💡 Study Tip: Plants are living things too—they breathe through tiny pores called stomata!',
            footerText: 'Page 1 of 2 · Science',
          },
          {
            pageNumber: 2,
            header: 'Chapter 1: Plants & Animal Habitats',
            subHeader: 'Ecosystems & Adaptations',
            title: 'How Organisms Survive',
            bulletPoints: [
              'Plants make their own food through photosynthesis using sunlight.',
              'Animals move around to search for food and shelter.',
              'All living things go through a natural life cycle.',
            ],
            formulaOrSummary: 'Living = Nutrition + Respiration + Growth',
            footerText: 'Page 2 of 2 · Science',
          },
        ],
      },
    ],
  },

  // 4. Class 2 Nature: Plants & Trees
  {
    id: 'c2-b2',
    classGrade: 2,
    subject: 'Nature',
    title: 'Plants & Trees',
    subtitle: 'Discovering the World of Greenery',
    coverColor: '#16a34a',
    accentColor: '#86efac',
    icon: '🌳',
    chapters: [
      {
        chapterNumber: 1,
        title: 'Parts of a Plant',
        description: 'Roots, stems, leaves, flowers and fruits',
        pages: [
          {
            pageNumber: 1,
            header: 'Chapter 1: Parts of a Plant',
            subHeader: 'Class 2 Nature Study · Green Foundations',
            title: 'Explore the Plant Anatomy',
            objectives: [
              'Roots hold the plant firmly in the soil and absorb water',
              'Stem carries water and food to all parts of the plant',
              'Leaves prepare food for the plant using sunlight',
            ],
            tip: '💡 Tip: Look closely at leaves around your house to see their unique veins!',
            footerText: 'Page 1 of 2 · Nature Study',
          },
          {
            pageNumber: 2,
            header: 'Chapter 1: Trees and Shrubs',
            subHeader: 'Types of Plants',
            title: 'Trees, Shrubs & Herbs',
            bulletPoints: [
              'Trees have strong woody trunks (like Banyan, Mango, Neem).',
              'Shrubs have medium woody stems (like Rose and Hibiscus).',
              'Herbs have soft green stems (like Mint and Coriander).',
            ],
            formulaOrSummary: 'Plants give us oxygen, food, and shade!',
            footerText: 'Page 2 of 2 · Nature Study',
          },
        ],
      },
    ],
  },

  // 5. Class 7 Science (Optics Module)
  {
    id: 'science-class-7',
    classGrade: 7,
    subject: 'Science',
    title: 'Light, Mirrors & Curved Optics',
    subtitle: 'Ray Diagrams, Reflection & Focal Points',
    coverColor: '#1e1b4b',
    accentColor: '#fbbf24',
    icon: '🔭',
    chapters: [
      {
        chapterNumber: 4,
        title: 'Light & Curved Mirrors',
        description: 'Laws of reflection, focal point calculations, and curved mirror properties',
        pages: [
          {
            pageNumber: 1,
            header: 'Chapter 4: Light & Curved Mirrors',
            subHeader: 'NCERT Class 7 Science · Core Concept Sheet',
            title: '1. Laws of Reflection',
            bulletPoints: [
              'The angle of incidence equals the angle of reflection (∠i = ∠r).',
              'The incident ray, normal, and reflected ray lie in the same plane.',
              'Real Image: Formed when rays actually converge. Can be captured on screen.',
              'Virtual Image: Formed when rays appear to diverge. Cannot be projected.',
            ],
            tip: '💡 Study Mate Tip: Concave mirrors can produce both real and virtual images!',
            diagramType: 'ray-optics',
            footerText: 'Page 1 of 2 · IRE Learning',
          },
          {
            pageNumber: 2,
            header: 'Chapter 4: Formulas & Quick Mind Map',
            subHeader: 'Key Optical Relationships & Exam Highlights',
            title: 'The Mirror Formula & Summary',
            formulaOrSummary: '1/f = 1/v + 1/u',
            bulletPoints: [
              'f = focal length | v = image distance | u = object distance',
              'Concave: Converging mirror, positive or negative focal points depending on sign convention',
              'Convex: Diverging mirror, always produces virtual, erect, and diminished images',
            ],
            footerText: 'Page 2 of 2 · IRE Learning',
          },
        ],
      },
    ],
  },
]

export const CLASS_SECTIONS: ClassSection[] = [
  {
    classNumber: 1,
    label: 'Class 1 & 2',
    sublabel: 'Foundations & Stories',
    shelfTierIndex: 0,
    books: [],
  },
  {
    classNumber: 3,
    label: 'Class 3 & 4',
    sublabel: 'Discovery & Systems',
    shelfTierIndex: 1,
    books: [BOOK_CATALOG[0]!, BOOK_CATALOG[1]!],
  },
  {
    classNumber: 5,
    label: 'Class 5 & 6',
    sublabel: 'Core Science & Architecture',
    shelfTierIndex: 2,
    books: [BOOK_CATALOG[0]!],
  },
  {
    classNumber: 7,
    label: 'Class 7 & 8',
    sublabel: 'Optics & Advanced',
    shelfTierIndex: 3,
    books: [BOOK_CATALOG[4]!],
  },
]

export const BookCatalogService = {
  getAllBooks(): BookItem[] {
    return BOOK_CATALOG
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
        subtitle: `Class ${shelfBook.classLevel} ${shelfBook.subject} Curriculum`,
        coverColor: shelfBook.coverColor || '#0284c7',
        accentColor: '#38bdf8',
        icon: '📖',
        chapters: [
          {
            chapterNumber: 1,
            title: shelfBook.title,
            description: `Fundamental lessons in ${shelfBook.subject}`,
            pages: [
              {
                pageNumber: 1,
                header: `Chapter 1: ${shelfBook.title}`,
                subHeader: `NCERT Class ${shelfBook.classLevel} ${shelfBook.subject} · Core Module`,
                title: 'Key Learning Objectives',
                objectives: [
                  `Master the core concepts of ${shelfBook.title}`,
                  `Understand foundational principles through real-world examples`,
                  `Complete guided practice exercises and chapter quizzes`,
                ],
                tip: `💡 Study Mate Tip: Review your study notes at the end of each session!`,
                footerText: `Page 1 of 2 · ${shelfBook.subject}`,
              },
              {
                pageNumber: 2,
                header: `Chapter 1: Core Principles & Summary`,
                subHeader: `Illustrated Concepts & Practice`,
                title: `${shelfBook.title} - Key Takeaways`,
                bulletPoints: [
                  `Key definitions and principles of ${shelfBook.title}.`,
                  `Study the diagrams, tables, and concept mind-maps.`,
                  `Prepare for the interactive chapter test in the Deep Dive module.`,
                ],
                formulaOrSummary: `Summary: Essential foundations of ${shelfBook.title}`,
                footerText: `Page 2 of 2 · ${shelfBook.subject}`,
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
    return BOOK_CATALOG.filter((b) => b.classGrade === classGrade)
  },

  getDefaultBook(): BookItem {
    return BOOK_CATALOG[0]!
  },

  getClassSections(): ClassSection[] {
    return CLASS_SECTIONS
  },
}
