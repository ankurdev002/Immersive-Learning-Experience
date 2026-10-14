import os
import sys
import json
import urllib.request
import ssl
import subprocess
import pypdf
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_DIR = "/Users/ankur/Documents/Archive/public/books"
os.makedirs(BASE_DIR, exist_ok=True)

BOOKS_TO_IMPORT = [
    {
        "id": "system-arch",
        "url": "https://www.gaudisite.nl/SystemArchitectureBook.pdf",
        "filename": "SystemArchitectureBook.pdf",
        "classLevel": 5,
        "classGrade": 5,
        "subject": "System Architecture",
        "title": "Systems Architecting",
        "subtitle": "A Business-Enabling Engineering Discipline",
        "author": "Gerrit Muller",
        "coverColor": "#1e3a8a",
        "accentColor": "#60a5fa",
        "icon": "🏛️"
    },
    {
        "id": "comp-arch",
        "url": "https://www.mbit.edu.in/wp-content/uploads/2020/05/computer-systems-Architecture.pdf",
        "filename": "computer-systems-Architecture.pdf",
        "classLevel": 5,
        "classGrade": 5,
        "subject": "Computer Systems",
        "title": "Computer System Architecture",
        "subtitle": "Hardware Organization & Architecture (3rd Ed)",
        "author": "M. Morris Mano",
        "coverColor": "#065f46",
        "accentColor": "#34d399",
        "icon": "💻"
    },
    {
        "id": "mpmc",
        "url": "https://adityaeeeb.weebly.com/uploads/4/2/0/0/42007913/mpmc_textbook_godse.pdf",
        "filename": "mpmc_textbook_godse.pdf",
        "classLevel": 5,
        "classGrade": 5,
        "subject": "Microprocessors",
        "title": "Microprocessors & Microcontrollers",
        "subtitle": "8086, 8051 & ARM System Architecture",
        "author": "A.P. Godse & D.A. Godse",
        "coverColor": "#9a3412",
        "accentColor": "#fb923c",
        "icon": "⚡"
    },
    {
        "id": "dsa-aho",
        "url": "https://users.dcc.uchile.cl/~voyanede/cc4102/dS&A%20Book%20By%20Alfred%20-Aho.pdf",
        "filename": "dsa_aho_hopcroft_ullman.pdf",
        "classLevel": 5,
        "classGrade": 5,
        "subject": "Algorithms",
        "title": "Data Structures and Algorithms",
        "subtitle": "Design, Analysis & Complexity",
        "author": "Alfred V. Aho, John E. Hopcroft, Jeffrey D. Ullman",
        "coverColor": "#4338ca",
        "accentColor": "#818cf8",
        "icon": "🌲"
    },
    # NCERT Class 1 Books
    {
        "id": "ncert-c1-math",
        "url": "https://archive.org/download/ncert-aemh1/aemh101.pdf",
        "cover_url": "https://archive.org/download/ncert-aemh1/aemh1ps.pdf",
        "filename": "ncert_class1_math_magic.pdf",
        "classLevel": 1,
        "classGrade": 1,
        "subject": "Mathematics",
        "title": "Math-Magic (Class 1)",
        "subtitle": "NCERT Joyful Mathematics & Shapes",
        "author": "NCERT",
        "coverColor": "#0284c7",
        "accentColor": "#38bdf8",
        "icon": "🔢"
    },
    {
        "id": "ncert-c1-english",
        "url": "https://archive.org/download/ncert-aeen1/aeen101.pdf",
        "cover_url": "https://archive.org/download/ncert-aeen1/aeen1ps.pdf",
        "filename": "ncert_class1_marigold.pdf",
        "classLevel": 1,
        "classGrade": 1,
        "subject": "English",
        "title": "Marigold (Class 1)",
        "subtitle": "NCERT English Stories & Rhymes",
        "author": "NCERT",
        "coverColor": "#c2410c",
        "accentColor": "#fb923c",
        "icon": "🌸"
    },
    # NCERT Class 2 Books
    {
        "id": "ncert-c2-math",
        "url": "https://archive.org/download/ncert-bemh1/bemh101.pdf",
        "cover_url": "https://archive.org/download/ncert-bemh1/bemh1ps.pdf",
        "filename": "ncert_class2_math_magic.pdf",
        "classLevel": 2,
        "classGrade": 2,
        "subject": "Mathematics",
        "title": "Math-Magic (Class 2)",
        "subtitle": "NCERT Addition, Counting & Shapes",
        "author": "NCERT",
        "coverColor": "#0369a1",
        "accentColor": "#38bdf8",
        "icon": "➕"
    },
    {
        "id": "ncert-c2-english",
        "url": "https://archive.org/download/ncert-been1/been101.pdf",
        "cover_url": "https://archive.org/download/ncert-been1/been1ps.pdf",
        "filename": "ncert_class2_marigold.pdf",
        "classLevel": 2,
        "classGrade": 2,
        "subject": "English",
        "title": "Marigold (Class 2)",
        "subtitle": "NCERT Stories, Friends & Poetry",
        "author": "NCERT",
        "coverColor": "#b45309",
        "accentColor": "#fde047",
        "icon": "📖"
    },
    # NCERT Class 3 Books
    {
        "id": "ncert-c3-math",
        "url": "https://archive.org/download/ncert-cemh1/cemh101.pdf",
        "cover_url": "https://archive.org/download/ncert-cemh1/cemh1ps.pdf",
        "filename": "ncert_class3_math_magic.pdf",
        "classLevel": 3,
        "classGrade": 3,
        "subject": "Mathematics",
        "title": "Math-Magic (Class 3)",
        "subtitle": "NCERT Multiplication, Place Values & Time",
        "author": "NCERT",
        "coverColor": "#15803d",
        "accentColor": "#4ade80",
        "icon": "📐"
    },
    {
        "id": "ncert-c3-evs",
        "url": "https://archive.org/download/ncert-ceap1/ceap101.pdf",
        "cover_url": "https://archive.org/download/ncert-ceap1/ceap1ps.pdf",
        "filename": "ncert_class3_looking_around.pdf",
        "classLevel": 3,
        "classGrade": 3,
        "subject": "Environmental Studies",
        "title": "Looking Around (Class 3)",
        "subtitle": "NCERT Science, Nature & Plants",
        "author": "NCERT",
        "coverColor": "#047857",
        "accentColor": "#34d399",
        "icon": "🌿"
    },
    # NCERT Class 4 Books
    {
        "id": "ncert-c4-math",
        "url": "https://archive.org/download/ncert-demh1/demh101.pdf",
        "cover_url": "https://archive.org/download/ncert-demh1/demh1ps.pdf",
        "filename": "ncert_class4_math_magic.pdf",
        "classLevel": 4,
        "classGrade": 4,
        "subject": "Mathematics",
        "title": "Math-Magic (Class 4)",
        "subtitle": "NCERT Fractions, Building with Bricks & Division",
        "author": "NCERT",
        "coverColor": "#1d4ed8",
        "accentColor": "#60a5fa",
        "icon": "🧮"
    },
    {
        "id": "ncert-c4-evs",
        "url": "https://archive.org/download/ncert-deap1/deap101.pdf",
        "cover_url": "https://archive.org/download/ncert-deap1/deap1ps.pdf",
        "filename": "ncert_class4_looking_around.pdf",
        "classLevel": 4,
        "classGrade": 4,
        "subject": "Environmental Studies",
        "title": "Looking Around (Class 4)",
        "subtitle": "NCERT Going to School, Animals & Rivers",
        "author": "NCERT",
        "coverColor": "#0f766e",
        "accentColor": "#2dd4bf",
        "icon": "🌍"
    }
]

def download_file(url, target_path):
    if os.path.exists(target_path) and os.path.getsize(target_path) > 1000:
        print(f"  Already downloaded: {os.path.basename(target_path)} ({os.path.getsize(target_path)} bytes)")
        return True
    print(f"  Downloading from {url} ...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60, context=ctx) as resp, open(target_path, 'wb') as f:
            f.write(resp.read())
        print(f"  ✓ Saved to {target_path} ({os.path.getsize(target_path)} bytes)")
        return True
    except Exception as e:
        print(f"  ✗ Download error for {url}: {e}")
        return False

def clean_page_text(raw_text):
    # Replace weird square symbols / control chars
    text = raw_text.replace('\u0000', '').replace('□', ' ')
    # Normalize multiple whitespaces
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return lines

def process_book(b):
    book_id = b["id"]
    book_dir = os.path.join(BASE_DIR, book_id)
    os.makedirs(book_dir, exist_ok=True)
    pdf_path = os.path.join(book_dir, b["filename"])

    print(f"\n================ Processing '{b['title']}' ({book_id}) ================")
    
    # 1. Download PDF
    ok = download_file(b["url"], pdf_path)
    if not ok:
        print(f"Skipping {book_id} due to download failure.")
        return

    # 2. Extract Cover
    cover_png = os.path.join(book_dir, "cover.png")
    if not os.path.exists(cover_png) or os.path.getsize(cover_png) == 0:
        # Check if cover_url exists
        if "cover_url" in b:
            cover_pdf = os.path.join(book_dir, "cover_source.pdf")
            download_file(b["cover_url"], cover_pdf)
            subprocess.run(["sips", "-s", "format", "png", cover_pdf, "--out", cover_png], capture_output=True)
        if not os.path.exists(cover_png) or os.path.getsize(cover_png) == 0:
            subprocess.run(["sips", "-s", "format", "png", pdf_path, "--out", cover_png], capture_output=True)
        print(f"  ✓ Extracted cover to {cover_png}")

    # 3. Parse PDF Pages
    try:
        reader = pypdf.PdfReader(pdf_path)
        num_pages = len(reader.pages)
        print(f"  ✓ PDF has {num_pages} pages")
    except Exception as e:
        print(f"  ✗ PDF read error: {e}")
        return

    # Build pages array
    pages_list = []
    # Extract up to 20 rich pages (or full book if under 20 pages) for immediate interactive reading
    max_pages_to_extract = min(num_pages, 50)
    
    for p_idx in range(max_pages_to_extract):
        p_num = p_idx + 1
        try:
            raw_text = reader.pages[p_idx].extract_text() or ""
        except Exception:
            raw_text = ""
        
        lines = clean_page_text(raw_text)
        
        # Determine Title, Header, Subheader, Bullets
        header = f"{b['title']}"
        sub_header = f"{b['author']} · {b['subject']}"
        title = ""
        bullet_points = []
        
        if lines:
            # First clean line as title
            title = lines[0][:80]
            # Group remaining lines into sensible paragraphs/bullet points
            current_bullet = []
            for line in lines[1:]:
                # If short header-like line or starts with bullet/number
                if len(current_bullet) >= 3 or len(' '.join(current_bullet)) > 240:
                    bullet_points.append(' '.join(current_bullet))
                    current_bullet = [line]
                else:
                    current_bullet.append(line)
            if current_bullet:
                bullet_points.append(' '.join(current_bullet))
        else:
            title = f"Chapter {p_num}"
            bullet_points = [
                f"Page {p_num} from {b['title']}.",
                "Read through illustrations, tables, and exercises.",
                "Turn pages using Next / Previous or click the open book."
            ]

        # Clean bullet points: limit to top 4 bullets to prevent visual overlap
        clean_bullets = [bp for bp in bullet_points if len(bp) > 5][:4]
        if not clean_bullets:
            clean_bullets = [f"Curriculum concepts from {b['title']}."]

        page_entry = {
            "pageNumber": p_num,
            "header": header,
            "subHeader": sub_header,
            "title": title or f"Section {p_num}",
            "bulletPoints": clean_bullets,
            "footerText": f"Page {p_num} of {num_pages} · {b['title']}"
        }
        pages_list.append(page_entry)

    book_json_data = {
        "id": b["id"],
        "classGrade": b["classGrade"],
        "classLevel": b["classLevel"],
        "subject": b["subject"],
        "title": b["title"],
        "subtitle": b["subtitle"],
        "author": b["author"],
        "coverColor": b["coverColor"],
        "accentColor": b["accentColor"],
        "coverImage": f"/books/{b['id']}/cover.png",
        "sourcePdf": f"/books/{b['id']}/{b['filename']}",
        "icon": b["icon"],
        "isInteractive": True,
        "totalPages": num_pages,
        "chapters": [
            {
                "chapterNumber": 1,
                "title": b["title"],
                "description": b["subtitle"],
                "pages": pages_list
            }
        ]
    }

    json_path = os.path.join(book_dir, "book.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(book_json_data, f, indent=2, ensure_ascii=False)
    print(f"  ✓ Generated {json_path} with {len(pages_list)} interactive pages!")

def main():
    print("Starting automated download and asset generation for real books...")
    for b in BOOKS_TO_IMPORT:
        process_book(b)
    print("\n🎉 All books imported successfully!")

if __name__ == "__main__":
    main()
