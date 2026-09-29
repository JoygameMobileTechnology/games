import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CaretRight, Check, Leaf, LockKey, MagnifyingGlass, SlidersHorizontal, Sparkle } from '@phosphor-icons/react';
import { ProgressionPage } from './progression-page.jsx';
import { ACHIEVEMENT_FAMILIES, ACHIEVEMENT_SHELVES, achievementFamilyProgress } from './achievement-milestones.js';
import { AVATAR_FRAMES, isFrameUnlocked } from './avatar-frames.js';
import { PlayerAvatar } from './player-profile.jsx';
import { AchievementTrophy } from './achievement-trophy.jsx';

const format = value => Number(value || 0).toLocaleString();
const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const levelName = entry => entry.totalLevels === 1 ? (entry.unlocked ? 'Unlocked' : 'Not yet earned') : entry.complete ? `Level ${entry.level} · Mastered` : entry.level ? `Level ${entry.level}` : 'Not yet earned';

function FrameReward({ frame, progression, profile, onEquipFrame }) {
  const unlocked = isFrameUnlocked(frame.id, progression.points), equipped = profile?.frameId === frame.id && unlocked;
  return <article className={`achievement-frame-reward ${unlocked ? 'is-earned' : 'is-locked'}`} data-frame-id={frame.id}>
    <div className="frame-reward-preview"><PlayerAvatar profile={{ ...profile, frameId: frame.id }} size={92} />{!unlocked && <LockKey className="frame-reward-lock" weight="fill" />}</div>
    <div className="frame-reward-copy"><h3>{frame.name}</h3><strong>{format(frame.pointsRequired)} Achievement Points</strong><p>{frame.description}</p>
      <button className={unlocked ? 'progression-primary' : 'progression-secondary'} disabled={!unlocked || equipped} onClick={() => onEquipFrame?.(frame.id)} aria-label={equipped ? `${frame.name} frame equipped` : `Equip ${frame.name} frame`}>{equipped ? <><Check weight="bold" />Equipped</> : unlocked ? 'Equip frame' : `${format(frame.pointsRequired - progression.points)} AP to unlock`}</button>
    </div>
  </article>;
}

export function AchievementsPage({ progression, profile, onEquipFrame, onClose, gentle = false }) {
  const [search, setSearch] = useState(''), [category, setCategory] = useState('all'), [filter, setFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false), [selectedId, setSelectedId] = useState(null), [previewId, setPreviewId] = useState(null), [showFrames, setShowFrames] = useState(false);
  const body = useRef(null), opener = useRef(null), frameOpener = useRef(null), listScroll = useRef(0), detailScroll = useRef(0), restoring = useRef(false);
  const entries = useMemo(() => ACHIEVEMENT_FAMILIES.map(family => achievementFamilyProgress(family, progression)), [progression]);
  const selected = entries.find(entry => entry.id === selectedId);
  const preview = selected?.milestones.find(item => item.id === previewId) || selected?.currentMilestone || selected?.nextMilestone;
  const nextFrame = AVATAR_FRAMES.find(frame => !isFrameUnlocked(frame.id, progression.points));
  const shownFrame = nextFrame || AVATAR_FRAMES.at(-1);
  const visible = entries.filter(entry => (category === 'all' || category === entry.shelfId) && (filter === 'all' || filter === 'unlocked' && entry.unlocked || filter === 'complete' && entry.complete || filter === 'progress' && !entry.complete && entry.current > 0) && `${entry.name} ${entry.description} ${entry.milestones.map(item => item.description).join(' ')}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const title = showFrames ? 'Point milestones' : selected?.name || 'Achievements';
  useLayoutEffect(() => {
    if (!body.current) return;
    if (restoring.current) { body.current.scrollTop = selectedId ? detailScroll.current : listScroll.current; restoring.current = false; }
    else body.current.scrollTop = 0;
  }, [selectedId, showFrames]);
  function openEntry(entry, event) { opener.current = event.currentTarget; listScroll.current = body.current?.scrollTop || 0; setSelectedId(entry.id); setPreviewId(null); }
  function closeDetail() { restoring.current = true; setSelectedId(null); setPreviewId(null); requestAnimationFrame(() => opener.current?.focus({ preventScroll: true })); }
  function openFrames(event) { frameOpener.current = event.currentTarget; if (selectedId) detailScroll.current = body.current?.scrollTop || 0; else listScroll.current = body.current?.scrollTop || 0; setShowFrames(true); }
  function closeFrames() { restoring.current = true; setShowFrames(false); requestAnimationFrame(() => frameOpener.current?.focus({ preventScroll: true })); }
  const close = showFrames ? closeFrames : selected ? closeDetail : onClose;
  return <ProgressionPage title={title} className={`achievements-page ${gentle ? 'is-gentle' : ''} ${selected ? 'has-achievement-detail' : ''}`} bodyRef={body} onClose={close} closeLabel={showFrames && selected ? 'Back to achievement' : showFrames || selected ? 'Back to achievements' : 'Back to main menu'}>
    <div className="achievement-list-pane" hidden={Boolean(selected || showFrames)}>
      <section className="achievement-summary" aria-label="Achievement Points">
        <div className="achievement-total"><span>Achievement Points</span><strong>{format(progression.points)}</strong><small>{entries.filter(entry => entry.unlocked).length} / {entries.length} trophies earned</small></div>
        <button className="achievement-next-frame" onClick={openFrames} aria-label="View milestones"><PlayerAvatar profile={{ ...profile, frameId: shownFrame.id }} size={48} /><span>{nextFrame ? 'Next milestone' : 'All frames unlocked'}<strong>{format(shownFrame.pointsRequired)} <small>AP</small></strong></span><progress value={Math.min(progression.points, shownFrame.pointsRequired)} max={shownFrame.pointsRequired} aria-label="Next avatar frame progress" /><b>View milestones <CaretRight weight="bold" /></b></button>
      </section>
      <div className="achievement-toolbar" hidden><label className="achievement-search"><MagnifyingGlass size={19} /><input aria-label="Search achievements" type="search" placeholder="Find a trophy" value={search} onChange={event => setSearch(event.target.value)} /></label><button className={`achievement-filter-toggle ${filter !== 'all' || category !== 'all' ? 'is-active' : ''}`} aria-label="Filter achievements" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={23} /><span>Filter</span></button></div>
      {filtersOpen && <div className="achievement-filters" hidden><label>Category<select aria-label="Achievement category" value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{ACHIEVEMENT_SHELVES.map(shelf => <option key={shelf.id} value={shelf.id}>{shelf.name}</option>)}</select></label><label>Status<select aria-label="Achievement status" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All trophies</option><option value="progress">In progress</option><option value="unlocked">Unlocked</option><option value="complete">Completed</option></select></label></div>}
      <p className="achievement-results-count" aria-live="polite">{visible.length} {visible.length === 1 ? 'trophy' : 'trophies'} · tap to explore milestones</p>
      <div className="achievement-shelves">{ACHIEVEMENT_SHELVES.map(shelf => {
        const items = visible.filter(entry => entry.shelfId === shelf.id);
        return items.length > 0 && <section className="achievement-shelf" key={shelf.id} aria-labelledby={`shelf-${shelf.id}`}><h3 id={`shelf-${shelf.id}`}><Leaf weight="fill" />{shelf.name}<Leaf weight="fill" /></h3><ul className="achievement-shelf-grid">{items.map(entry => <li key={entry.id}><button className={`achievement-trophy-card ${entry.unlocked ? 'is-earned' : 'is-locked'}`} data-achievement-family={entry.id} onClick={event => openEntry(entry, event)} aria-label={`${entry.name}, ${levelName(entry)}, ${entry.complete ? 'Completed' : `${format(Math.min(entry.current, entry.target))} of ${format(entry.target)}`}`}>
          <span className="achievement-trophy-stage"><AchievementTrophy artKey={entry.artKey} level={entry.level} totalLevels={entry.totalLevels} />{entry.level > 0 && entry.totalLevels > 1 && <span className="trophy-level-seal">{romans[entry.level - 1]}</span>}</span>
          <strong>{entry.name}</strong><span className="trophy-card-progress">{entry.complete ? <><Check weight="bold" />Complete</> : <>{entry.counterKey.startsWith('best') || entry.counterKey.startsWith('max') ? 'Best ' : ''}{format(Math.min(entry.current, entry.target))} / {format(entry.target)}</>}</span>
        </button></li>)}</ul></section>;
      })}</div>
      {visible.length === 0 && <div className="progression-empty"><MagnifyingGlass size={35} /><h3>No matching trophies</h3><p>Try another name or category.</p><button className="progression-secondary" onClick={() => { setSearch(''); setCategory('all'); setFilter('all'); }}>Show all achievements</button></div>}
    </div>
    {selected && <article className="achievement-detail" hidden={showFrames} aria-label={`${selected.name} details`}>
      <div className="achievement-detail-hero"><span className="achievement-category-note">{selected.category}</span><AchievementTrophy artKey={selected.artKey} level={preview.unlocked ? preview.level : previewId ? preview.level : 0} totalLevels={selected.totalLevels} preview={Boolean(previewId && !preview.unlocked)} /><h3 aria-live="polite">{selected.totalLevels === 1 ? (preview.unlocked ? 'Trophy unlocked' : 'A trophy to earn') : `Level ${romans[preview.level - 1]} ${preview.unlocked ? 'unlocked' : 'preview'}`}</h3></div>
      <div className="achievement-detail-body"><p className="achievement-condition">{preview.description}</p>
        {selected.totalLevels > 1 && <><p className="milestone-helper">Select a level to see its trophy and reward.</p><ol className="achievement-levels" style={{ '--tier-columns': Math.min(5, selected.totalLevels) }}>{selected.milestones.map(item => <li key={item.id}><button data-achievement-level={item.id} aria-pressed={preview.id === item.id} className={`${item.unlocked ? 'is-earned' : ''} ${selected.nextMilestone?.id === item.id ? 'is-next' : ''}`} aria-label={`Level ${item.level}: ${format(item.target)} · ${item.unlocked ? item.awardedPoints : item.points} AP`} onClick={() => { setPreviewId(item.id); if (window.matchMedia('(max-width: 999px) and (orientation: portrait)').matches) body.current?.scrollTo({ top: 0, behavior: gentle || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}><span className="milestone-medal">{romans[item.level - 1]}{item.unlocked ? <Check weight="bold" /> : <LockKey weight="fill" />}</span><strong>{format(item.target)}</strong><small>{item.unlocked ? item.awardedPoints : item.points} AP</small></button></li>)}</ol></>}
        <div className="achievement-progress-note"><span>{preview.unlocked ? <><Check weight="bold" />{selected.totalLevels > 1 ? `Level ${romans[preview.level - 1]} earned` : 'Completed'}</> : `${format(Math.min(selected.current, preview.target))} / ${format(preview.target)}`}</span><strong><Sparkle weight="fill" />{preview.unlocked ? preview.awardedPoints : preview.points} AP {preview.unlocked ? 'earned' : 'on unlock'}</strong></div>
        {!preview.unlocked && <progress value={Math.min(selected.current, preview.target)} max={preview.target} aria-label={`${selected.name} progress`} />}
        {preview.unlockedAt != null && <small className="achievement-unlock-date">Earned {new Date(preview.unlockedAt).toLocaleDateString()}</small>}
        <section className="achievement-next-step"><h4>{selected.complete ? 'Achievement mastered' : selected.totalLevels === 1 ? 'Your challenge' : `Next: Level ${romans[selected.nextMilestone.level - 1]}`}</h4><p>{selected.complete ? `${format(selected.earnedPoints)} Achievement Points earned${selected.totalLevels > 1 ? ` across ${selected.totalLevels} levels` : ''}.` : selected.nextMilestone.description}</p>{!selected.complete && <strong>+{selected.nextRewardPoints} Achievement Points</strong>}</section>
        <button className="achievement-detail-frame-link" onClick={openFrames}><PlayerAvatar profile={{ ...profile, frameId: shownFrame.id }} size={50} /><span><strong>{nextFrame ? `${format(Math.max(0, nextFrame.pointsRequired - progression.points))} AP to ${nextFrame.name}` : 'Your avatar frames'}</strong><small>Achievement Points unlock profile frames</small></span><CaretRight weight="bold" /></button>
      </div>
    </article>}
    {showFrames && <div className="achievement-frame-page"><div className="frame-milestone-intro"><span>Your Achievement Points</span><strong>{format(progression.points)}</strong><p>Earn points, unlock a frame, make it yours.<br />Your points are never spent.</p></div><div className="achievement-frame-list">{AVATAR_FRAMES.map(frame => <FrameReward key={frame.id} frame={frame} progression={progression} profile={profile} onEquipFrame={onEquipFrame} />)}</div></div>}
  </ProgressionPage>;
}
