import type { BookItem, BookChapterData, BookPageData, ImmersiveBookData } from '~/types/learning-journey'

/**
 * BookLoaderService
 * Facilitates dynamic loading and parsing of external books from /books/[id]/
 * Supports:
 * - Pre-parsed lightning-fast JSON (book.json)
 * - Human-readable Markdown with YAML Frontmatter (book.md)
 * - Direct PDF asset references (sourcePdf)
 */
export const BookLoaderService = {
  /**
   * Parses Markdown content formatted with YAML frontmatter and page sections
   */
  parseMarkdownBook(markdownText: string): BookItem {
    let metadata: Record<string, any> = {}
    let body = markdownText

    // 1. Extract Frontmatter if present
    if (markdownText.startsWith('---')) {
      const parts = markdownText.split('---')
      if (parts.length >= 3) {
        const yamlText = parts[1] || ''
        body = parts.slice(2).join('---')

        yamlText.split('\n').forEach((line) => {
          const colonIdx = line.indexOf(':')
          if (colonIdx !== -1) {
            const key = line.slice(0, colonIdx).trim()
            let val = line.slice(colonIdx + 1).trim()
            val = val.replace(/^["']|["']$/g, '') // strip quotes
            if (val === 'true') metadata[key] = true
            else if (val === 'false') metadata[key] = false
            else if (!isNaN(Number(val)) && val !== '') metadata[key] = Number(val)
            else metadata[key] = val
          }
        })
      }
    }

    // 2. Extract Pages delimited by <!-- Page X --> or ## Chapter headers
    const pages: BookPageData[] = []
    const rawPages = body.split(/<!--\s*Page\s*\d+\s*-->/i).filter((s) => s.trim().length > 0)

    rawPages.forEach((raw, idx) => {
      const pageNum = idx + 1
      const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)

      let header = `Chapter 1: ${metadata.title || 'Overview'}`
      let subHeader = `${metadata.subject || 'Study Module'} · Page ${pageNum}`
      let title = `Topic ${pageNum}`
      const bulletPoints: string[] = []
      const objectives: string[] = []
      let tip = ''
      let formulaOrSummary = ''
      let footerText = `Page ${pageNum} · ${metadata.title || 'Learning Journey'}`

      let currentSection = ''

      lines.forEach((line) => {
        if (line.startsWith('## ')) {
          header = line.replace('## ', '').trim()
        } else if (line.startsWith('### ')) {
          title = line.replace('### ', '').trim()
        } else if (line.startsWith('**Learning Objectives:**')) {
          currentSection = 'objectives'
        } else if (line.startsWith('**Key Concepts:**')) {
          currentSection = 'bullets'
        } else if (line.startsWith('**Formula/Summary:**')) {
          formulaOrSummary = line.replace('**Formula/Summary:**', '').replace(/`/g, '').trim()
        } else if (line.startsWith('> ')) {
          tip = line.replace('> ', '').trim()
        } else if (line.startsWith('*Footer:')) {
          footerText = line.replace('*Footer:', '').replace(/\*/g, '').trim()
        } else if (line.startsWith('- ')) {
          const item = line.replace('- ', '').trim()
          if (currentSection === 'objectives') {
            objectives.push(item)
          } else {
            bulletPoints.push(item)
          }
        }
      })

      pages.push({
        pageNumber: pageNum,
        header,
        subHeader,
        title,
        objectives: objectives.length > 0 ? objectives : undefined,
        bulletPoints: bulletPoints.length > 0 ? bulletPoints : undefined,
        formulaOrSummary: formulaOrSummary || undefined,
        tip: tip || undefined,
        footerText,
      })
    })

    const bookItem: BookItem = {
      id: metadata.id || 'custom-book',
      classGrade: metadata.classLevel || 5,
      subject: metadata.subject || 'General',
      title: metadata.title || 'Untitled Book',
      subtitle: metadata.subtitle || 'Modular Digital Curriculum',
      coverColor: metadata.coverColor || '#b91c1c',
      accentColor: metadata.accentColor || '#f87171',
      icon: metadata.icon || '📖',
      chapters: [
        {
          chapterNumber: 1,
          title: metadata.title || 'Chapter 1',
          description: metadata.subtitle || 'Interactive Book Curriculum',
          pages: pages.length > 0 ? pages : [
            {
              pageNumber: 1,
              header: metadata.title || 'Chapter 1',
              subHeader: `${metadata.subject || 'Curriculum'} · Introduction`,
              title: 'Overview',
              bulletPoints: ['Welcome to this interactive edition.'],
              footerText: 'Page 1 of 1',
            },
          ],
        },
      ],
    }

    return bookItem
  },

  /**
   * Dynamically fetch and register a book from /public/books/[folder]/
   */
  async loadBook(folder: string): Promise<BookItem | null> {
    try {
      // Priority 1: JSON manifest (Fastest, zero parsing overhead)
      const resJson = await fetch(`/books/${folder}/book.json`)
      if (resJson.ok) {
        return (await resJson.json()) as BookItem
      }

      // Priority 2: Markdown file (Human editable)
      const resMd = await fetch(`/books/${folder}/book.md`)
      if (resMd.ok) {
        const text = await resMd.text()
        return this.parseMarkdownBook(text)
      }
    } catch (err) {
      console.warn(`[BookLoaderService] Could not load book from /books/${folder}:`, err)
    }
    return null
  },
}
