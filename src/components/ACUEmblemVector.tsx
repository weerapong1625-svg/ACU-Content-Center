import React from 'react';

interface ACUEmblemVectorProps {
  className?: string;
}

/**
 * Exact Vector Reconstruction of the Official Seal of
 * โรงเรียนอัสสัมชัญอุบลราชธานี (Assumption College Ubonratchathani - ACU N.png)
 */
export const ACUEmblemVector: React.FC<ACUEmblemVectorProps> = ({ className = 'w-full h-full' }) => {
  return (
    <svg
      viewBox="0 0 500 500"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      role="img"
      aria-label="ตราสัญลักษณ์โรงเรียนอัสสัมชัญอุบลราชธานี"
    >
      <defs>
        {/* Top curved path for Thai text: โรงเรียนอัสสัมชัญอุบลราชธานี */}
        <path id="acu-top-arc-text" d="M 52,246 A 200,200 0 0,1 448,246" fill="none" />
        
        {/* Bottom curved path for Thai text: อำเภอเมือง จังหวัดอุบลราชธานี */}
        <path id="acu-bottom-arc-text" d="M 105,394 C 175,456 325,456 395,394" fill="none" />

        {/* Heraldic Gold Gradients */}
        <linearGradient id="acu-gold-cartouche" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF2A3" />
          <stop offset="30%" stopColor="#F5C518" />
          <stop offset="70%" stopColor="#D49B00" />
          <stop offset="100%" stopColor="#8A5A00" />
        </linearGradient>

        <linearGradient id="acu-gold-ribbon" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF9C4" />
          <stop offset="50%" stopColor="#FFD54F" />
          <stop offset="100%" stopColor="#FFB300" />
        </linearGradient>

        <linearGradient id="acu-red-banner" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E52424" />
          <stop offset="100%" stopColor="#BA1212" />
        </linearGradient>

        <filter id="acu-emblem-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* ================= 0. WHITE CIRCULAR BACKGROUND SIZED TO LOGO ================= */}
      <circle cx="250" cy="250" r="238" fill="#FFFFFF" />

      {/* ================= 1. TOP RED ARCH BANNER ================= */}
      <g filter="url(#acu-emblem-shadow)">
        <path
          d="
            M 32,246
            C 32,125 130,28 250,28
            C 370,28 468,125 468,246
            L 484,244
            C 478,266 462,274 448,278
            L 444,242
            C 440,140 355,62 250,62
            C 145,62 60,140 56,242
            L 52,278
            C 38,274 22,266 16,244
            Z"
          fill="url(#acu-red-banner)"
          stroke="#940D0D"
          strokeWidth="1.5"
        />

        {/* Left folded ribbon end */}
        <path d="M 16,244 L 56,242 L 52,278 L 36,262 Z" fill="#880000" stroke="#550000" strokeWidth="0.8" />
        <path d="M 16,244 L 36,262 L 18,274 Z" fill="#FFFFFF" stroke="#940D0D" strokeWidth="0.8" />

        {/* Right folded ribbon end */}
        <path d="M 484,244 L 444,242 L 448,278 L 464,262 Z" fill="#880000" stroke="#550000" strokeWidth="0.8" />
        <path d="M 484,244 L 464,262 L 482,274 Z" fill="#FFFFFF" stroke="#940D0D" strokeWidth="0.8" />

        {/* Inner gold concentric accent arc */}
        <path
          d="M 60,234 C 64,142 148,68 250,68 C 352,68 436,142 440,234"
          fill="none"
          stroke="#FFE082"
          strokeWidth="1.2"
          strokeOpacity="0.85"
        />
      </g>

      {/* Top Banner Text: "โรงเรียนอัสสัมชัญอุบลราชธานี" */}
      <text
        fill="#FFFFFF"
        fontFamily="'Prompt', 'Kanit', 'Sarabun', sans-serif"
        fontWeight="800"
        fontSize="26.5px"
        letterSpacing="1.2px"
      >
        <textPath href="#acu-top-arc-text" startOffset="50%" textAnchor="middle">
          โรงเรียนอัสสัมชัญอุบลราชธานี
        </textPath>
      </text>

      {/* ================= 2. LAUREL LEAVES WREATH (LEFT & RIGHT) ================= */}
      <g id="acu-laurel-wreath">
        {/* Left Laurel Branch */}
        <g fill="#228B22" stroke="#135213" strokeWidth="0.8">
          <path d="M 112,230 C 95,200 102,170 120,150 C 122,165 118,185 116,205 Z" fill="#2EA02E" />
          <path d="M 104,245 C 85,230 92,205 108,190 C 110,210 108,230 106,245 Z" />
          <path d="M 118,275 C 96,265 96,235 110,218 C 116,238 118,258 120,275 Z" fill="#2EA02E" />
          <path d="M 132,305 C 110,300 105,270 120,250 C 128,270 132,290 134,305 Z" />
          <path d="M 152,328 C 130,328 122,302 136,280 C 146,298 152,315 154,328 Z" fill="#2EA02E" />
          <path d="M 135,178 C 125,162 135,145 152,148 C 145,160 142,172 135,178 Z" />
          <path d="M 128,212 C 115,198 122,182 140,182 C 135,195 132,206 128,212 Z" fill="#3CB371" />
          <path d="M 132,246 C 118,232 122,216 142,214 C 138,228 136,240 132,246 Z" />
          <path d="M 142,278 C 128,266 130,248 150,244 C 148,258 146,270 142,278 Z" fill="#3CB371" />
        </g>

        {/* Right Laurel Branch (Mirrored) */}
        <g fill="#228B22" stroke="#135213" strokeWidth="0.8" transform="translate(500,0) scale(-1,1)">
          <path d="M 112,230 C 95,200 102,170 120,150 C 122,165 118,185 116,205 Z" fill="#2EA02E" />
          <path d="M 104,245 C 85,230 92,205 108,190 C 110,210 108,230 106,245 Z" />
          <path d="M 118,275 C 96,265 96,235 110,218 C 116,238 118,258 120,275 Z" fill="#2EA02E" />
          <path d="M 132,305 C 110,300 105,270 120,250 C 128,270 132,290 134,305 Z" />
          <path d="M 152,328 C 130,328 122,302 136,280 C 146,298 152,315 154,328 Z" fill="#2EA02E" />
          <path d="M 135,178 C 125,162 135,145 152,148 C 145,160 142,172 135,178 Z" />
          <path d="M 128,212 C 115,198 122,182 140,182 C 135,195 132,206 128,212 Z" fill="#3CB371" />
          <path d="M 132,246 C 118,232 122,216 142,214 C 138,228 136,240 132,246 Z" />
          <path d="M 142,278 C 128,266 130,248 150,244 C 148,258 146,270 142,278 Z" fill="#3CB371" />
        </g>
      </g>

      {/* ================= 3. TOP CROWN / PEDIMENT ================= */}
      <g id="acu-crown" stroke="#684200" strokeWidth="1">
        <path
          d="M 205,150 C 220,144 250,142 250,142 C 250,142 280,144 295,150 C 285,156 250,158 250,158 C 250,158 215,156 205,150 Z"
          fill="url(#acu-gold-cartouche)"
        />
        <path
          d="M 215,142 C 220,126 235,116 250,116 C 265,116 280,126 285,142 C 275,145 250,146 250,146 C 250,146 225,145 215,142 Z"
          fill="url(#acu-gold-ribbon)"
        />
        <circle cx="250" cy="110" r="5" fill="url(#acu-gold-cartouche)" />
        {/* Top cross */}
        <path d="M 248,94 L 252,94 L 252,106 L 248,106 Z M 244,98 L 256,98 L 256,102 L 244,102 Z" fill="#FFD700" />
        {/* Side scrolls */}
        <path d="M 218,124 C 208,110 220,95 232,106 C 224,110 222,118 218,124 Z" fill="url(#acu-gold-cartouche)" />
        <path d="M 282,124 C 292,110 280,95 268,106 C 276,110 278,118 282,124 Z" fill="url(#acu-gold-cartouche)" />
        <circle cx="230" cy="132" r="3" fill="#FFE082" />
        <circle cx="250" cy="130" r="4" fill="#FFF59D" />
        <circle cx="270" cy="132" r="3" fill="#FFE082" />
      </g>

      {/* ================= 4. ORNATE GOLDEN CARTOUCHE FRAME ================= */}
      <g id="acu-shield-cartouche" filter="url(#acu-emblem-shadow)">
        <path
          d="
            M 160,152
            C 180,142 220,150 250,148
            C 280,150 320,142 340,152
            C 362,166 352,205 348,220
            C 365,245 362,280 342,305
            C 325,326 285,348 250,356
            C 215,348 175,326 158,305
            C 138,280 135,245 152,220
            C 148,205 138,166 160,152
            Z"
          fill="url(#acu-gold-cartouche)"
          stroke="#784E00"
          strokeWidth="2.2"
        />

        {/* Inner golden bevel line */}
        <path
          d="
            M 170,162
            C 190,154 225,160 250,158
            C 275,160 310,154 330,162
            C 345,176 338,206 336,220
            C 348,242 346,270 330,292
            C 314,312 280,332 250,340
            C 220,332 186,312 170,292
            C 154,270 152,242 164,220
            C 162,206 155,176 170,162
            Z"
          fill="none"
          stroke="#FFE57F"
          strokeWidth="1.8"
        />

        {/* Frame corner scrolls */}
        <circle cx="152" cy="165" r="6" fill="url(#acu-gold-ribbon)" stroke="#784E00" strokeWidth="1.2" />
        <circle cx="348" cy="165" r="6" fill="url(#acu-gold-ribbon)" stroke="#784E00" strokeWidth="1.2" />
      </g>

      {/* ================= 5. THE 4 INNER QUADRANTS ================= */}
      <clipPath id="acu-quadrant-clip">
        <path
          d="
            M 185,168
            L 315,168
            C 325,190 325,230 325,250
            C 325,285 295,315 250,332
            C 205,315 175,285 175,250
            C 175,230 175,190 185,168
            Z"
        />
      </clipPath>

      <g clipPath="url(#acu-quadrant-clip)">
        {/* Quadrant 1: Top-Left (Royal Blue) */}
        <rect x="175" y="168" width="75" height="82" fill="#143E82" />

        {/* Quadrant 2: Top-Right (White) */}
        <rect x="250" y="168" width="75" height="82" fill="#FFFFFF" />

        {/* Quadrant 3: Bottom-Left (White) */}
        <rect x="175" y="250" width="75" height="82" fill="#FFFFFF" />

        {/* Quadrant 4: Bottom-Right (Red) */}
        <rect x="250" y="250" width="75" height="82" fill="#D32F2F" />

        {/* Quadrant Partition Grid Lines */}
        <line x1="250" y1="168" x2="250" y2="332" stroke="#222222" strokeWidth="1.8" />
        <line x1="175" y1="250" x2="325" y2="250" stroke="#222222" strokeWidth="1.8" />

        {/* --- Q1 (Top-Left): Auspice Maria Monogram & Lily Flower --- */}
        <g id="acu-symbol-am">
          {/* Madonna Lily */}
          <path d="M 212,176 C 207,172 208,180 212,185 C 216,180 217,172 212,176 Z" fill="#FDD835" stroke="#F57F17" strokeWidth="0.6" />
          <path d="M 205,178 C 201,176 204,183 209,185 C 207,180 205,178 205,178 Z" fill="#FDD835" />
          <path d="M 219,178 C 223,176 220,183 215,185 C 217,180 219,178 219,178 Z" fill="#FDD835" />
          <line x1="212" y1="185" x2="212" y2="192" stroke="#FDD835" strokeWidth="1.2" />

          {/* AM letters */}
          <path
            d="M 202,236 L 212,192 L 222,236 L 217,236 L 214.5,224 L 209.5,224 L 207,236 Z M 212,205 L 210.5,219 L 213.5,219 Z"
            fill="#FDD835"
            stroke="#F57F17"
            strokeWidth="0.8"
          />
          <path
            d="M 197,236 L 197,204 L 204,222 L 212,204 L 220,222 L 227,204 L 227,236 L 223,236 L 223,212 L 217,226 L 212,214 L 207,226 L 201,212 L 201,236 Z"
            fill="#FFE082"
            stroke="#F57F17"
            strokeWidth="0.6"
            fillOpacity="0.95"
          />
        </g>

        {/* --- Q2 (Top-Right): Scales of Justice & Water Waves --- */}
        <g id="acu-symbol-scales" stroke="#A16207">
          <polygon points="287,178 281,190 293,190" fill="#FACC15" stroke="#A16207" strokeWidth="1.2" />
          <circle cx="287" cy="189" r="1.5" fill="#854D0E" />
          <line x1="262" y1="198" x2="312" y2="198" stroke="#854D0E" strokeWidth="1.8" />
          <line x1="262" y1="198" x2="258" y2="210" stroke="#A16207" strokeWidth="0.9" />
          <line x1="262" y1="198" x2="266" y2="210" stroke="#A16207" strokeWidth="0.9" />
          <path d="M 255,210 Q 262,216 269,210 Z" fill="#FACC15" stroke="#854D0E" strokeWidth="1" />
          <line x1="312" y1="198" x2="308" y2="210" stroke="#A16207" strokeWidth="0.9" />
          <line x1="312" y1="198" x2="316" y2="210" stroke="#A16207" strokeWidth="0.9" />
          <path d="M 305,210 Q 312,216 319,210 Z" fill="#FACC15" stroke="#854D0E" strokeWidth="1" />
          <path d="M 264,228 Q 275,224 286,228 T 308,228" fill="none" stroke="#CA8A04" strokeWidth="1.2" />
          <path d="M 267,234 Q 278,230 289,234 T 305,234" fill="none" stroke="#CA8A04" strokeWidth="1" />
        </g>

        {/* --- Q3 (Bottom-Left): Radiant Sun & Sailing Barque on Waves --- */}
        <g id="acu-symbol-sun-boat">
          <circle cx="212" cy="274" r="7" fill="#FACC15" stroke="#CA8A04" strokeWidth="1" />
          <g stroke="#EAB308" strokeWidth="1.2" strokeLinecap="round">
            <line x1="212" y1="262" x2="212" y2="258" />
            <line x1="212" y1="286" x2="212" y2="290" />
            <line x1="200" y1="274" x2="196" y2="274" />
            <line x1="224" y1="274" x2="228" y2="274" />
            <line x1="203" y1="265" x2="200" y2="262" />
            <line x1="221" y1="265" x2="224" y2="262" />
            <line x1="203" y1="283" x2="200" y2="286" />
            <line x1="221" y1="283" x2="224" y2="286" />
          </g>
          {/* Boat */}
          <path d="M 197,300 C 205,307 219,307 227,300 L 224,296 L 200,296 Z" fill="#FACC15" stroke="#854D0E" strokeWidth="1" />
          {/* Waves */}
          <path d="M 188,310 Q 200,306 212,310 T 236,310" fill="none" stroke="#A16207" strokeWidth="1.2" />
          <path d="M 192,315 Q 204,312 216,315 T 232,315" fill="none" stroke="#A16207" strokeWidth="1" />
        </g>

        {/* --- Q4 (Bottom-Right): Latin Cross & D | S (Dieu Seul) --- */}
        <g id="acu-symbol-cross-ds">
          <path
            d="
              M 284,258 L 290,258 L 290,270 L 302,270 L 302,276 L 290,276 L 290,314 L 284,314 L 284,276 L 272,276 L 272,270 L 284,270 Z"
            fill="#FFEB3B"
            stroke="#FFE082"
            strokeWidth="0.8"
          />
          <text
            x="260"
            y="296"
            fontFamily="'Times New Roman', serif"
            fontWeight="bold"
            fontSize="22px"
            fill="#FFEB3B"
            textAnchor="middle"
          >
            D
          </text>
          <text
            x="312"
            y="296"
            fontFamily="'Times New Roman', serif"
            fontWeight="bold"
            fontSize="22px"
            fill="#FFEB3B"
            textAnchor="middle"
          >
            S
          </text>
        </g>
      </g>

      {/* ================= 6. MOTTO RIBBONS ================= */}
      <g id="acu-motto-ribbons" filter="url(#acu-emblem-shadow)">
        {/* Upper Ribbon: "BROTHERS of St GABRIEL" */}
        <g>
          <path
            d="
              M 160,332
              C 195,316 305,316 340,332
              L 344,352
              C 305,334 195,334 156,352
              Z"
            fill="url(#acu-gold-ribbon)"
            stroke="#784E00"
            strokeWidth="1.5"
          />
          <path d="M 156,352 L 140,344 L 146,362 L 164,360 Z" fill="#D49B00" stroke="#784E00" strokeWidth="1" />
          <path d="M 344,352 L 360,344 L 354,362 L 336,360 Z" fill="#D49B00" stroke="#784E00" strokeWidth="1" />

          <path id="acu-brothers-path" d="M 162,345 C 205,327 295,327 338,345" fill="none" />
          <text
            fontFamily="'Times New Roman', serif"
            fontSize="11.5px"
            fontWeight="bold"
            fill="#1A1A1A"
            letterSpacing="0.5px"
          >
            <textPath href="#acu-brothers-path" startOffset="50%" textAnchor="middle">
              BROTHERS of   St GABRIEL
            </textPath>
          </text>
        </g>

        {/* Crossed Torch Handles */}
        <g stroke="#784E00" strokeWidth="3" strokeLinecap="round">
          <line x1="205" y1="345" x2="185" y2="380" />
          <line x1="295" y1="345" x2="315" y2="380" />
        </g>

        {/* Lower Ribbon: "LABOR OMNIA VINCIT" */}
        <g>
          <path
            d="
              M 172,364
              C 200,378 225,378 250,388
              C 275,378 300,378 328,364
              L 334,384
              C 305,398 275,398 250,408
              C 225,398 195,398 166,384
              Z"
            fill="url(#acu-gold-ribbon)"
            stroke="#784E00"
            strokeWidth="1.5"
          />
          <path d="M 166,384 L 148,374 L 152,396 L 174,394 Z" fill="#D49B00" stroke="#784E00" strokeWidth="1" />
          <path d="M 334,384 L 352,374 L 348,396 L 326,394 Z" fill="#D49B00" stroke="#784E00" strokeWidth="1" />

          <text x="202" y="386" fontFamily="'Times New Roman', serif" fontSize="11.5px" fontWeight="bold" fill="#1A1A1A" textAnchor="middle">
            LABOR
          </text>
          <text x="250" y="401" fontFamily="'Times New Roman', serif" fontSize="11.5px" fontWeight="bold" fill="#1A1A1A" textAnchor="middle">
            OMNIA
          </text>
          <text x="298" y="386" fontFamily="'Times New Roman', serif" fontSize="11.5px" fontWeight="bold" fill="#1A1A1A" textAnchor="middle">
            VINCIT
          </text>
        </g>
      </g>

      {/* ================= 7. BOTTOM WHITE BANNER ================= */}
      {/* "อำเภอเมือง  จังหวัดอุบลราชธานี" & Montfort Cross Badges */}
      <g id="acu-bottom-banner" filter="url(#acu-emblem-shadow)">
        <path
          d="
            M 62,310
            C 110,405 180,448 250,450
            C 320,448 390,405 438,310
            L 452,330
            C 400,432 325,482 250,484
            C 175,482 100,432 48,330
            Z"
          fill="#FFFFFF"
          stroke="#D32F2F"
          strokeWidth="2.5"
        />

        {/* Ribbon corner notches */}
        <path d="M 48,330 L 62,310 L 76,334 Z" fill="#FFCDD2" stroke="#D32F2F" strokeWidth="1" />
        <path d="M 452,330 L 438,310 L 424,334 Z" fill="#FFCDD2" stroke="#D32F2F" strokeWidth="1" />

        {/* Left Montfort Cross Medallion */}
        <g transform="translate(98, 372)">
          <circle cx="0" cy="0" r="14" fill="#FFFFFF" stroke="#D32F2F" strokeWidth="2" />
          <path
            d="
              M -2,-2 L -8,-8 L -6,-10 L 0,-4 L 6,-10 L 8,-8 L 2,-2 
              L 8,-2 L 10,-6 L 10,6 L 8,2 L 2,2 
              L 8,8 L 6,10 L 0,4 L -6,10 L -8,8 L -2,2 
              L -8,2 L -10,6 L -10,-6 L -8,-2 Z"
            fill="#D32F2F"
            transform="scale(0.8)"
          />
        </g>

        {/* Right Montfort Cross Medallion */}
        <g transform="translate(402, 372)">
          <circle cx="0" cy="0" r="14" fill="#FFFFFF" stroke="#D32F2F" strokeWidth="2" />
          <path
            d="
              M -2,-2 L -8,-8 L -6,-10 L 0,-4 L 6,-10 L 8,-8 L 2,-2 
              L 8,-2 L 10,-6 L 10,6 L 8,2 L 2,2 
              L 8,8 L 6,10 L 0,4 L -6,10 L -8,8 L -2,2 
              L -8,2 L -10,6 L -10,-6 L -8,-2 Z"
            fill="#D32F2F"
            transform="scale(0.8)"
          />
        </g>

        {/* Bottom Banner Thai Text */}
        <text
          fill="#D32F2F"
          fontFamily="'Prompt', 'Kanit', 'Sarabun', sans-serif"
          fontWeight="700"
          fontSize="21px"
          letterSpacing="1px"
        >
          <textPath href="#acu-bottom-arc-text" startOffset="50%" textAnchor="middle">
            อำเภอเมือง   จังหวัดอุบลราชธานี
          </textPath>
        </text>
      </g>
    </svg>
  );
};
