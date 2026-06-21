// Sprint Triathlon Training Plan — 18 weeks, Jun 22 → Oct 25 2026
// 750m swim / 20km bike / 5km run
// Keyed by YYYY-MM-DD date string; each value is an array of sessions for that day.
// Disciplines: 'Swim' | 'Bike' | 'Run' | 'Conditioning' | 'Rest' | 'Race'

export const TRIATHLON_META = {
  startDate: '2026-06-22',
  raceDate:  '2026-10-25',
  totalWeeks: 18,
  raceDistances: '750m swim / 20km bike / 5km run',
};

const s = (discipline, duration, sessionType, week, phase, flag = null) =>
  ({ discipline, duration, sessionType, week, phase, flag });

export const TRIATHLON_PLAN = {
  // ── Week 1 · Foundation ──────────────────────────────────────
  '2026-06-22': [s('Swim','—','Sync swim (personal)',1,'Foundation')],
  '2026-06-23': [s('Swim','400m','Technique drills: catch-up, bilateral breathing',1,'Foundation')],
  '2026-06-24': [s('Bike','35 min','Easy spin',1,'Foundation')],
  '2026-06-25': [s('Run','20 min','Easy (run/walk ok)',1,'Foundation')],
  '2026-06-26': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',1,'Foundation')],
  '2026-06-27': [s('Rest','—','Rest – building up gradually',1,'Foundation')],
  '2026-06-28': [s('Rest','—','Rest – building up gradually',1,'Foundation')],

  // ── Week 2 · Foundation ──────────────────────────────────────
  '2026-06-29': [s('Swim','—','Sync swim (personal)',2,'Foundation')],
  '2026-06-30': [s('Swim','450m','Technique drills + 4×50m build',2,'Foundation')],
  '2026-07-01': [s('Bike','40 min','Easy spin',2,'Foundation')],
  '2026-07-02': [s('Run','22 min','Easy',2,'Foundation')],
  '2026-07-03': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',2,'Foundation')],
  '2026-07-04': [s('Rest','—','Rest – building up gradually',2,'Foundation')],
  '2026-07-05': [s('Rest','—','Rest – building up gradually',2,'Foundation')],

  // ── Week 3 · Foundation ──────────────────────────────────────
  '2026-07-06': [s('Swim','—','Sync swim (personal)',3,'Foundation')],
  '2026-07-07': [s('Swim','500m','Technique drills + 8×25m sighting practice',3,'Foundation')],
  '2026-07-08': [s('Bike','45 min','Easy + 4×1 min spin-ups',3,'Foundation')],
  '2026-07-09': [s('Run','25 min','Easy + 4×1 min strides',3,'Foundation')],
  '2026-07-10': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',3,'Foundation')],
  '2026-07-11': [s('Swim','300m','Easy, technique focus',3,'Foundation')],
  '2026-07-12': [s('Rest','—','Rest – building up gradually',3,'Foundation')],

  // ── Week 4 · Foundation ──────────────────────────────────────
  '2026-07-13': [s('Swim','—','Sync swim (personal)',4,'Foundation')],
  '2026-07-14': [s('Swim','550m','Technique drills + 10×25m',4,'Foundation')],
  '2026-07-15': [s('Bike','50 min','Easy + 10 min tempo middle',4,'Foundation')],
  '2026-07-16': [s('Run','28 min','Easy',4,'Foundation')],
  '2026-07-17': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',4,'Foundation')],
  '2026-07-18': [s('Swim','400m','Continuous, easy pace',4,'Foundation')],
  '2026-07-19': [s('Rest','—','Rest – building up gradually',4,'Foundation')],

  // ── Week 5 · Foundation ──────────────────────────────────────
  '2026-07-20': [s('Swim','—','Sync swim (personal)',5,'Foundation')],
  '2026-07-21': [s('Swim','600m','Continuous, easy pace',5,'Foundation')],
  '2026-07-22': [s('Bike','55 min','2×10 min tempo',5,'Foundation')],
  '2026-07-23': [s('Run','30 min','Easy + 5×1 min strides',5,'Foundation')],
  '2026-07-24': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',5,'Foundation')],
  '2026-07-25': [s('Swim','450m','Continuous, easy',5,'Foundation')],
  '2026-07-26': [
    s('Bike','45 min','Easy',5,'Foundation','Brick'),
    s('Run','5 min','Easy jog straight off the bike – first transition practice',5,'Foundation','Brick'),
  ],

  // ── Week 6 · Foundation ──────────────────────────────────────
  '2026-07-27': [s('Swim','—','Sync swim (personal)',6,'Foundation')],
  '2026-07-28': [s('Swim','650m','Technique drills + 6×50m moderate',6,'Foundation')],
  '2026-07-29': [s('Bike','60 min','4×3 min tempo',6,'Foundation')],
  '2026-07-30': [s('Run','32 min','Easy + 6×1 min strides',6,'Foundation')],
  '2026-07-31': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',6,'Foundation')],
  '2026-08-01': [s('Run','20–25 min','Easy',6,'Foundation','Holiday')],
  '2026-08-02': [s('Rest','—','No training',6,'Foundation','Holiday')],

  // ── Week 7 · Build ───────────────────────────────────────────
  '2026-08-03': [s('Rest','—','No training (personal swim skipped)',7,'Build','Holiday')],
  '2026-08-04': [s('Swim','600m','4×100m moderate effort',7,'Build')],
  '2026-08-05': [s('Bike','50 min','5×3 min hard / 2 min easy',7,'Build')],
  '2026-08-06': [s('Run','25 min','Easy (recovery)',7,'Build')],
  '2026-08-07': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',7,'Build')],
  '2026-08-08': [s('Swim','500m','Technique focus',7,'Build')],
  '2026-08-09': [
    s('Bike','25 min','Easy',7,'Build','Brick'),
    s('Run','10 min','Easy off the bike',7,'Build','Brick'),
  ],

  // ── Week 8 · Build ───────────────────────────────────────────
  '2026-08-10': [s('Swim','—','Sync swim (personal)',8,'Build')],
  '2026-08-11': [s('Swim','650m','6×75m build',8,'Build')],
  '2026-08-12': [s('Bike','55 min','6×3 min hard / 2 min easy',8,'Build')],
  '2026-08-13': [s('Run','30 min','Easy + 6×90 sec strides',8,'Build')],
  '2026-08-14': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',8,'Build')],
  '2026-08-15': [s('Swim','550m','Open water if possible',8,'Build')],
  '2026-08-16': [
    s('Bike','30 min','Easy',8,'Build','Brick'),
    s('Run','12 min','Easy off the bike',8,'Build','Brick'),
  ],

  // ── Week 9 · Build ───────────────────────────────────────────
  '2026-08-17': [s('Swim','—','Sync swim (personal)',9,'Build')],
  '2026-08-18': [s('Swim','700m','8×50m @ race effort',9,'Build')],
  '2026-08-19': [s('Bike','60 min','Hill repeats 6×2 min',9,'Build')],
  '2026-08-20': [s('Run','32 min','10 min tempo middle',9,'Build')],
  '2026-08-21': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',9,'Build')],
  '2026-08-22': [s('Swim','600m','Continuous',9,'Build')],
  '2026-08-23': [
    s('Bike','35 min','Easy-moderate',9,'Build','Brick'),
    s('Run','15 min','Easy off the bike',9,'Build','Brick'),
  ],

  // ── Week 10 · Build ──────────────────────────────────────────
  '2026-08-24': [s('Swim','—','Sync swim (personal)',10,'Build')],
  '2026-08-25': [s('Swim','750m','Continuous – race distance!',10,'Build')],
  '2026-08-26': [s('Bike','60 min','8×2 min hard / 90 sec easy',10,'Build')],
  '2026-08-27': [s('Run','30 min','Easy (recovery week)',10,'Build')],
  '2026-08-28': [s('Run','25–30 min','Easy',10,'Build','Holiday')],
  '2026-08-29': [s('Swim','500m','Easy, sea swim',10,'Build','Holiday')],
  '2026-08-30': [s('Rest','—','Out of action',10,'Build','Holiday')],

  // ── Week 11 · Build ──────────────────────────────────────────
  '2026-08-31': [s('Rest','—','Out of action (personal swim skipped)',11,'Build','Holiday')],
  '2026-09-01': [
    s('Swim','20–25 min','Sea swim, steady',11,'Build','Holiday'),
    s('Run','20 min','Easy',11,'Build','Holiday'),
  ],
  '2026-09-02': [
    s('Swim','~20 min','Sea swim, steady',11,'Build','Holiday'),
    s('Run','20–25 min','Easy',11,'Build','Holiday'),
  ],
  '2026-09-03': [s('Rest','—','Travel day',11,'Build','Holiday')],
  '2026-09-04': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',11,'Build')],
  '2026-09-05': [s('Swim','650m','Sighting practice',11,'Build')],
  '2026-09-06': [
    s('Bike','40 min','Moderate',11,'Build','Brick'),
    s('Run','18 min','Easy-moderate off the bike',11,'Build','Brick'),
  ],

  // ── Week 12 · Build ──────────────────────────────────────────
  '2026-09-07': [s('Swim','—','Sync swim (personal)',12,'Build')],
  '2026-09-08': [s('Swim','800m','Pacing practice',12,'Build')],
  '2026-09-09': [s('Bike','65 min','Hill repeats 8×90 sec',12,'Build')],
  '2026-09-10': [s('Run','35 min','4×2 min strong',12,'Build')],
  '2026-09-11': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',12,'Build')],
  '2026-09-12': [s('Swim','700m','Open water if possible',12,'Build')],
  '2026-09-13': [
    s('Bike','40 min','Moderate',12,'Build','Brick'),
    s('Run','20 min','Moderate off the bike',12,'Build','Brick'),
  ],

  // ── Week 13 · Build ──────────────────────────────────────────
  '2026-09-14': [s('Swim','—','Sync swim (personal)',13,'Build')],
  '2026-09-15': [s('Swim','800m','5×150m @ race pace',13,'Build')],
  '2026-09-16': [s('Bike','65 min','8×3 min hard / 2 min easy',13,'Build')],
  '2026-09-17': [s('Run','35 min','14 min tempo',13,'Build')],
  '2026-09-18': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',13,'Build')],
  '2026-09-19': [s('Bike','60 miles','Key endurance day (swim skipped)',13,'Build','Big ride')],
  '2026-09-20': [s('Rest','—','Easy recovery – legs tired from Sat ride',13,'Build','Recovery')],

  // ── Week 14 · Build ──────────────────────────────────────────
  '2026-09-21': [s('Swim','—','Sync swim (personal)',14,'Build')],
  '2026-09-22': [s('Swim','800m','Pyramid 100-200-300-200-100, build effort',14,'Build')],
  '2026-09-23': [s('Bike','70 min','Hill repeats 8×2 min',14,'Build')],
  '2026-09-24': [s('Run','36 min','5×2 min strong',14,'Build')],
  '2026-09-25': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',14,'Build')],
  '2026-09-26': [s('Swim','750m','Continuous, race-pace effort',14,'Build')],
  '2026-09-27': [
    s('Bike','45 min','Moderate-strong',14,'Build','Brick'),
    s('Run','22 min','Race-pace feel',14,'Build','Brick'),
  ],

  // ── Week 15 · Peak ───────────────────────────────────────────
  '2026-09-28': [s('Swim','—','Sync swim (personal)',15,'Peak')],
  '2026-09-29': [s('Swim','850m','Pacing + sighting drills',15,'Peak')],
  '2026-09-30': [s('Bike','75 min','Longest steady ride',15,'Peak')],
  '2026-10-01': [s('Run','40 min','3×3 min strong',15,'Peak')],
  '2026-10-02': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',15,'Peak')],
  '2026-10-03': [s('Swim','800m','Open water preferred',15,'Peak')],
  '2026-10-04': [
    s('Bike','50 min','Steady-strong (peak week)',15,'Peak','Brick'),
    s('Run','25 min','Race-pace feel',15,'Peak','Brick'),
  ],

  // ── Week 16 · Peak ───────────────────────────────────────────
  '2026-10-05': [s('Swim','—','Sync swim (personal)',16,'Peak')],
  '2026-10-06': [s('Swim','750m','Race-pace simulation',16,'Peak')],
  '2026-10-07': [s('Bike','65 min','8×2 min hard / 90 sec easy',16,'Peak')],
  '2026-10-08': [s('Run','35 min','Easy (recovery)',16,'Peak')],
  '2026-10-09': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',16,'Peak')],
  '2026-10-10': [s('Swim','750m','Open water dress rehearsal',16,'Peak')],
  '2026-10-11': [
    s('Bike','45 min','Race-pace, full simulation',16,'Peak','Brick · Race sim'),
    s('Run','25 min','Race-pace, full simulation',16,'Peak','Brick · Race sim'),
  ],

  // ── Week 17 · Peak ───────────────────────────────────────────
  '2026-10-12': [s('Swim','—','Sync swim (personal)',17,'Peak')],
  '2026-10-13': [s('Swim','700m','5×100m @ race pace',17,'Peak')],
  '2026-10-14': [s('Bike','55 min','5×3 min @ race effort',17,'Peak')],
  '2026-10-15': [s('Run','32 min','4×4 min @ race pace',17,'Peak')],
  '2026-10-16': [s('Conditioning','20–25 min','Hip & core circuit · glute bridge, bird dog, clamshell, dead bug, side plank',17,'Peak')],
  '2026-10-17': [s('Swim','600m','Open water sighting',17,'Peak')],
  '2026-10-18': [
    s('Bike','35 min','Moderate',17,'Peak','Brick · Pre-taper'),
    s('Run','18 min','Race-pace feel',17,'Peak','Brick · Pre-taper'),
  ],

  // ── Week 18 · Taper ──────────────────────────────────────────
  '2026-10-19': [s('Swim','—','Sync swim (personal)',18,'Taper')],
  '2026-10-20': [s('Swim','300m','Easy + a few race-pace 25s',18,'Taper')],
  '2026-10-21': [s('Bike','25 min','Easy + 3×1 min @ race effort',18,'Taper')],
  '2026-10-22': [s('Run','18 min','Easy + 4×30 sec @ race pace',18,'Taper')],
  '2026-10-23': [s('Rest','—','Rest day – taper, no new strength stimulus',18,'Taper')],
  '2026-10-24': [s('Bike','15 min','Easy spin, legs only – stay loose',18,'Taper')],
  '2026-10-25': [s('Race','Race day','750m swim / 20km bike / 5km run',18,'Taper')],
};

export const DISCIPLINE_DISPLAY = {
  Swim:         { emoji: '🏊', color: '#0369A1', label: 'Swim' },
  Bike:         { emoji: '🚴', color: '#9333EA', label: 'Bike' },
  Run:          { emoji: '🏃', color: '#0090FF', label: 'Run' },
  Conditioning: { emoji: '💪', color: '#6D4AAF', label: 'Conditioning' },
  Rest:         { emoji: '😴', color: '#9CA3AF', label: 'Rest' },
  Race:         { emoji: '🏁', color: '#DC2626', label: 'Race Day!' },
};
