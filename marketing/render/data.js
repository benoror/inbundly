// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2026  Ben Orozco

// The fake data set for the store/site renders, from the visuals plan's
// "Render spec for Lucca" (sections C4 and S1, with its name-check log of
// 2026-10-21). Every name is invented. The only .com domains are the three
// that appear on screen as sender-bundle titles (parcelwick.com,
// fennimintmarket.com, puffinjet.com: unregistered, no business found) plus
// kiteboxcloud.com, which the plan's log checked and kept. Everything else
// is on the reserved .example TLD. No gmail.com or other freemail address
// appears, so the fixture's freemail list is never needed.
//
// Rows marked `extra` are not in the plan's 21-row table; a shot needed more
// threads than the table has (S1 counts Receipts 5, Newsletters 6, Family 4;
// C3 needs 6 Work threads; C4 needs 3 Fennimint rows; S-alt-V a "trip"
// search). They reuse the plan's senders and domains only.

// Gmail label palette pairs (pastel chip, dark text), so the accent picks a
// dark hue on light themes and the pastel on dark ones.
const LABEL_COLORS = {
    'Work': { background: '#a4c2f4', color: '#1c4587' },
    'Work/Clients': { background: '#b9e4d0', color: '#0b4f30' },
    'Travel': { background: '#89d3b2', color: '#0b4f30' },
    'Receipts': { background: '#ffc8af', color: '#7a2e0b' },
    'Family': { background: '#fbc8d9', color: '#711a36' },
    'Newsletters': { background: '#d0bcf1', color: '#41236d' },
    'School': { background: '#fce8b3', color: '#594c05' },
    'Home': { background: '#e3d7ff', color: '#3d188e' },
};

const NAV_LABELS = Object.keys(LABEL_COLORS).map(name => ({
    name, color: LABEL_COLORS[name].background,
}));

// The plan's table, keyed for scene building.
const T = {
    puffTrip: { sender: 'Puffinjet Air', email: 'itinerary@puffinjet.com', labels: ['Travel'], subject: 'Your trip to Lisbon is confirmed', snippet: 'Flight PJ 482 departs Fri 7:15 AM from Gate B12' },
    casaCheckin: { sender: 'Casa Mirabruma', email: 'hello@casamirabruma.example', labels: ['Travel'], subject: 'Check-in details for Nov 14', snippet: 'Your door code arrives the morning of your stay' },
    puffCheckin: { sender: 'Puffinjet Air', email: 'checkin@puffinjet.com', labels: ['Travel'], subject: 'Check in now for PJ 482', snippet: 'Choose your seat and get your boarding pass' },
    fenniReceipt: { sender: 'Fennimint Market', email: 'orders@fennimintmarket.com', labels: ['Receipts'], subject: 'Receipt for order #40817', snippet: 'Thanks for shopping with us. Total $64.20' },
    kiteInvoice: { sender: 'Kitebox Cloud', email: 'billing@kiteboxcloud.com', labels: ['Receipts'], subject: 'Your October invoice', snippet: 'Plan: Personal 200 GB, $2.99' },
    parcelOut: { sender: 'Parcelwick', email: 'track@parcelwick.com', labels: [], subject: 'Out for delivery today', snippet: 'Your package from Fennimint is on the truck' },
    parcelDelivered: { sender: 'Parcelwick', email: 'track@parcelwick.com', labels: [], subject: 'Delivered: front porch', snippet: 'Photo of delivery attached' },
    parcelLabel: { sender: 'Parcelwick', email: 'track@parcelwick.com', labels: [], subject: 'Label created', snippet: 'We will email you when it ships' },
    slowHabits: { sender: 'The Slowmarrow Letter', email: 'weekly@slowmarrow.example', labels: ['Newsletters'], subject: 'Five small habits for a calmer week', snippet: 'This issue: inbox zero without the guilt' },
    briskTuesday: { sender: 'Brisklark Daily', email: 'daily@brisklark.example', labels: ['Newsletters'], subject: 'Tuesday brief: the cheap coffee test', snippet: 'Three things worth your two minutes' },
    thornSale: { sender: 'Thornwhistle Outdoors', email: 'news@thornwhistle.example', labels: ['Newsletters'], subject: 'Trail season sale ends Sunday', snippet: 'Up to 30% off packs and layers' },
    momLunch: { sender: 'Mom', email: 'rosa@alvarez.example', labels: ['Family'], subject: 'Sunday lunch at our place?', snippet: "Bring the kids, I'm making mole" },
    diegoPhotos: { sender: 'Diego Alvarez', email: 'diego@alvarez.example', labels: ['Family'], subject: 'Photos from the beach', snippet: 'Uploaded 42 photos to the shared album' },
    quillSlip: { sender: 'Quillbrook Elementary', email: 'office@quillbrook.example', labels: ['School'], subject: 'Field trip permission slip due Friday', snippet: 'Please sign and return by Oct 24' },
    mayaBudget: { sender: 'Maya Chen', email: 'maya@kestrelpine.example', labels: ['Work', 'Work/Clients'], subject: 'Q4 budget, final numbers', snippet: "Attached the sheet with Ana's changes" },
    anaReview: { sender: 'Ana Ruiz', email: 'ana@kestrelpine.example', labels: ['Work'], subject: 'Design review moved to 3 PM', snippet: 'Same room, new time' },
    samKickoff: { sender: 'Sam Okafor', email: 'sam@kestrelpine.example', labels: ['Work', 'Work/Clients'], subject: 'Kickoff notes: Harbor project', snippet: 'Action items at the bottom' },
    priyaRsvp: { sender: 'Priya Natarajan', email: 'priya@kestrelpine.example', labels: ['Work'], subject: 'Offsite RSVP', snippet: 'Need your answer by Thursday' },
    dentist: { sender: 'Pebblecove Dental', email: 'appointments@pebblecove.example', labels: ['Home'], subject: 'Dentist confirmation for Oct 28', snippet: 'Reply C to confirm' },
    lease: { sender: 'Birchnook Rentals', email: 'leasing@birchnook.example', labels: ['Home'], subject: 'Your lease renewal is ready', snippet: 'Review and sign by Nov 1' },
    passport: { sender: 'City Passport Office', email: 'noreply@passports.example', labels: [], subject: 'Passport renewal appointment', snippet: 'Bring two photos and your old passport' },

    // Extras (same senders and domains as the table)
    fenniShipped: { extra: true, sender: 'Fennimint Market', email: 'orders@fennimintmarket.com', labels: ['Receipts'], subject: 'Order #40817 has shipped', snippet: 'Parcelwick will bring it Tuesday' },
    puffSeat: { extra: true, sender: 'Puffinjet Air', email: 'itinerary@puffinjet.com', labels: ['Receipts'], subject: 'Receipt: seat upgrade on PJ 482', snippet: 'Extra legroom, $38.00' },
    kiteSeptember: { extra: true, sender: 'Kitebox Cloud', email: 'billing@kiteboxcloud.com', labels: ['Receipts'], subject: 'Your September invoice', snippet: 'Plan: Personal 200 GB, $2.99' },
    kiteStorage: { extra: true, sender: 'Kitebox Cloud', email: 'hello@kiteboxcloud.com', labels: [], subject: 'Your storage is almost full', snippet: "You've used 182 GB of 200 GB" },
    briskMonday: { extra: true, sender: 'Brisklark Daily', email: 'daily@brisklark.example', labels: ['Newsletters'], subject: 'Monday brief: why to-do lists lie', snippet: 'Three things worth your two minutes' },
    slowCalendar: { extra: true, sender: 'The Slowmarrow Letter', email: 'weekly@slowmarrow.example', labels: ['Newsletters'], subject: 'The case for a boring calendar', snippet: 'This issue: fewer meetings, same work' },
    thornShells: { extra: true, sender: 'Thornwhistle Outdoors', email: 'news@thornwhistle.example', labels: ['Newsletters'], subject: 'New rain shells for shoulder season', snippet: 'Light, packable, and on the trail now' },
    momRecipe: { extra: true, sender: 'Mom', email: 'rosa@alvarez.example', labels: ['Family'], subject: 'The recipe you asked for', snippet: "Grandma's mole, don't share it" },
    diegoPlans: { extra: true, sender: 'Diego Alvarez', email: 'diego@alvarez.example', labels: ['Family'], subject: 'Thanksgiving plans', snippet: 'We can bring dessert this year' },
    anaRedlines: { extra: true, sender: 'Ana Ruiz', email: 'ana@kestrelpine.example', labels: ['Work', 'Work/Clients'], subject: 'Harbor contract redlines', snippet: 'Two small changes on page 4' },
    priyaRetro: { extra: true, sender: 'Priya Natarajan', email: 'priya@kestrelpine.example', labels: ['Work'], subject: 'Sprint retro notes', snippet: 'What went well, what we change' },
    fenniBasket: { extra: true, sender: 'Fennimint Market', email: 'orders@fennimintmarket.com', labels: [], subject: 'Your basket is waiting', snippet: 'Oat milk and 3 more items' },
    fenniBack: { extra: true, sender: 'Fennimint Market', email: 'hello@fennimintmarket.com', labels: [], subject: 'Back in stock: cold brew beans', snippet: 'The house blend is back' },
    casaTips: { extra: true, sender: 'Casa Mirabruma', email: 'hello@casamirabruma.example', labels: ['Travel'], subject: 'A few tips before your trip', snippet: 'Our favorite bakeries near the flat' },
    puffTripReceipt: { extra: true, sender: 'Puffinjet Air', email: 'itinerary@puffinjet.com', labels: ['Receipts'], subject: 'Receipt for your Lisbon trip', snippet: 'PJ 482 and PJ 483, total $412.60' },
    fenniTrip: { extra: true, sender: 'Fennimint Market', email: 'orders@fennimintmarket.com', labels: ['Receipts'], subject: 'Receipt for order #40902', snippet: 'Trip snacks: trail mix and 4 more items' },
    diegoTrip: { extra: true, sender: 'Diego Alvarez', email: 'diego@alvarez.example', labels: ['Family'], subject: 'Road trip playlist', snippet: 'Added 20 songs for the drive' },
};

/**
 * One thread at a given age and clock time. `day` is days before the render
 * day (0 today, 1 yesterday). Date cell text and tooltip follow Gmail's
 * formats ("9:12 AM" today, "Oct 20" before that).
 */
function at(key, day, time, extra = {}) {
    return { key, day, time, ...extra };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseTime(time) {
    const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time);
    let h = Number(m[1]) % 12;
    if (m[3] === 'PM') {
        h += 12;
    }
    return [h, Number(m[2])];
}

/**
 * Fixture rows (threadRow options) for a scene, newest first, the order
 * Gmail lists them. `today` is the render day's local midnight.
 */
function rowsFor(entries, today) {
    return entries
        .map(e => {
            const d = new Date(today.getTime());
            d.setDate(d.getDate() - e.day);
            const [h, min] = parseTime(e.time);
            d.setHours(h, min, 0, 0);
            const base = T[e.key];
            if (!base) {
                throw new Error(`unknown thread ${e.key}`);
            }
            const { extra, ...thread } = base;
            return {
                when: d.getTime(),
                row: {
                    ...thread,
                    unread: !!e.unread,
                    starred: !!e.starred,
                    labels: e.labels || thread.labels,
                    labelColors: LABEL_COLORS,
                    dateText: e.day === 0
                        ? e.time
                        : `${MONTHS[d.getMonth()]} ${d.getDate()}`,
                    dateTitle: `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${e.time}`,
                },
            };
        })
        .sort((a, b) => b.when - a.when)
        .map(x => x.row);
}

// S1's inbox: Today has the starred passport row, Travel (3), Receipts (5),
// Newsletters (6) and 2 plain threads; Yesterday has Family (4), the
// parcelwick.com sender bundle (3), Work (4) and 1 plain thread. 3 unread.
const S1_INBOX = [
    at('passport', 0, '9:41 AM', { starred: true }),
    at('puffCheckin', 0, '9:12 AM', { unread: true }),
    at('fenniReceipt', 0, '8:47 AM', { unread: true }),
    at('quillSlip', 0, '8:15 AM', { unread: true }),
    at('slowHabits', 0, '7:30 AM'),
    at('kiteStorage', 0, '6:58 AM'),
    at('momLunch', 1, '6:40 PM'),
    at('parcelDelivered', 1, '4:12 PM'),
    at('mayaBudget', 1, '3:30 PM'),
    at('lease', 1, '11:50 AM'),
    at('anaReview', 1, '1:15 PM'),
    at('kiteInvoice', 1, '11:20 AM'),
    at('diegoPhotos', 1, '10:10 AM'),
    at('parcelOut', 1, '8:03 AM'),
    at('briskTuesday', 1, '7:00 AM'),
    at('puffTrip', 2, '5:45 PM'),
    at('samKickoff', 2, '4:20 PM'),
    at('fenniShipped', 2, '9:30 AM'),
    at('briskMonday', 2, '7:00 AM'),
    at('casaCheckin', 3, '12:10 PM'),
    at('parcelLabel', 3, '11:02 AM'),
    at('thornSale', 3, '8:00 AM'),
    at('momRecipe', 4, '7:15 PM'),
    at('puffSeat', 4, '2:40 PM'),
    at('slowCalendar', 4, '6:30 AM'),
    at('priyaRsvp', 5, '10:05 AM'),
    at('thornShells', 6, '8:00 AM'),
    at('diegoPlans', 7, '9:20 PM'),
    at('kiteSeptember', 21, '11:20 AM'),
];

function variant(base, changes) {
    return base.map(e => (changes[e.key] ? { ...e, ...changes[e.key] } : e));
}

module.exports = {
    T,
    LABEL_COLORS,
    NAV_LABELS,
    at,
    rowsFor,
    variant,
    S1_INBOX,
};
