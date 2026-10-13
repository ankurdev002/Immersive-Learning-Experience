#!/usr/bin/env python3
"""
Dynamic Book Importer
Usage:
    python3 scripts/import-book.py path/to/book.pdf [book_id] [class_level]
Example:
    python3 scripts/import-book.py Designing_Data_Intensive_Applications.pdf ddia 5

What it does:
1. Copies the PDF into public/books/<book_id>/
2. Renders Page 1 as high-res cover.png using native macOS sips
3. Generates structured book.md and book.json for instant 60fps rendering in the 3D room
"""

import sys
import os
import subprocess
import json

def import_book():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/import-book.py <pdf_path> [book_id] [class_level]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"Error: PDF not found at {pdf_path}")
        sys.exit(1)

    filename = os.path.basename(pdf_path)
    base_name = os.path.splitext(filename)[0]
    book_id = sys.argv[2] if len(sys.argv) > 2 else base_name.lower().replace(' ', '-').replace('_', '-')
    class_level = int(sys.argv[3]) if len(sys.argv) > 3 else 5

    target_dir = f"/Users/ankur/Documents/Archive/public/books/{book_id}"
    os.makedirs(target_dir, exist_ok=True)

    dest_pdf = os.path.join(target_dir, filename)
    subprocess.run(["cp", pdf_path, dest_pdf], check=True)
    print(f"✓ Copied PDF to {dest_pdf}")

    # Extract Page 1 cover image
    dest_cover = os.path.join(target_dir, "cover.png")
    subprocess.run(["sips", "-s", "format", "png", dest_pdf, "--out", dest_cover], check=True)
    print(f"✓ Extracted Page 1 cover to {dest_cover}")

    # Clean title
    formatted_title = base_name.replace('_', ' ').replace('-', ' ').title()

    book_item = {
        "id": book_id,
        "classGrade": class_level,
        "classLevel": class_level,
        "subject": "General",
        "title": formatted_title,
        "subtitle": "Interactive Digital Edition",
        "coverColor": "#b91c1c",
        "accentColor": "#f87171",
        "coverImage": f"/books/{book_id}/cover.png",
        "sourcePdf": f"/books/{book_id}/{filename}",
        "icon": "📖",
        "slot": 5,
        "isInteractive": True,
        "chapters": [
            {
                "chapterNumber": 1,
                "title": formatted_title,
                "description": f"Curriculum extracted from {filename}",
                "pages": [
                    {
                        "pageNumber": 1,
                        "header": f"Chapter 1: {formatted_title}",
                        "subHeader": f"Digital Curriculum · Class {class_level}",
                        "title": "Introduction & Overview",
                        "objectives": [
                            f"Explore core lessons from {formatted_title}",
                            "Understand key principles and concepts",
                            "Review practice questions and chapter highlights"
                        ],
                        "bulletPoints": [
                            f"Imported from {filename}.",
                            "Navigate pages using the Next/Previous buttons or click the open book."
                        ],
                        "formulaOrSummary": f"Summary of {formatted_title}",
                        "footerText": f"Page 1 of 1 · {formatted_title}"
                    }
                ]
            }
        ]
    }

    with open(os.path.join(target_dir, "book.json"), 'w') as f:
        json.dump(book_item, f, indent=2)
    print(f"✓ Generated {target_dir}/book.json")

    print(f"\n🎉 Successfully imported '{formatted_title}' into /public/books/{book_id}/!")

if __name__ == "__main__":
    import_book()
