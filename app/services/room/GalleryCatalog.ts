/**
 * Exhibits of the upstairs art gallery: what each piece is, how it's displayed, and the short history
 * shown in its reading book. Images are public-domain scans from Wikimedia Commons (see
 * public/gallery/CREDITS.md).
 */

export type ExhibitKind = 'screen' | 'scroll' | 'frame' | 'handscroll' | 'armour' | 'katana'

export interface ExhibitSection {
  heading: string
  body: string
}

export interface GalleryExhibitInfo {
  id: string
  kind: ExhibitKind
  /** /public path of the artwork (absent for the 3D armour and sword) */
  image?: string
  /** Image width / height */
  aspect: number
  title: string
  titleJp: string
  artist: string
  date: string
  medium: string
  collection: string
  /** Large character shown in place of a picture for the 3D objects */
  glyph?: string
  sections: ExhibitSection[]
}

export const GALLERY_EXHIBITS: GalleryExhibitInfo[] = [
  {
    id: 'pine-trees',
    kind: 'screen',
    image: '/gallery/pine-trees.webp',
    aspect: 1280 / 599,
    title: 'Pine Trees',
    titleJp: '松林図屏風',
    artist: 'Hasegawa Tōhaku (1539–1610)',
    date: 'Late 16th century, Momoyama period',
    medium: 'Pair of six-panel folding screens, ink on paper',
    collection: 'Tokyo National Museum · National Treasure',
    sections: [
      {
        heading: 'Pines in the mist',
        body: 'A grove of pines appears and dissolves in morning fog. Tōhaku painted it with nothing but black ink on paper, leaving most of the surface empty so the mist itself becomes the subject.',
      },
      {
        heading: 'The artist',
        body: 'Hasegawa Tōhaku came to Kyoto from the Noto peninsula and rivalled the powerful Kanō school with his own studio. He studied Chinese ink painting, especially the soft, misty style of the Song dynasty painter Muqi.',
      },
      {
        heading: 'A new kind of painting',
        body: 'Gold-leaf screens were the fashion of the Momoyama warlords. Pine Trees did the opposite: quiet, monochrome and almost abstract. It is often called the first great ink landscape painted in a fully Japanese spirit.',
      },
      {
        heading: 'Did you know?',
        body: 'The paper joins of the screens do not line up perfectly, and some scholars think the work began as a full-size study rather than a finished commission. Today it is one of the most loved paintings in Japan.',
      },
    ],
  },
  {
    id: 'haboku',
    kind: 'scroll',
    image: '/gallery/haboku.webp',
    aspect: 828 / 1280,
    title: 'Splashed-Ink Landscape (Haboku Sansui)',
    titleJp: '破墨山水図',
    artist: 'Sesshū Tōyō (1420–1506)',
    date: '1495, Muromachi period',
    medium: 'Hanging scroll, ink on paper',
    collection: 'Tokyo National Museum · National Treasure',
    sections: [
      {
        heading: 'Broken ink',
        body: '"Haboku" means splashed or broken ink. With a few wet strokes Sesshū suggests mountains, a village and a fisherman\'s boat; the shapes form in the eye of the viewer rather than on the paper.',
      },
      {
        heading: 'A Zen painter-monk',
        body: 'Sesshū trained as a Zen monk at Shōkoku-ji in Kyoto. In 1467 he sailed to Ming China, where he studied landscapes first-hand and was honoured at a Chinese monastery before returning to Japan.',
      },
      {
        heading: 'A painted certificate',
        body: 'He painted this scroll at about seventy-five as a parting gift for his pupil Josui Sōen. His long inscription at the top describes his studies in China, making the work both a lesson and a certificate of mastery.',
      },
      {
        heading: 'Did you know?',
        body: 'The inscriptions above the painting were added by six Zen monks from Kyoto temples. Sesshū is considered the greatest Japanese master of ink painting.',
      },
    ],
  },
  {
    id: 'wind-thunder-gods',
    kind: 'screen',
    image: '/gallery/wind-thunder-gods.webp',
    aspect: 1280 / 576,
    title: 'Wind God and Thunder God',
    titleJp: '風神雷神図屏風',
    artist: 'Tawaraya Sōtatsu (c. 1570 – c. 1640)',
    date: 'Early 17th century, Edo period',
    medium: 'Pair of two-panel folding screens, ink and colour on gold leaf',
    collection: 'Kennin-ji temple, Kyoto · National Treasure',
    sections: [
      {
        heading: 'Gods of the sky',
        body: 'Fūjin, the green wind god, carries a bag of winds over his shoulders. Raijin, the white thunder god, beats a ring of drums. They race across a field of gold that stands for endless sky.',
      },
      {
        heading: 'The artist',
        body: 'Sōtatsu ran a fan-painting shop in Kyoto and worked with the calligrapher Hon\'ami Kōetsu. Together they founded the decorative style later called Rinpa: bold shapes, gold and silver, and wide empty spaces.',
      },
      {
        heading: 'A painting copied for centuries',
        body: 'About a hundred years later Ogata Kōrin painted his own copy, and in the 19th century Sakai Hōitsu copied Kōrin\'s. Each generation of Rinpa artists honoured the founder by repeating this image.',
      },
      {
        heading: 'Did you know?',
        body: 'The gods are placed at the very edges of the screens. The empty gold between them seems to fill with wind and thunder when the two screens are opened side by side.',
      },
    ],
  },
  {
    id: 'sudden-shower',
    kind: 'scroll',
    image: '/gallery/sudden-shower.webp',
    aspect: 845 / 1280,
    title: 'Sudden Shower over Shin-Ōhashi Bridge and Atake',
    titleJp: '大はしあたけの夕立',
    artist: 'Utagawa Hiroshige (1797–1858)',
    date: '1857, Edo period',
    medium: 'Woodblock print, ink and colour on paper (mounted as a scroll)',
    collection: 'From "One Hundred Famous Views of Edo"',
    sections: [
      {
        heading: 'Caught in the rain',
        body: 'Travellers hurry across the long wooden bridge over the Sumida river as a summer storm falls in thin dark lines. A lone raft drifts below, and the far bank of Atake fades into grey.',
      },
      {
        heading: 'The artist',
        body: 'Hiroshige was the great landscape master of Edo woodblock prints. His series of famous places along the Tōkaidō road and around Edo sold in huge numbers to ordinary townspeople.',
      },
      {
        heading: 'How the rain was printed',
        body: 'Every rain line was cut into a separate wooden block. Two layers of lines at slightly different angles make the shower look as if it is moving, a remarkable feat of the block cutter\'s skill.',
      },
      {
        heading: 'Did you know?',
        body: 'Vincent van Gogh painted a copy of this print in 1887, called "Bridge in the Rain (after Hiroshige)". Japanese prints like this one changed the way European artists composed their pictures.',
      },
    ],
  },
  {
    id: 'irises',
    kind: 'screen',
    image: '/gallery/irises.webp',
    aspect: 1280 / 535,
    title: 'Irises',
    titleJp: '燕子花図屏風',
    artist: 'Ogata Kōrin (1658–1716)',
    date: 'c. 1701–1705, Edo period',
    medium: 'Pair of six-panel folding screens, ink and colour on gold leaf',
    collection: 'Nezu Museum, Tokyo · National Treasure',
    sections: [
      {
        heading: 'A garden of gold',
        body: 'Clumps of blue-violet irises march across a plain gold ground. There is no water, bridge or sky: just flowers and rhythm, painted in only two colours of mineral pigment.',
      },
      {
        heading: 'The artist',
        body: 'Kōrin was the son of a wealthy Kyoto textile merchant. He grew up surrounded by fine kimono designs, and that sense of pattern shaped his painting. He revived the Rinpa style of Sōtatsu.',
      },
      {
        heading: 'A story in flowers',
        body: 'The irises recall a famous episode of the 10th-century Tales of Ise, where a traveller rests at Yatsuhashi, the "Eight Bridges", beside a marsh of irises and writes a poem of longing for his home.',
      },
      {
        heading: 'Did you know?',
        body: 'Several clumps repeat exactly, as if a stencil had been used, giving the screens the rhythm of a textile. The Nezu Museum shows them each spring, when real irises bloom in its garden.',
      },
    ],
  },
  {
    id: 'yoritomo',
    kind: 'scroll',
    image: '/gallery/yoritomo.webp',
    aspect: 1027 / 1280,
    title: 'Portrait traditionally of Minamoto no Yoritomo',
    titleJp: '伝源頼朝像',
    artist: 'Attributed to Fujiwara no Takanobu',
    date: '12th–14th century',
    medium: 'Hanging scroll, colour on silk',
    collection: 'Jingo-ji temple, Kyoto · National Treasure',
    sections: [
      {
        heading: 'The first shogun',
        body: 'Minamoto no Yoritomo (1147–1199) won the Genpei War against the Taira clan and in 1192 became shogun, founding the Kamakura shogunate. For almost seven centuries after him, warriors ruled Japan.',
      },
      {
        heading: 'A courtly warrior',
        body: 'The sitter wears stiff black court robes and holds a ceremonial baton. The robe is painted as a bold geometric shape, while the face is drawn with fine, realistic lines.',
      },
      {
        heading: 'A famous question',
        body: 'For centuries this was believed to be Yoritomo himself. Some historians now argue it shows Ashikaga Tadayoshi, a 14th-century lord, which would make the painting about 150 years younger.',
      },
      {
        heading: 'Did you know?',
        body: 'Whoever the sitter is, the portrait is one of the masterpieces of Japanese realistic portraiture (nise-e) and appears in nearly every Japanese history textbook as "Yoritomo".',
      },
    ],
  },
  {
    id: 'great-wave',
    kind: 'frame',
    image: '/gallery/great-wave.webp',
    aspect: 1280 / 882,
    title: 'The Great Wave off Kanagawa',
    titleJp: '神奈川沖浪裏',
    artist: 'Katsushika Hokusai (1760–1849)',
    date: 'c. 1830–1832, Edo period',
    medium: 'Woodblock print, ink and colour on paper',
    collection: 'From "Thirty-six Views of Mount Fuji"',
    sections: [
      {
        heading: 'The wave',
        body: 'A giant wave curls like a claw over three narrow boats carrying fish to the markets of Edo. Far away, small and calm, Mount Fuji sits beneath the crest as if it were another wave.',
      },
      {
        heading: 'The artist',
        body: 'Hokusai made more than 30,000 pictures in his long life and changed his name over thirty times. He was about seventy when he designed this print, and he said he was only beginning to understand nature.',
      },
      {
        heading: 'A new blue',
        body: 'The deep blue is Prussian blue, a pigment newly imported through Dutch traders. It did not fade and printed brilliantly, and Hokusai\'s publisher used it to make the series stand out.',
      },
      {
        heading: 'Did you know?',
        body: 'Thousands of impressions were printed from the original blocks. The image inspired European painters and composers; Claude Debussy put it on the cover of his orchestral work "La Mer".',
      },
    ],
  },
  {
    id: 'red-fuji',
    kind: 'frame',
    image: '/gallery/red-fuji.webp',
    aspect: 1280 / 854,
    title: 'Fine Wind, Clear Morning ("Red Fuji")',
    titleJp: '凱風快晴',
    artist: 'Katsushika Hokusai (1760–1849)',
    date: 'c. 1830–1832, Edo period',
    medium: 'Woodblock print, ink and colour on paper',
    collection: 'From "Thirty-six Views of Mount Fuji"',
    sections: [
      {
        heading: 'Fuji at dawn',
        body: 'On a clear late-summer morning a gentle south wind blows, and the first sunlight turns Mount Fuji a deep red. Lines of small clouds float in a blue sky above the dark forests at its foot.',
      },
      {
        heading: 'A sacred mountain',
        body: 'Fuji was believed to hold the secret of immortality, and climbing it was a religious pilgrimage. Hokusai\'s series of views fed a craze for the mountain among the people of Edo.',
      },
      {
        heading: 'Simplicity',
        body: 'The print uses only a few colours and one great triangle. With The Great Wave and "Thunderstorm Beneath the Summit" it forms the three most famous prints of the series.',
      },
      {
        heading: 'Did you know?',
        body: 'Early impressions show a soft gradient from red to brown on the mountain, made by wiping ink across the block by hand. Later impressions are often printed in harsher, flatter colours.',
      },
    ],
  },
  {
    id: 'samurai-beato',
    kind: 'frame',
    image: '/gallery/samurai-beato.webp',
    aspect: 1020 / 1280,
    title: 'Samurai with Sword',
    titleJp: '刀を持つ侍',
    artist: 'Felice Beato (1832–1909)',
    date: '1860s, end of the Edo period',
    medium: 'Hand-coloured albumen print photograph',
    collection: 'Public domain photograph',
    sections: [
      {
        heading: 'The last samurai on film',
        body: 'This is one of the very first photographs of a samurai. It was taken in the 1860s, only a few years before the samurai class was abolished and the old world of the shoguns disappeared.',
      },
      {
        heading: 'The photographer',
        body: 'Felice Beato, an Italian-British photographer, opened a studio in Yokohama in 1863. He photographed people, landscapes and daily life across Japan and sold albums to foreign visitors.',
      },
      {
        heading: 'Painted photographs',
        body: 'Photographs were black and white, so Japanese artists in the studio painted colour onto each print by hand. This combination of camera and brush became known as "Yokohama photography".',
      },
      {
        heading: 'Did you know?',
        body: 'In 1876 the Meiji government banned the wearing of swords in public (the Haitōrei edict). Pictures like this one preserve a way of dressing that vanished within a generation.',
      },
    ],
  },
  {
    id: 'samurai-armour',
    kind: 'frame',
    image: '/gallery/samurai-armour.webp',
    aspect: 1280 / 969,
    title: 'Samurai in Armour',
    titleJp: '鎧武者',
    artist: 'Kusakabe Kimbei (1841–1934)',
    date: '1880s, Meiji period',
    medium: 'Hand-coloured albumen print photograph',
    collection: 'Public domain photograph',
    sections: [
      {
        heading: 'Dressed for battle',
        body: 'A warrior poses in full armour with helmet, bow and swords. By the time this photograph was made, armour was no longer worn in war, and these portraits recreated the look of the old samurai.',
      },
      {
        heading: 'The photographer',
        body: 'Kusakabe Kimbei worked as a colourist and assistant for Felice Beato and Baron von Stillfried, then opened his own famous studio in Yokohama in 1881.',
      },
      {
        heading: 'Souvenirs of old Japan',
        body: 'Foreign travellers bought albums of hand-coloured views and costume portraits. Kimbei\'s studio was known for careful colouring and for staging scenes with real historical armour and props.',
      },
      {
        heading: 'Did you know?',
        body: 'Studios kept a collection of armour, swords and costumes for sitters. Many of these photographs are now among the best visual records of how samurai equipment was worn.',
      },
    ],
  },
  {
    id: 'mongol-invasion',
    kind: 'frame',
    image: '/gallery/mongol-invasion.webp',
    aspect: 1280 / 424,
    title: 'Illustrated Account of the Mongol Invasions',
    titleJp: '蒙古襲来絵詞',
    artist: 'Commissioned by Takezaki Suenaga',
    date: 'c. 1293, Kamakura period',
    medium: 'Handscroll, ink and colour on paper',
    collection: 'Museum of the Imperial Collections · National Treasure',
    sections: [
      {
        heading: 'Invasion from the sea',
        body: 'In 1274 and again in 1281, the Mongol emperor Kublai Khan sent great fleets to conquer Japan. Samurai fought the landings at Hakata Bay in Kyushu, and storms later called "kamikaze" wrecked the fleets.',
      },
      {
        heading: 'A warrior\'s own story',
        body: 'Takezaki Suenaga, a samurai from Higo province, fought in both invasions. He had these scrolls made to record his bravery, partly to claim the reward he believed the Kamakura shogunate owed him.',
      },
      {
        heading: 'A battlefield first',
        body: 'The scroll shows mounted samurai charging Mongol archers, and an iron bomb, "tetsuhau", exploding in the air. It is one of the earliest pictures of gunpowder weapons used in battle anywhere.',
      },
      {
        heading: 'Did you know?',
        body: 'Underwater archaeologists have found Mongol ships and real tetsuhau bombs off Takashima island, confirming details painted in this scroll more than seven hundred years ago.',
      },
    ],
  },
  {
    id: 'choju-giga',
    kind: 'handscroll',
    image: '/gallery/choju-giga.webp',
    aspect: 1280 / 180,
    title: 'Scrolls of Frolicking Animals (Chōjū-giga)',
    titleJp: '鳥獣戯画',
    artist: 'Traditionally attributed to Toba Sōjō (Kakuyū)',
    date: '12th–13th century, Heian–Kamakura period',
    medium: 'Handscroll, ink on paper',
    collection: 'Kōzan-ji temple, Kyoto · National Treasure',
    sections: [
      {
        heading: 'Animals at play',
        body: 'Rabbits, frogs and monkeys swim, wrestle, race and hold ceremonies just like people. Drawn in lively ink lines with no colour, the scenes still make visitors laugh nine hundred years later.',
      },
      {
        heading: 'Who drew it?',
        body: 'Tradition credits the monk Toba Sōjō, but the four scrolls were probably drawn by several artists over many decades. They have been kept for centuries at Kōzan-ji, a temple in the hills north of Kyoto.',
      },
      {
        heading: 'Read from right to left',
        body: 'A handscroll is unrolled a little at a time, from right to left, so the story moves like a film. Characters lead the eye onward from one scene to the next.',
      },
      {
        heading: 'Did you know?',
        body: 'Because of its playful characters and flowing storytelling, Chōjū-giga is often called the oldest ancestor of Japanese manga.',
      },
    ],
  },
  {
    id: 'armour',
    kind: 'armour',
    aspect: 1,
    glyph: '鎧',
    title: 'Samurai Armour (Ō-yoroi style)',
    titleJp: '大鎧',
    artist: 'Display reconstruction',
    date: 'Style of the Kamakura period (1185–1333)',
    medium: 'Lacquered iron and leather plates, silk lacing',
    collection: 'Gallery reconstruction',
    sections: [
      {
        heading: 'Armour of mounted archers',
        body: 'The great armour, ō-yoroi, was made for samurai who fought on horseback with the bow. Its box-like shape, wide shoulder guards (sode) and skirt of plates protected a rider from arrows.',
      },
      {
        heading: 'Made of small plates',
        body: 'Each section is built from hundreds of small lacquered scales (kozane) laced together with silk or leather cords. The colour of the lacing, called odoshi, could show a warrior\'s family or rank.',
      },
      {
        heading: 'The helmet',
        body: 'The kabuto helmet has a flared neck guard of laced plates and often a crest of gilded horns, the kuwagata. A face mask (menpō) protected the face and helped the helmet sit firmly.',
      },
      {
        heading: 'Did you know?',
        body: 'When firearms arrived in the 16th century, armour changed to lighter, solid-plate "tōsei gusoku". Old-style armour then became ceremonial, kept in boxes and displayed on stands like this one.',
      },
    ],
  },
  {
    id: 'katana',
    kind: 'katana',
    aspect: 1,
    glyph: '刀',
    title: 'Katana and Wakizashi (Daishō)',
    titleJp: '大小',
    artist: 'Display reconstruction',
    date: 'Style of the Edo period (1603–1868)',
    medium: 'Folded steel, lacquered wood scabbards, silk-wrapped handles',
    collection: 'Gallery reconstruction',
    sections: [
      {
        heading: 'The soul of the samurai',
        body: 'The katana is a curved, single-edged sword worn edge-up through the sash. Together with the shorter wakizashi it formed the daishō, "large and small", a pair only samurai were allowed to wear.',
      },
      {
        heading: 'Steel from sand',
        body: 'Smiths smelted iron sand in a clay tatara furnace to make tamahagane steel. The steel was folded many times, then a hard edge and a softer spine were joined so the blade could cut without breaking.',
      },
      {
        heading: 'The hamon',
        body: 'Before quenching, the smith coats the blade in clay, thin at the edge and thick on the spine. The edge cools faster and becomes very hard, leaving the misty wavy line along the blade called the hamon.',
      },
      {
        heading: 'Did you know?',
        body: 'Swords were treasured heirlooms and were often remounted for each new owner. At home they rested on a lacquered stand, a katana-kake, with the handle to the left and the edge facing up.',
      },
    ],
  },
]
