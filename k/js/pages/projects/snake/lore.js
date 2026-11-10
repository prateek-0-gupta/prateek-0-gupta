// Nagmani: the words. Story, wards, boons. No logic lives here.

export const ASSET_BASE = 'js/pages/projects/snake/snake_assets/';

// ═══════════════════════════════════════════════════════════════════
// STORY DATA
// ═══════════════════════════════════════════════════════════════════
// The descent: three wards of the city, then the bridge. Each ward is built fresh every time he wakes.
// ambient: the colour of the dark (the light map's floor); tint: multiplied over the ground;
// roster: [type, cost, weight]; budget: what a chamber may spend on its dead; need: pieces that break the seal.
export const WARDS = [
    {
        num: 'I', title: 'The Sunken Gardens', epigraph: 'Bhogavati, where the diyas burnt out. Its light was never the sun.',
        ambient: [70, 82, 66], tint: '#dfe6cf', diya: '255,190,110', mote: 'firefly', haze: '120,150,90',
        roster: [['wraith', 1, 6], ['hunter', 2, 2]], budget: 4, need: 5,
        rooms: ['The Lotus Walk', 'The Banyan Court', 'The Pilgrims\u2019 Stair', 'The Peacock Terrace', 'The Dry Fountain', 'The Swing Garden'],
        landmark: 'The Lotus Ghat',
        boss: {
            id: 'vrika', name: 'Senapati Vrika', title: 'Hound-Master of the Brass King', sheet: 'hunter', tint: null, aura: '255,70,40',
            size: 250, r: 46, hp: 110, speed: 1.5, attacks: ['charge', 'summon', 'slam'], adds: ['hunter', 'wraith'],
            line: 'Vrika. Your hounds are Sarama’s line; she found the Panis’ cave, and they found our seal. Tonight you are the one inside the circle.',
        },
    },
    {
        num: 'II', title: 'The Brass Quarter', epigraph: 'Kalash\u2019s men do not sleep. They were never allowed to.',
        ambient: [92, 62, 50], tint: '#ecd2bc', diya: '255,150,80', mote: 'ember', haze: '200,90,40',
        roster: [['wraith', 1, 3], ['hunter', 2, 4], ['mantrik', 2, 3], ['sentinel', 4, 2]], budget: 6, need: 5,
        rooms: ['The Bell Foundry', 'The Armourers\u2019 Row', 'The Palanquin Yard', 'The Coin Hall', 'The Smelting Court', 'The Envoy\u2019s Gate'],
        landmark: 'The Kansa Bazaar',
        boss: {
            id: 'loha', name: 'Loha', title: 'Warden of the Forge', sheet: 'sentinel', tint: ['#ff7a30', 0.28], aura: '255,120,40',
            size: 300, r: 58, hp: 150, speed: 1.05, attacks: ['slam', 'rings', 'charge', 'summon'], adds: ['wraith', 'hunter'],
            line: 'The Forge-Warden. Maya built the asuras an iron city in the sky. This one only learned to pour brass into his own men and call it a gift.',
        },
    },
    {
        num: 'III', title: 'The Drowned Sanctum', epigraph: 'Rasatala. The water remembers what the stone forgot.',
        ambient: [48, 74, 88], tint: '#c4dce2', diya: '170,220,255', mote: 'mist', haze: '70,130,150',
        roster: [['wraith', 1, 2], ['preta', 1, 4], ['drowned', 2, 4], ['mantrik', 2, 3], ['hunter', 2, 2], ['sentinel', 4, 1]], budget: 8, need: 5,
        rooms: ['The Ablution Tank', 'The Hall of Bells', 'The Flooded Cloister', 'The Garbhagriha', 'The Priests\u2019 Stair', 'The Offering Hall'],
        landmark: 'The Stepwell',
        boss: {
            id: 'mahant', name: 'The Mahant', title: 'He Who Sold the Bells', sheet: 'drowned', tint: ['#e8c060', 0.3], aura: '120,230,230',
            size: 260, r: 50, hp: 170, speed: 1.2, attacks: ['dive', 'rings', 'orbs', 'summon'], adds: ['drowned', 'preta'],
            line: 'Mahant. You sold the bells for a god\u2019s attention. You have mine.',
        },
    },
    {
        num: 'IV', title: 'The Vaitarani Bridge', epigraph: 'The river keeps what it is owed.',
        ambient: [62, 52, 86], tint: '#d6cce6', diya: '230,200,255', mote: 'void', haze: '110,80,170',
        roster: [['preta', 1, 3], ['hunter', 2, 3], ['mantrik', 2, 3], ['drowned', 2, 2], ['sentinel', 4, 3]], budget: 10, need: 0,
        rooms: ['The First Landing', 'The Broken Span', 'The Last Landing'],
        landmark: 'The Toll House',
        boss: {
            id: 'kalash', name: 'Maharaja Kalash', title: 'The Brass King', sheet: 'sentinel', tint: ['#ffd070', 0.34], aura: '255,200,90',
            size: 380, r: 74, hp: 260, speed: 1.1, attacks: ['slam', 'charge', 'rings', 'orbs', 'summon'], adds: ['sentinel', 'hunter', 'mantrik'],
            line: 'Kalash. Named for the pot the amrita came up in. You wanted to be Rahu without the cut. Look at what the stone kept.',
        },
    },
];
export const PIECES_TOTAL = 27;      // nine in each of the three wards: the 27 nakshatras
export const WARD_PIECES = 9;

// The 27 pieces as the 27 nakshatras, the houses of the moon (Soma, the cup of amrita), in their
// traditional order with their presiding deities: 1–9 in the Gardens, 10–18 in the Brass Quarter,
// 19–27 in the Sanctum. Ashlesha, the serpents' own, is the last piece of the first ward.
// Revati's Pushan guards the road of the dead, so the final piece sends him to the bridge.
// Not wired yet: use for pickup toasts or the piece counter.
export const NAKSHATRAS = [
    { name: 'Ashvini',           deity: 'the Ashvins',     line: 'The part of you that tended wounds before asking whose they were.' },
    { name: 'Bharani',           deity: 'Yama',            line: 'The part of you that was never afraid of endings.' },
    { name: 'Krittika',          deity: 'Agni',            line: 'The part of you that lit the diyas every evening, without fail.' },
    { name: 'Rohini',            deity: 'Prajapati',       line: 'The moon’s favourite. The part of you I loved first and most unfairly.' },
    { name: 'Mrigashira',        deity: 'Soma',            line: 'The deer’s head. The part of you always turning toward a sound.' },
    { name: 'Ardra',             deity: 'Rudra',           line: 'The part of you that wept, and was not ashamed to.' },
    { name: 'Punarvasu',         deity: 'Aditi',           line: 'The return of the light. The part of you that always came back.' },
    { name: 'Pushya',            deity: 'Brihaspati',      line: 'The part of you that fed people. The rice, the milk, the patience.' },
    { name: 'Ashlesha',          deity: 'the Sarpas',      line: 'The entwiner. The part of you that held on to a serpent and did not let go.' },
    { name: 'Magha',             deity: 'the Pitrs',       line: 'The part of you that remembered your mother’s mother’s name.' },
    { name: 'Purva Phalguni',    deity: 'Bhaga',           line: 'The part of you that laughed at kings.' },
    { name: 'Uttara Phalguni',   deity: 'Aryaman',         line: 'The part of you that kept promises. Aryaman keeps the marriage vow.' },
    { name: 'Hasta',             deity: 'Savitr',          line: 'Your hand. The one you put flat against the stone.' },
    { name: 'Chitra',            deity: 'Tvashtr',         line: 'The part of you that made things. Rangoli, garlands, a life out of very little.' },
    { name: 'Svati',             deity: 'Vayu',            line: 'The part of you that would not stay where it was put.' },
    { name: 'Vishakha',          deity: 'Indra and Agni',  line: 'The part of you that told me no, and was right.' },
    { name: 'Anuradha',          deity: 'Mitra',           line: 'The part of you that was my friend before it was anything else.' },
    { name: 'Jyeshtha',          deity: 'Indra',           line: 'The part of you that stood behind me at the bargain and said nothing.' },
    { name: 'Mula',              deity: 'Nirriti',         line: 'The root. The part of you that knew, before I did, how this would end.' },
    { name: 'Purva Ashadha',     deity: 'the Waters',      line: 'The part of you that went into water without startling.' },
    { name: 'Uttara Ashadha',    deity: 'the Vishvedevas', line: 'The part of you that belonged to the whole village, and chose me.' },
    { name: 'Shravana',          deity: 'Vishnu',          line: 'The ear. The part of you that listened when I did not deserve it.' },
    { name: 'Dhanishtha',        deity: 'the Vasus',       line: 'The part of you that sang off-key at aarti and did not care.' },
    { name: 'Shatabhisha',       deity: 'Varuna',          line: 'A hundred healers could not have closed this one. Varuna kept it anyway.' },
    { name: 'Purva Bhadrapada',  deity: 'Aja Ekapada',     line: 'The part of you that was fierce. One-footed as the storm-goat, and as stubborn.' },
    { name: 'Uttara Bhadrapada', deity: 'Ahir Budhnya',    line: 'The serpent of the deep. The part of you that was always, a little, mine.' },
    { name: 'Revati',            deity: 'Pushan',          line: 'The last. Pushan keeps the road for travellers and the dead. Walk with me to the bridge.' },
];

// The nine Memories of Amrita, found in order, one to a ward, so no single descent can hold them all.
// Together they are the story the title only hints at; each one also changes him for good (MEMORY_PERKS).
export const MEMORIES = [
    {
        title: 'The Lotus Pool',
        text: 'I wore a man’s shape that morning, because the pool was shallow and I was vain. She was kneeling at the ghat with a brass pot, and she did not startle when the water went dark with my shadow. She looked at the ripples, then at me, and said, “You are standing on my reflection.” I stepped aside. I have been stepping aside for her ever since.',
    },
    {
        title: 'Her Name',
        text: 'Amrita. Nectar. The word the gods churned the ocean for. Her mother named her that in a village where children die of thirst, and she laughed when I told her it was a dangerous name to carry near a king. “Names are only dangerous to the people who want them,” she said. She did not know yet how many people would want hers.',
    },
    {
        title: 'The Seven Hoods',
        text: 'I showed her what I was on the night of the dark moon. Seven hoods rising behind me, the Nagmani burning in my brow like a second heart. I expected her to run. She reached up and put her palm flat against the stone of it and said it was warm, like a sleeping animal. Nobody had touched it in a thousand years. Nobody had wanted to.',
    },
    {
        title: 'The Brass Envoy',
        text: 'The envoy came in a palanquin of beaten brass with bells on every corner so the dying could hear him approach. Maharaja Kalash, he said, was old, and had heard that the Naga kept a stone that would not let a man die. He asked for a splinter of it. A splinter. I had a thousand pieces in my brow and I told him the Nagmani was not a thing that was divided. Amrita said, afterwards, that I had sounded exactly like a king. She did not mean it kindly.',
    },
    {
        title: 'The Bargain',
        text: 'Kalash himself came down the last time, carried, because his legs had already turned to metal. He offered me his kingdom for the Nagmani, and then, when I laughed, he offered to take it and leave the city standing. One stone for ten thousand people. Amrita stood behind me and said nothing, because she had already said it. I told him immortality is not a thing you own. It is a thing that owns you. He smiled with a mouth that was already brass and said, \u201CThen it owns you, Serpent King.\u201D He was right.',
    },
    {
        title: 'The Bells That Did Not Ring',
        text: 'Every shrine in Patala has a bell, and every bell is sworn to ring when a mortal crosses the seal. The night they came, not one of them sounded. The priests had been paid in the only coin that works on the devout: a promise that their gods would notice them. I woke to silence. I have hated silence since. Ring the bells for me, if you find them. Ring them all.',
    },
    {
        title: 'The Shattering',
        text: 'They came down every street at once. I could have given it to him at the gate and they would have gone home. I stood in the Gardens with the stone in my brow and let the city burn around me to keep it, and when he reached me he could not take it, so he broke it there. A brass mace into the heart of the world. A thousand pieces went up like sparks from a fire kicked over. Twenty-seven of them went through her. I remember the sound. I do not remember anything after it for a very long time.',
    },
    {
        title: 'Her Last Word',
        text: 'She said my name. Not the title. Not Naagraj, not Serpent King, not any of the words carved over doorways. The small one, the one from before, that I have not heard in anyone else’s mouth since and will not write here. Then the void took her by the shard in her chest and pulled, and she went into the dark the way she went into water: without startling.',
    },
    {
        title: 'The Curse',
        text: 'This is the part I have been avoiding. Kalash did not curse me. I did. I swore on the broken stone that I would not rest until every piece of her was back in my coils, and the stone, which was mine and which I had killed a city to keep, heard me and kept me. I cannot die. I can only fall and get up longer. Every shard of it I swallow lengthens me; I swallow them anyway, because I am what I am. Amrita, when I have all of you, I will carry you to the bridge and lay the stone down on the far side, and we will see whether a river can take a king.',
    },
];

export const QUOTES = {
    ambient: [
        'The stone is cold. I cannot feel your warmth anymore.',
        'Patala is silent, save for the echo of my own scales.',
        'I will find every piece of you, Amrita. Even if it takes eternity.',
        'The diyas have all burnt out. Only the dark remains.',
        'They broke the seal. They brought mortal rot into our sanctuary.',
        'Where did they scatter your soul, my lotus?',
        'The banyan roots drink from a dry, dead earth.',
        'I slept while they took everything from me. Forgive me.',
        'A shattered Nagmani... a shattered heart.',
        'Even the gods have abandoned this sunken temple.',
        'The Asuras watch me from the fog. They know my burden.',
        'The Nagmani pulses like a dying heartbeat in the abyss.',
        'The dark is closing in, but your golden light guides my fangs.',
    ],
    act: [
        [
            'These were the gardens. I can still find the paths under the dust.',
            'A thousand diyas lined this walk once. I will light what I can.',
            'The trees have grown through the places where we sat.',
        ],
        [
            'Brass. I smell brass on the air. His men are closer here.',
            'They hunt in the dark because they cannot bear to be seen as they are.',
            'Kalash wanted to live forever. He gave his soldiers the same gift without asking.',
            'Shed your skin when they close in. They cannot hold what is already gone.',
        ],
        [
            'The sanctum flooded when the seal broke. The priests are still in the water.',
            'Do not trust the puddles. Something has learned to wait in them.',
            'The water here is black and remembers every face that drowned in it.',
            'They weep under the surface. They were paid to be silent and now they cannot stop.',
        ],
        [
            'I can feel the void from here. It is pulling at the shards in my body.',
            'The fog is thickest at the threshold. It does not want me to see what is left.',
            'His Sentinels still guard a door that no longer leads anywhere.',
            'Almost, Amrita. Almost. Hold on to the dark a little longer.',
        ],
    ],
    eat: [
        'Each memory of you I consume makes me heavier.',
        'My body stretches into the dark. I am becoming a prisoner of my own sorrow.',
        'Another shard. Another echo of your laugh in my mind.',
        'The Prana burns going down, but it is all I have left of you.',
        'I am growing too large for these cursed halls.',
        'I drag my past behind me like a chain of black iron.',
        'How can a soul made of light weigh so much?',
        'Your essence binds my flesh, elongating my suffering.',
        'To remember you is a burden I gladly bear, no matter the agony.',
        'I coil endlessly around the empty spaces where you used to walk.',
        'Just one more shard... just one more memory...',
    ],
    enemy: [
        'The ghosts of the Brass King still wander my halls.',
        'Tarnished armor. Hollow souls. I will crush them all.',
        'Maharaja Kalash sought immortality. Now his men are dust in the wind.',
        'They guard the ruins of the paradise they destroyed.',
        'Their red eyes mock my failure from the fog.',
        'Do not block my path, shadow. You have already taken enough.',
        'They smell of old blood, rusted greed, and burnt offerings.',
        'Even in death, the King’s men cannot escape Patala’s judgment.',
        'I will not let their corrupted ash touch your pure light.',
    ],
    hunter: [
        'A Hunter. It has my scent. Good. Let it come to me.',
        'They run on brass legs that never tire. Mine do not tire either.',
        'It smells the Nagmani in me. Everything that was his wants it back.',
    ],
    drowned: [
        'A priest. Still wearing the beads he sold us for.',
        'It rose from the puddle like it had been waiting a thousand years. It had.',
        'The Drowned lunge once and rest. Grief has made them slow learners.',
    ],
    sentinel: [
        'A Sentinel. Kalash made them headless so they could not question him.',
        'Brass and bone and a mace the size of a doorway. It will not stop. Neither will I.',
        'It cannot be unmade. It can only be outlasted.',
    ],
    spirit: [
        'The innocent souls flee from me... Have I become a monster?',
        'Do not run, little spirit. I only need your spark.',
        'I must consume them to sustain my hunt. Forgive my hunger.',
        'They weep as they run, just as you wept when the blade fell.',
        'Their fear is a bitter nectar, but it fuels my descent.',
        'I am the lord of this underworld! Why do you hide?',
        'Come back into the dark. Give me her memory.',
        'A fleeting wisp of life in a graveyard of stone.',
        'Am I the villain of their story now? So be it, if it brings you back.',
        'Rest now in my coils, wandering soul. Your terror is over.',
    ],
    growth: [
        'There is so much of you to carry. I am suffocating in our past.',
        'I am an endless labyrinth of flesh and grief.',
        'It is so hard to turn, so hard to move. I am trapped by my own immense size.',
        'Amrita... are you watching me become this abomination?',
        'I cannot even see my own tail. I am an ouroboros of despair.',
        'If I must swallow the entire underworld to find you, I will.',
    ],
    shrine: [
        'One diya lit. The dark is one flame smaller.',
        'A small light for you, Amrita. Follow it if you can.',
        'The shrine remembers me. The flame took at once.',
        'If I fall, I will wake here, beside the flame. Let that be enough.',
    ],
    bell: [
        'Ring. RING. Let them hear what the priests would not sound.',
        'The bell still knows its duty, even if the men who kept it did not.',
        'They scatter from the toll like ash from a slammed door.',
        'A thousand years late, the warning finally rings.',
    ],
    shed: [
        'I leave my skin behind and for a breath I am nothing they can hold.',
        'Shed the weight. Shed the grief. Keep the hunger.',
        'The curse says I may not rest. It said nothing about becoming smaller.',
        'My old skin lies in the dust. Let them chase that instead.',
    ],
    banish: [
        'Unmade. Go and tell your king what a serpent is.',
        'Brass to ash. He promised them forever. I give them an end.',
        'Nothing of Kalash will stand between me and her.',
    ],
    memory: [
        'A memory. Her memory. I had forgotten I had forgotten it.',
        'It comes back like a blade pulled out slowly.',
        'Hold still, Amrita. I have found another piece of you.',
    ],
    greed: [
        'More of the stone. It is always more of the stone. This is how it started.',
        'I can feel them turning their heads. They smell it on me, the way he did.',
        'Longer. Brighter. Hungrier. Nothing in me has learned anything.',
        'The whole city burned for this taste, and I still want it.',
    ],
    piece: [
        'There. A piece of you, cold as river stone. I have you.',
        'I know this one. This is the part of you that laughed at kings.',
        'Twenty-seven pieces. I am counting. I have never counted anything for anyone.',
        'Come here, my lotus. Come back into the dark with me a while longer.',
        'Each piece of you is lighter than the stone. Each one weighs more.',
    ],
    bite: [
        'The stone\u2019s own venom. This is what it was for. Not to keep.',
        'Unmade. One of his soldiers for a mouthful of what I hoarded.',
        'My fangs still work. Everything else of me has rusted.',
    ],
    empty: [
        'Dry. Give it a moment, or feed it the stone.',
        'No venom yet. Fangs, then, if they come close.',
    ],
    hurt: [
        'Brass in my side. I have had worse from myself.',
        'They bite back. Good. Let them.',
        'The stone knits me. It always does. That is the curse.',
    ],
    drop: [
        'No. NO. She fell from me. Go back. Go back for her.',
        'I felt her slip as I went down. She is lying where I fell.',
        'I have dropped her in the street like a thief drops what he stole. Get up. Go back.',
    ],
    recover: [
        'I have you again. I will not fall with you again. I will.',
        'Forgive me. The dark had you for a moment. It will not keep you.',
    ],
    gate: [
        'The bridge will not hold a king who leaves his queen behind. I know. I built it that way.',
        'Not yet. She is still in the streets. All of her comes, or none of me goes.',
        'The river asks what I carry. Not enough. Not yet.',
    ],
    coil: [
        'Kundali. The oldest thing a serpent knows.',
        'They walked into the circle. Everyone does, in the end.',
        'I close around them the way the city closed around me.',
        'This is what the length is for. Not to keep. To hold.',
        'Kundalini sleeps coiled three and a half times. I am not asleep.',
        'Shesha holds the whole world in his coils. I can manage a few of Kalash’s men.',
    ],
    seal: [
        'The bells. Now they ring.',
        'Sealed in with them. Good. I was never the one who needed a door.',
        'The chamber shuts. The city wants to watch.',
        'The ghanta tells the god you have come and tells the asuras to leave. Too late for leaving.',
    ],
    cleared: [
        'Quiet. Light the diyas. Let her see the way.',
        'The chamber is mine again. It was always mine. That was the trouble.',
        'One room of ten thousand. I will take them all back.',
    ],
    boon: [
        'A boon from a shrine I let go dark. It is more than I am owed.',
        'The old gods still answer. I wish they would not be so kind.',
        'Vardaan. Brahma gave Ravana a boon too. Every boon has a gap in it somewhere.',
        'Hiranyakashipu asked for a death that could not come by day or night. It came at dusk. I ask for nothing so clever.',
    ],
    yaksha: [
        'A Yaksha. Where there is a hoard there is always one of them, weighing it.',
        'He trades in weight. I have more of that than anything.',
        'Kubera’s kind. They have counted every treasure since the world had one.',
        'A Yaksha once asked Yudhishthira the greatest wonder: that men watch others die and live as if they never will. I do not even get to die.',
    ],
    sealed: [
        'The ward\u2019s seal knows what I carry. Not enough of her. Not yet.',
        'It will not open for a king. Only for what he has gathered.',
    ],
    unsealed: [
        'The seal breaks. Something on the other side has waited a thousand years for that sound.',
    ],
    wake: [
        'The Gardens again. The streets have moved in the night.',
        'I fell. I woke. The city has dealt itself a new hand.',
        'Again. The curse does not tire, so neither may I.',
        'She was in my coils. Now she is scattered, and the stone is laughing.',
        'Samsara, but smaller. The same Gardens, a different shape every time.',
        'The streets thrown again, like Shakuni’s dice. The dice were always loaded.',
    ],
    descend: [
        'Deeper. Every ward is further from the Gardens and nearer the river.',
        'Down. She is whole only on the far side of all of this.',
        'Atala, Vitala, Sutala, Talatala, Rasatala, Mahatala. Patala is the bottom. Below Patala there is only the river.',
    ],
    lastword: [
        'She said the small name. I am not finished.',
    ],
    death: [
        'The coil goes slack. The Gardens will have him back by morning.',
        'The coils tightened. The memories suffocated you.',
        'Amrita, I have failed. The dark reclaims us both.',
        'A serpent choked by its own endless tail.',
        'Your grief was too great a labyrinth to escape.',
        'Brass and bone. The Brass King’s dead take one more.',
        'Yama’s noose. Chitragupta writes it in the ledger, and the stone tears out the page.',
    ],
};

export const VICTORY = {
    trueEnding: {
        title: 'ASCENSION',
        text: 'He carries all twenty-seven pieces of her onto the bridge and the bridge holds. On the far side he lays the Nagmani down in the road, the whole hoard of it, the thing he burned a city to keep, and the river takes it without a sound.<br><br>'
            + 'She comes together in his coils the way water finds its level. She does not startle. She looks at the long dark length of him, at the brass dust on his fangs, at the {deaths} times he fell for her written in his scales, and she says the small name, the one from before, and he remembers every morning that led here.<br><br>'
            + 'He remembers how to be a man. He remembers how to be small. The Serpent King is done repenting; there is nothing left in him to repent with. They go up together, and behind them the city of Patala goes dark for the last time, and is at peace.',
    },
    hollow: {
        title: 'ACROSS THE RIVER',
        text: 'He carries all twenty-seven pieces of her onto the bridge and the bridge holds. On the far side he lays the Nagmani down in the road, the whole hoard of it, and the river takes it without a sound.<br><br>'
            + 'She comes together in his coils the way water finds its level. She looks at him. He does not remember the morning at the lotus pool, or her name, or the small word she said at the end; <strong>{missing} of the nine Memories</strong> are still waiting in the city behind him. She remembers all of it. She takes his hand anyway.<br><br>'
            + 'He fell {deaths} times on the way here and swallowed {greed} shards of the thing that did this. It does not matter now. They go up together, and the city goes dark behind them, and this time it is only the dark.',
    },
};

// Told when Kalash falls with pieces of her still lying in the wards behind him.
VICTORY.incomplete = {
    title: 'THE FAR BANK',
    text: 'The Brass King comes apart on his own bridge, and the river takes him at last, grateful as a man lying down.<br><br>'
        + 'Naagraj crosses. Beneath him the Vaitarani runs red. He lays the Nagmani in the road on the far side, the whole hoard of it. Nothing happens. He is carrying <strong>{pieces} of the twenty-seven pieces</strong> of her, and a woman is not a thing that comes back in part. Shiva carried Sati across the whole world and could not make her whole from what he held.<br><br>'
        + 'He waits on the bank until the diyas behind him gutter. Then the stone, which heard his oath and has not forgotten it, turns him around. He fell {deaths} times before this. He will wake in the Gardens. The streets will have moved.',
};

// ═══════════════════════════════════════════════════════════════════
// WHAT EACH MEMORY LEAVES IN HIM (kept across every descent)
// ═══════════════════════════════════════════════════════════════════
export const MEMORY_PERKS = [
    'She steadies you: +10 Prana, always.',
    'Shrines offer one more boon to choose from.',
    'You wake four segments longer.',
    'The Yaksha asks a quarter less.',
    'You wake already carrying one boon.',
    'Bells find their voice again twice as fast.',
    'The coil crushes harder: +2.',
    'Once each descent, a killing blow leaves you standing at the edge instead.',
    'You know what the bridge wants. The true crossing is open to you.',
];

// ═══════════════════════════════════════════════════════════════════
// BOONS (Vardaan). Taken at shrines, from champions, from the Yaksha.
// aspect: fang | venom | coil | skin | prana. stack: may be taken more than once.
// ═══════════════════════════════════════════════════════════════════
export const BOONS = [
    { id: 'vajra',    aspect: 'fang',  name: 'Vajra Fangs',      skt: 'Vajra-danta',   stack: 3, text: 'Your fangs strike for +2.' },
    { id: 'rakta',    aspect: 'fang',  name: 'Blood-Drinker',    skt: 'Rakta-pa',      text: 'A kill with the fangs restores 5 Prana.' },
    { id: 'garuda',   aspect: 'fang',  name: 'Garuda\u2019s Debt', skt: 'Garuda-rina', text: 'Fangs strike three times as hard against the stunned and the bound.' },
    { id: 'halahala', aspect: 'venom', name: 'Halahala',         skt: 'Hal\u0101hala', text: 'Venom keeps burning: 3 more over three seconds.' },
    { id: 'twin',     aspect: 'venom', name: 'Twin Glands',      skt: 'Yugma-visha',   text: 'Every spit is two bolts.' },
    { id: 'deep',     aspect: 'venom', name: 'Deep Glands',      skt: 'Gabhira',       stack: 2, text: 'Venom refills 60% faster and holds 40 more.' },
    { id: 'pierce',   aspect: 'venom', name: 'Kalakuta',         skt: 'K\u0101lak\u016Bta', text: 'Bolts pass through the first two they strike.' },
    { id: 'crush',    aspect: 'coil',  name: 'Vasuki\u2019s Grip', skt: 'V\u0101suki-bandha', stack: 3, text: 'The coil crushes for +4.' },
    { id: 'ouro',     aspect: 'coil',  name: 'Endless Coil',     skt: 'Ananta',        text: 'Each of the dead crushed in a coil restores 4 Prana.' },
    { id: 'mandala',  aspect: 'coil',  name: 'Mandala',          skt: 'Mandala',       text: 'Closing a coil sends out a ring that stuns everything near it.' },
    { id: 'scales',   aspect: 'coil',  name: 'Iron Scales',      skt: 'Loha-kavacha',  text: 'Your body takes no harm. Only the head can be hurt.' },
    { id: 'hoard',    aspect: 'coil',  name: 'Hoarder\u2019s Coil', skt: 'Lobha',      text: '+8 length now, and every shard lengthens you twice.' },
    { id: 'molt',     aspect: 'skin',  name: 'Quick Molt',       skt: 'Kshipra',       text: 'Shedding costs no length and returns 45% sooner.' },
    { id: 'slough',   aspect: 'skin',  name: 'Venomous Slough',  skt: 'Visha-kanchuka', text: 'Your shed skin bursts when it fades: 6 to all that stand on it.' },
    { id: 'second',   aspect: 'skin',  name: 'Second Skin',      skt: 'Dvitiya',       text: 'Once in each ward, a killing blow sheds you instead.' },
    { id: 'lotus',    aspect: 'prana', name: 'Lotus Heart',      skt: 'Padma-hridaya', stack: 3, text: '+25 Prana, and filled.' },
    { id: 'bell',     aspect: 'prana', name: 'Bell-Sworn',       skt: 'Ghant\u0101-vrata', text: 'Bells stun twice as long and wound for 4.' },
    { id: 'diya',     aspect: 'prana', name: 'Diya\u2019s Grace', skt: 'Deepa-kripa',  text: 'Every chamber you clear restores 10 Prana.' },
    { id: 'sight',    aspect: 'prana', name: 'Naga\u2019s Sight', skt: 'N\u0101ga-drishti', text: 'You know each ward\u2019s plan the moment you enter it.' },
];
export const ASPECTS = {
    fang:  { label: 'Fang',  color: '#e6cf8f' },
    venom: { label: 'Venom', color: '#b9e06a' },
    coil:  { label: 'Coil',  color: '#f0a060' },
    skin:  { label: 'Skin',  color: '#c9b58a' },
    prana: { label: 'Prana', color: '#ff9a7a' },
};

// The Yaksha weighs what you carry. His prices are paid in your own length.
// (Yakshas are Kubera's treasure-keepers; the one at the lake tested Yudhishthira with questions.)
export const YAKSHA = [
    { id: 'heal',  name: 'Lotus Water',   skt: 'Padma-jala', cost: 5,  text: 'Restore 45 Prana.' },
    { id: 'boon',  name: 'A Sealed Boon', skt: 'Vardaan',    cost: 9,  text: 'A boon you do not get to choose.' },
    { id: 'heart', name: 'A Second Pulse', skt: 'Spanda',    cost: 7,  text: '+15 Prana for the rest of this descent.' },
];

// Things said once, to the player rather than by the king.
export const HINTS = {
    move:   'WASD or arrows to steer. He never stops moving.',
    coil:   'Circle the dead and cross your own body. The closed coil crushes everything inside it.',
    strike: 'F to strike: fangs up close, venom at range.',
    shed:   'Space to shed your skin: a burst of speed nothing can touch, and a husk they will chase.',
    seal:   'Gather pieces of her from the chambers. Enough of them breaks the ward\u2019s seal.',
    body:   'Your body is a wall to the dead. It is also the only purse you have.',
    armour: 'Brass turns your fangs. Bind him in a coil to break it.',
    bell:   'Touch a bell to stun everything that hears it.',
    yaksha: 'The Yaksha is paid in length. A shorter serpent closes smaller coils.',
};