// The Development Checklist's reference items, plus the title matching that
// decides whether a child's own milestone record ticks one of them.
//
// SOURCE — read this before editing any item text.
//
// Items are based on the U.S. CDC's "Learn the Signs. Act Early." developmental
// milestones, 2022 revision. That revision lists what **about 75% of children
// can do by a given age** (the previous edition used 50%) and deliberately
// removed hedging words like "may" and "begins". Two checkpoints, 15 and 30
// months, were added so every well-child visit has one.
//
// This is NOT the complete CDC checklist — some age bands here carry fewer
// items than the published list. The screen says so and points a parent at
// cdc.gov for the full version. Never reword an item to sound more certain,
// and never invent one to fill a thin band: a fabricated milestone in a health
// app is a correctness bug, not a content gap.
//
// WHY NOT A PHILIPPINE STANDARD. The Philippine instrument is the ECCD
// Checklist (ECCD Council / DSWD) — seven domains, developed and validated in
// 2001 on 10,915 Filipino children. It was examined first and rejected for
// this screen on purpose: it runs to roughly 300 items across two forms, is
// designed for administration by a trained worker, and is tallied into domain
// raw scores. A scored assessment instrument inside a parent-held baby book is
// what PRODUCT.md Principle 5 forbids, and a hand-picked subset of it would
// borrow the ECCD name without being the ECCD Checklist. The screen states
// that health centres and day care centres use the ECCD Checklist — a fact
// about the world, NOT a claim of any partnership or endorsement, which
// PRODUCT.md lists among the absences that must never be fabricated.
//
// NEITHER STANDARD REACHES AGE 6. Formal milestone lists stop around five,
// where school-readiness assessment takes over. The last band is 5 years.

// CDC's four categories. `tint` keys must exist in theme.js's colors.rec*
// group; `icon` names must exist in the Ionicons glyphmap (a past bug shipped
// an invalid Ionicons name, and another shipped `medical`, which renders as an
// asterisk).
export const DOMAINS = [
    { key: "social", label: "Social & Emotional", icon: "happy-outline", tint: "recMemory" },
    { key: "language", label: "Language & Communication", icon: "chatbubbles-outline", tint: "recCheckup" },
    { key: "cognitive", label: "Thinking & Learning", icon: "bulb-outline", tint: "recGrowth" },
    { key: "motor", label: "Movement & Physical", icon: "walk-outline", tint: "recVaccine" },
];

// Ages in months. These are CDC's checkpoints, which line up with the
// well-child visit schedule rather than being evenly spaced.
export const CHECKPOINTS = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60];

// "18 months" / "5 years" — the age-menu row and the trigger that opens it.
export function bandLabel(months) {
    if (months < 24) return `${months} months`;
    const years = Math.round(months / 12);
    return `${years} years`;
}

// The band a child of this age belongs in: the highest checkpoint at or below
// their age, so a 20-month-old lands on 18 months rather than 24. Below the
// first checkpoint returns the first; above the last returns the last, because
// the list simply ends there.
export function checkpointFor(months) {
    if (!Number.isFinite(months)) return CHECKPOINTS[0];
    let band = CHECKPOINTS[0];
    for (const c of CHECKPOINTS) {
        if (months >= c) band = c;
    }
    return band;
}

// No `guidance` field. Each CDC item is already a complete, plain-language
// statement of the behaviour; writing an extra sentence per item would mean
// inventing 140-odd elaborations the source does not contain.
export const AGE_CHECKLISTS = [
    // ---- By 2 months ----
    { id: "m2-soc-1", months: 2, domain: "social", title: "Calms down when spoken to or picked up" },
    { id: "m2-soc-2", months: 2, domain: "social", title: "Looks at your face" },
    { id: "m2-soc-3", months: 2, domain: "social", title: "Seems happy to see you when you walk up to them" },
    { id: "m2-lan-1", months: 2, domain: "language", title: "Makes sounds other than crying" },
    { id: "m2-lan-2", months: 2, domain: "language", title: "Reacts to loud sounds" },
    { id: "m2-cog-1", months: 2, domain: "cognitive", title: "Watches you as you move" },
    { id: "m2-cog-2", months: 2, domain: "cognitive", title: "Looks at a toy for several seconds" },
    { id: "m2-mot-1", months: 2, domain: "motor", title: "Holds head up when on tummy" },
    { id: "m2-mot-2", months: 2, domain: "motor", title: "Moves both arms and both legs" },
    { id: "m2-mot-3", months: 2, domain: "motor", title: "Opens hands briefly" },

    // ---- By 4 months ----
    { id: "m4-soc-1", months: 4, domain: "social", title: "Smiles on their own to get your attention" },
    { id: "m4-soc-2", months: 4, domain: "social", title: "Chuckles when you try to make them laugh" },
    { id: "m4-soc-3", months: 4, domain: "social", title: "Looks, moves, or makes sounds to get or keep your attention" },
    { id: "m4-lan-1", months: 4, domain: "language", title: "Makes cooing sounds" },
    { id: "m4-lan-2", months: 4, domain: "language", title: "Makes sounds back when you talk to them" },
    { id: "m4-lan-3", months: 4, domain: "language", title: "Turns head toward the sound of your voice" },
    { id: "m4-cog-1", months: 4, domain: "cognitive", title: "Opens mouth when hungry and sees breast or bottle" },
    { id: "m4-cog-2", months: 4, domain: "cognitive", title: "Looks at their hands with interest" },
    { id: "m4-mot-1", months: 4, domain: "motor", title: "Holds head steady without support when being held" },
    { id: "m4-mot-2", months: 4, domain: "motor", title: "Holds a toy when you put it in their hand" },
    { id: "m4-mot-3", months: 4, domain: "motor", title: "Pushes up onto elbows or forearms when on tummy" },

    // ---- By 6 months ----
    { id: "m6-soc-1", months: 6, domain: "social", title: "Knows familiar people" },
    { id: "m6-soc-2", months: 6, domain: "social", title: "Likes to look at self in a mirror" },
    { id: "m6-soc-3", months: 6, domain: "social", title: "Laughs" },
    { id: "m6-lan-1", months: 6, domain: "language", title: "Takes turns making sounds with you" },
    { id: "m6-lan-2", months: 6, domain: "language", title: "Blows raspberries" },
    { id: "m6-lan-3", months: 6, domain: "language", title: "Makes squealing noises" },
    { id: "m6-cog-1", months: 6, domain: "cognitive", title: "Puts things in their mouth to explore them" },
    { id: "m6-cog-2", months: 6, domain: "cognitive", title: "Reaches to grab a toy they want" },
    { id: "m6-cog-3", months: 6, domain: "cognitive", title: "Closes lips to show they do not want more food" },
    { id: "m6-mot-1", months: 6, domain: "motor", title: "Rolls from tummy to back" },
    { id: "m6-mot-2", months: 6, domain: "motor", title: "Pushes up with straight arms when on tummy" },
    { id: "m6-mot-3", months: 6, domain: "motor", title: "Leans on hands for support when sitting" },

    // ---- By 9 months ----
    { id: "m9-soc-1", months: 9, domain: "social", title: "Is shy, clingy, or fearful around strangers" },
    { id: "m9-soc-2", months: 9, domain: "social", title: "Shows several facial expressions" },
    { id: "m9-soc-3", months: 9, domain: "social", title: "Reacts when you leave" },
    { id: "m9-lan-1", months: 9, domain: "language", title: 'Makes different sounds like "mamamama" and "babababa"' },
    { id: "m9-lan-2", months: 9, domain: "language", title: "Lifts arms up to be picked up" },
    { id: "m9-cog-1", months: 9, domain: "cognitive", title: "Looks for objects when they drop out of sight" },
    { id: "m9-cog-2", months: 9, domain: "cognitive", title: "Bangs two things together" },
    { id: "m9-mot-1", months: 9, domain: "motor", title: "Gets to a sitting position by themselves" },
    { id: "m9-mot-2", months: 9, domain: "motor", title: "Moves things from one hand to the other" },
    { id: "m9-mot-3", months: 9, domain: "motor", title: "Uses fingers to rake food toward themselves" },
    { id: "m9-mot-4", months: 9, domain: "motor", title: "Sits without support" },

    // ---- By 12 months ----
    { id: "m12-soc-1", months: 12, domain: "social", title: "Plays games with you like pat-a-cake" },
    { id: "m12-lan-1", months: 12, domain: "language", title: 'Waves "bye-bye"' },
    { id: "m12-lan-2", months: 12, domain: "language", title: 'Calls a parent "mama" or "dada" or another special name' },
    { id: "m12-lan-3", months: 12, domain: "language", title: 'Understands "no"' },
    { id: "m12-cog-1", months: 12, domain: "cognitive", title: "Puts something in a container" },
    { id: "m12-cog-2", months: 12, domain: "cognitive", title: "Looks for things they see you hide" },
    { id: "m12-mot-1", months: 12, domain: "motor", title: "Pulls up to stand" },
    { id: "m12-mot-2", months: 12, domain: "motor", title: "Walks holding on to furniture" },
    { id: "m12-mot-3", months: 12, domain: "motor", title: "Drinks from a cup without a lid as you hold it" },
    { id: "m12-mot-4", months: 12, domain: "motor", title: "Picks things up between thumb and pointer finger" },

    // ---- By 15 months ----
    { id: "m15-soc-1", months: 15, domain: "social", title: "Copies other children while playing" },
    { id: "m15-soc-2", months: 15, domain: "social", title: "Shows you an object they like" },
    { id: "m15-soc-3", months: 15, domain: "social", title: "Claps when excited" },
    { id: "m15-soc-4", months: 15, domain: "social", title: "Hugs a stuffed toy or doll" },
    { id: "m15-lan-1", months: 15, domain: "language", title: 'Tries to say one or two words besides "mama" or "dada"' },
    { id: "m15-lan-2", months: 15, domain: "language", title: "Looks at a familiar object when you name it" },
    { id: "m15-lan-3", months: 15, domain: "language", title: "Follows directions given with both a gesture and words" },
    { id: "m15-cog-1", months: 15, domain: "cognitive", title: "Tries to use things the right way, like a phone, cup, or book" },
    { id: "m15-cog-2", months: 15, domain: "cognitive", title: "Stacks at least two small objects" },
    { id: "m15-mot-1", months: 15, domain: "motor", title: "Takes a few steps on their own" },
    { id: "m15-mot-2", months: 15, domain: "motor", title: "Uses fingers to feed themselves some food" },

    // ---- By 18 months ----
    { id: "m18-soc-1", months: 18, domain: "social", title: "Moves away from you but looks to make sure you are close by" },
    { id: "m18-soc-2", months: 18, domain: "social", title: "Points to show you something interesting" },
    { id: "m18-soc-3", months: 18, domain: "social", title: "Helps you dress them by pushing an arm through a sleeve" },
    { id: "m18-lan-1", months: 18, domain: "language", title: 'Tries to say three or more words besides "mama" or "dada"' },
    { id: "m18-lan-2", months: 18, domain: "language", title: "Follows one-step directions without any gestures" },
    { id: "m18-cog-1", months: 18, domain: "cognitive", title: "Copies you doing chores, like sweeping with a broom" },
    { id: "m18-cog-2", months: 18, domain: "cognitive", title: "Plays with toys in a simple way, like pushing a toy car" },
    { id: "m18-mot-1", months: 18, domain: "motor", title: "Walks without holding on to anyone or anything" },
    { id: "m18-mot-2", months: 18, domain: "motor", title: "Scribbles" },
    { id: "m18-mot-3", months: 18, domain: "motor", title: "Drinks from a cup without a lid, spilling sometimes" },
    { id: "m18-mot-4", months: 18, domain: "motor", title: "Feeds themselves with their fingers" },
    { id: "m18-mot-5", months: 18, domain: "motor", title: "Tries to use a spoon" },

    // ---- By 2 years ----
    { id: "m24-soc-1", months: 24, domain: "social", title: "Notices when others are hurt or upset" },
    { id: "m24-soc-2", months: 24, domain: "social", title: "Looks at your face to see how to react in a new situation" },
    { id: "m24-lan-1", months: 24, domain: "language", title: "Points to things in a book when you ask" },
    { id: "m24-lan-2", months: 24, domain: "language", title: 'Says at least two words together, like "more milk"' },
    { id: "m24-lan-3", months: 24, domain: "language", title: "Points to at least two body parts when asked" },
    { id: "m24-lan-4", months: 24, domain: "language", title: "Uses more gestures than just waving and pointing" },
    { id: "m24-cog-1", months: 24, domain: "cognitive", title: "Holds something in one hand while using the other" },
    { id: "m24-cog-2", months: 24, domain: "cognitive", title: "Tries to use switches, knobs, or buttons on a toy" },
    { id: "m24-cog-3", months: 24, domain: "cognitive", title: "Plays with more than one toy at the same time" },
    { id: "m24-mot-1", months: 24, domain: "motor", title: "Kicks a ball" },
    { id: "m24-mot-2", months: 24, domain: "motor", title: "Runs" },
    { id: "m24-mot-3", months: 24, domain: "motor", title: "Walks up a few stairs with or without help" },
    { id: "m24-mot-4", months: 24, domain: "motor", title: "Eats with a spoon" },

    // ---- By 30 months ----
    { id: "m30-soc-1", months: 30, domain: "social", title: "Plays next to and sometimes with other children" },
    { id: "m30-soc-2", months: 30, domain: "social", title: 'Shows you what they can do by saying "look at me!"' },
    { id: "m30-soc-3", months: 30, domain: "social", title: "Follows simple routines when told" },
    { id: "m30-lan-1", months: 30, domain: "language", title: "Says about 50 words" },
    { id: "m30-lan-2", months: 30, domain: "language", title: 'Says two or more words together with one action word, like "doggie run"' },
    { id: "m30-lan-3", months: 30, domain: "language", title: "Names things in a book when you point and ask" },
    { id: "m30-lan-4", months: 30, domain: "language", title: 'Says words like "I", "me", or "we"' },
    { id: "m30-cog-1", months: 30, domain: "cognitive", title: "Uses things to pretend, like feeding a block to a doll" },
    { id: "m30-cog-2", months: 30, domain: "cognitive", title: "Shows simple problem-solving skills" },
    { id: "m30-cog-3", months: 30, domain: "cognitive", title: "Follows two-step instructions" },
    { id: "m30-cog-4", months: 30, domain: "cognitive", title: "Knows at least one colour" },
    { id: "m30-mot-1", months: 30, domain: "motor", title: "Uses hands to twist things, like turning a doorknob" },
    { id: "m30-mot-2", months: 30, domain: "motor", title: "Takes some clothes off on their own" },
    { id: "m30-mot-3", months: 30, domain: "motor", title: "Jumps off the ground with both feet" },
    { id: "m30-mot-4", months: 30, domain: "motor", title: "Turns book pages one at a time" },

    // ---- By 3 years ----
    { id: "m36-soc-1", months: 36, domain: "social", title: "Calms down within 10 minutes after you leave them" },
    { id: "m36-soc-2", months: 36, domain: "social", title: "Notices other children and joins them to play" },
    { id: "m36-lan-1", months: 36, domain: "language", title: "Talks with you in conversation using at least two back-and-forth exchanges" },
    { id: "m36-lan-2", months: 36, domain: "language", title: 'Asks "who", "what", "where", or "why" questions' },
    { id: "m36-lan-3", months: 36, domain: "language", title: "Says their first name when asked" },
    { id: "m36-lan-4", months: 36, domain: "language", title: "Talks well enough for others to understand most of the time" },
    { id: "m36-cog-1", months: 36, domain: "cognitive", title: "Draws a circle when you show them how" },
    { id: "m36-cog-2", months: 36, domain: "cognitive", title: "Avoids touching hot objects when you warn them" },
    { id: "m36-mot-1", months: 36, domain: "motor", title: "Strings items together, like large beads" },
    { id: "m36-mot-2", months: 36, domain: "motor", title: "Puts on some clothes by themselves" },
    { id: "m36-mot-3", months: 36, domain: "motor", title: "Uses a fork" },

    // ---- By 4 years ----
    { id: "m48-soc-1", months: 48, domain: "social", title: "Pretends to be something else during play" },
    { id: "m48-soc-2", months: 48, domain: "social", title: "Asks to go play with children if none are around" },
    { id: "m48-soc-3", months: 48, domain: "social", title: "Comforts others who are hurt or sad" },
    { id: "m48-soc-4", months: 48, domain: "social", title: "Avoids danger, like not jumping from tall heights" },
    { id: "m48-lan-1", months: 48, domain: "language", title: "Says sentences with four or more words" },
    { id: "m48-lan-2", months: 48, domain: "language", title: "Says some words from a song, story, or nursery rhyme" },
    { id: "m48-lan-3", months: 48, domain: "language", title: "Talks about at least one thing that happened during the day" },
    { id: "m48-lan-4", months: 48, domain: "language", title: "Answers simple questions" },
    { id: "m48-cog-1", months: 48, domain: "cognitive", title: "Names a few colours" },
    { id: "m48-cog-2", months: 48, domain: "cognitive", title: "Tells what comes next in a well-known story" },
    { id: "m48-cog-3", months: 48, domain: "cognitive", title: "Draws a person with three or more body parts" },
    { id: "m48-mot-1", months: 48, domain: "motor", title: "Catches a large ball most of the time" },
    { id: "m48-mot-2", months: 48, domain: "motor", title: "Serves food or pours water with supervision" },
    { id: "m48-mot-3", months: 48, domain: "motor", title: "Unbuttons some buttons" },
    { id: "m48-mot-4", months: 48, domain: "motor", title: "Holds a crayon or pencil between fingers and thumb" },

    // ---- By 5 years ----
    { id: "m60-soc-1", months: 60, domain: "social", title: "Follows rules or takes turns when playing games with other children" },
    { id: "m60-soc-2", months: 60, domain: "social", title: "Sings, dances, or acts for you" },
    { id: "m60-soc-3", months: 60, domain: "social", title: "Does simple chores at home" },
    { id: "m60-lan-1", months: 60, domain: "language", title: "Tells a story they heard or made up with at least two events" },
    { id: "m60-lan-2", months: 60, domain: "language", title: "Answers simple questions about a book or story" },
    { id: "m60-lan-3", months: 60, domain: "language", title: "Keeps a conversation going with more than three back-and-forth exchanges" },
    { id: "m60-lan-4", months: 60, domain: "language", title: "Uses or recognises simple rhymes" },
    { id: "m60-cog-1", months: 60, domain: "cognitive", title: "Counts to 10" },
    { id: "m60-cog-2", months: 60, domain: "cognitive", title: "Names some numbers between 1 and 5 when you point to them" },
    { id: "m60-cog-3", months: 60, domain: "cognitive", title: "Uses words about time, like yesterday and tomorrow" },
    { id: "m60-cog-4", months: 60, domain: "cognitive", title: "Pays attention for 5 to 10 minutes during activities" },
    { id: "m60-cog-5", months: 60, domain: "cognitive", title: "Writes some letters in their name" },
    { id: "m60-cog-6", months: 60, domain: "cognitive", title: "Names some letters when you point to them" },
    { id: "m60-mot-1", months: 60, domain: "motor", title: "Buttons some buttons" },
    { id: "m60-mot-2", months: 60, domain: "motor", title: "Hops on one foot" },
];

// Titles are compared through this, never with `===`.
//
// The checklist used to match on exact equality, which meant the demo account
// showed empty checkboxes beside a gallery of achieved milestones: the seed
// wrote "Rolled Over (Tummy to Back)" where the checklist said "Rolls Over
// (Tummy to Back)". Now that a parent types milestone titles by hand, exact
// matching would fail on a stray capital or a double space too.
export function normalizeTitle(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

// The child's own milestone record for a checklist item, or undefined.
export function findRecorded(milestones, title) {
    const key = normalizeTitle(title);
    if (!key) return undefined;
    return (milestones || []).find((m) => normalizeTitle(m.title) === key);
}

// Every item in one age band, in DOMAINS order so the screen's four groups
// always appear in the same sequence.
export function itemsForCheckpoint(months) {
    const order = DOMAINS.map((d) => d.key);
    return AGE_CHECKLISTS.filter((c) => c.months === months).sort(
        (a, b) => order.indexOf(a.domain) - order.indexOf(b.domain),
    );
}

// Chips for the add-milestone form's title field: checklist items this child
// has NOT recorded yet, drawn from their current age band and the one before
// it. Against a ~150-item corpus an age-blind list would offer newborn
// milestones to a four-year-old.
//
// Deliberately unlike foodSuggestions(), which offers what you logged before —
// foods repeat, milestones do not. Suggesting "First Steps" to someone who
// already recorded it invites a duplicate record for an event that happened
// once.
export function suggestedTitles(milestones, ageMonths, limit = 6) {
    const taken = new Set((milestones || []).map((m) => normalizeTitle(m.title)).filter(Boolean));
    const band = checkpointFor(ageMonths);
    const prev = CHECKPOINTS[Math.max(0, CHECKPOINTS.indexOf(band) - 1)];
    const pool = band === prev ? [band] : [band, prev];
    return AGE_CHECKLISTS.filter((c) => pool.includes(c.months))
        .map((c) => c.title)
        .filter((t) => !taken.has(normalizeTitle(t)))
        .slice(0, limit);
}
