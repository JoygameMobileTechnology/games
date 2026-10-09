import { t, formatNumber as format, formatDate, getLanguage } from './i18n.js';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CaretRight, Check, Leaf, LockKey, MagnifyingGlass, SlidersHorizontal, Sparkle } from '@phosphor-icons/react';
import { ProgressionPage } from './progression-page.jsx';
import { ACHIEVEMENT_FAMILIES, ACHIEVEMENT_SHELVES, achievementFamilyProgress } from './achievement-milestones.js';
import { AVATAR_FRAMES, isFrameUnlocked } from './avatar-frames.js';
import { PlayerAvatar } from './player-profile.jsx';
import { AchievementTrophy } from './achievement-trophy.jsx';

const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const levelName = entry => entry.totalLevels === 1 ? t(entry.unlocked ? 'Unlocked' : 'Not yet earned') : entry.complete ? t('Level {level} · Mastered', { level: format(entry.level) }) : entry.level ? t('Level {level}', { level: format(entry.level) }) : t('Not yet earned');
const trophyPreloadMargin = 300;

function AchievementShelf({ shelf, items, bodyRef, eager, isVisible, onOpenEntry }) {
  const element = useRef(null);
  const [artMounted, setArtMounted] = useState(eager);
  useLayoutEffect(() => {
    if (artMounted || !isVisible) return;
    const node = element.current;
    // The ancestor's ref may attach after this child's first layout effect.
    const root = bodyRef.current || node?.closest('.progression-page-scroll');
    if (!root || !node) return;
    if (typeof IntersectionObserver === 'undefined') { setArtMounted(true); return; }
    const isNearViewport = () => {
      if (!node.getClientRects().length) return false;
      const bounds = node.getBoundingClientRect(), viewport = root.getBoundingClientRect();
      return bounds.bottom >= viewport.top - trophyPreloadMargin && bounds.top <= viewport.bottom + trophyPreloadMargin;
    };
    // Include every initially visible shelf before paint, including two-column layouts.
    if (isNearViewport()) { setArtMounted(true); return; }
    let observing = true;
    const checkViewport = () => { if (observing && isNearViewport()) setArtMounted(true); };
    const observer = new IntersectionObserver(entries => {
      if (observing && entries.some(entry => entry.isIntersecting)) setArtMounted(true);
    }, { root, rootMargin: `${trophyPreloadMargin}px 0px` });
    observer.observe(node);
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(checkViewport);
    resizeObserver?.observe(root);
    resizeObserver?.observe(node);
    root.addEventListener('scroll', checkViewport, { passive: true });
    window.addEventListener('resize', checkViewport);
    return () => {
      observing = false;
      observer.disconnect();
      resizeObserver?.disconnect();
      root.removeEventListener('scroll', checkViewport);
      window.removeEventListener('resize', checkViewport);
    };
  }, [artMounted, bodyRef, isVisible]);
  return <section ref={element} className="achievement-shelf" aria-labelledby={`shelf-${shelf.id}`} onFocusCapture={() => setArtMounted(true)}><h3 id={`shelf-${shelf.id}`}><Leaf weight="fill" />{t(shelf.name)}<Leaf weight="fill" /></h3><ul className="achievement-shelf-grid">{items.map(entry => <li key={entry.id}><button className={`achievement-trophy-card ${entry.unlocked ? 'is-earned' : 'is-locked'}`} data-achievement-family={entry.id} onClick={event => onOpenEntry(entry, event)} aria-label={`${t(entry.name)}, ${levelName(entry)}, ${entry.complete ? t('Completed') : t('{current} of {target}', { current: format(Math.min(entry.current, entry.target)), target: format(entry.target) })}`}>
    <span className="achievement-trophy-stage">{artMounted ? <AchievementTrophy artKey={entry.artKey} level={entry.level} totalLevels={entry.totalLevels} /> : <span className="achievement-trophy" aria-hidden="true" />}{entry.level > 0 && entry.totalLevels > 1 && <span className="trophy-level-seal">{romans[entry.level - 1]}</span>}</span>
    <strong>{t(entry.name)}</strong><span className="trophy-card-progress">{entry.complete ? <><Check weight="bold" />{t('Complete')}</> : <>{entry.counterKey.startsWith('best') || entry.counterKey.startsWith('max') ? t('Best: ') : ''}{format(Math.min(entry.current, entry.target))} / {format(entry.target)}</>}</span>
  </button></li>)}</ul></section>;
}

function FrameReward({ frame, progression, profile, onEquipFrame }) {
  const unlocked = isFrameUnlocked(frame.id, progression.points, progression.retainedAvatarFrameIds), equipped = profile?.frameId === frame.id && unlocked;
  return <article className={`achievement-frame-reward ${unlocked ? 'is-earned' : 'is-locked'}`} data-frame-id={frame.id}>
    <div className="frame-reward-preview"><PlayerAvatar profile={{ ...profile, frameId: frame.id }} size={92} />{!unlocked && <LockKey className="frame-reward-lock" weight="fill" />}</div>
    <div className="frame-reward-copy"><h3>{t(frame.name)}</h3><strong>{t('{count} Achievement Points', { count: format(frame.pointsRequired) })}</strong><p>{t(frame.description)}</p>
      <button className={unlocked ? 'progression-primary' : 'progression-secondary'} disabled={!unlocked || equipped} onClick={() => onEquipFrame?.(frame.id)} aria-label={equipped ? t('{name} frame equipped', { name: t(frame.name) }) : t('Equip {name} frame', { name: t(frame.name) })}>{equipped ? <><Check weight="bold" />{t('Equipped')}</> : unlocked ? t('Equip frame') : t('{count} AP to unlock', { count: format(frame.pointsRequired - progression.points) })}</button>
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
  const nextFrame = AVATAR_FRAMES.find(frame => !isFrameUnlocked(frame.id, progression.points, progression.retainedAvatarFrameIds));
  const shownFrame = nextFrame || AVATAR_FRAMES.at(-1);
  const visible = entries.filter(entry => (category === 'all' || category === entry.shelfId) && (filter === 'all' || filter === 'unlocked' && entry.unlocked || filter === 'complete' && entry.complete || filter === 'progress' && !entry.complete && entry.current > 0) && `${t(entry.name)} ${t(entry.description)} ${entry.milestones.map(item => t(item.description)).join(' ')}`.toLocaleLowerCase(getLanguage()).includes(search.trim().toLocaleLowerCase(getLanguage())));
  const title = t(showFrames ? 'Point milestones' : selected?.name || 'Achievements');
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
      <section className="achievement-summary" aria-label={t('Achievement Points')}>
        <div className="achievement-total"><span>{t('Achievement Points')}</span><strong>{format(progression.points)}</strong><small>{t('{earned} / {total} trophies earned', { earned: format(entries.filter(entry => entry.unlocked).length), total: format(entries.length) })}</small></div>
        <button className="achievement-next-frame" onClick={openFrames} aria-label={t('View milestones')}><PlayerAvatar profile={{ ...profile, frameId: shownFrame.id }} size={48} /><span>{t(nextFrame ? 'Next milestone' : 'All frames unlocked')}<strong>{format(shownFrame.pointsRequired)} <small>{t('AP')}</small></strong></span><progress value={nextFrame ? Math.min(progression.points, shownFrame.pointsRequired) : shownFrame.pointsRequired} max={shownFrame.pointsRequired} aria-label={t('Next avatar frame progress')} /><b>{t('View milestones')} <CaretRight weight="bold" /></b></button>
      </section>
      <div className="achievement-toolbar" hidden><label className="achievement-search"><MagnifyingGlass size={19} /><input aria-label={t('Search achievements')} type="search" placeholder={t('Find a trophy')} value={search} onChange={event => setSearch(event.target.value)} /></label><button className={`achievement-filter-toggle ${filter !== 'all' || category !== 'all' ? 'is-active' : ''}`} aria-label={t('Filter achievements')} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={23} /><span>{t('Filter')}</span></button></div>
      {filtersOpen && <div className="achievement-filters" hidden><label>{t('Category')}<select aria-label={t('Achievement category')} value={category} onChange={event => setCategory(event.target.value)}><option value="all">{t('All categories')}</option>{ACHIEVEMENT_SHELVES.map(shelf => <option key={shelf.id} value={shelf.id}>{t(shelf.name)}</option>)}</select></label><label>{t('Status')}<select aria-label={t('Achievement status')} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{t('All trophies')}</option><option value="progress">{t('In progress')}</option><option value="unlocked">{t('Unlocked')}</option><option value="complete">{t('Completed')}</option></select></label></div>}
      <p className="achievement-results-count" aria-live="polite">{t(visible.length === 1 ? '{count} trophy · tap to explore milestones' : '{count} trophies · tap to explore milestones', { count: format(visible.length) })}</p>
      <div className="achievement-shelves">{ACHIEVEMENT_SHELVES.map((shelf, index) => {
        const items = visible.filter(entry => entry.shelfId === shelf.id);
        return items.length > 0 && <AchievementShelf key={shelf.id} shelf={shelf} items={items} bodyRef={body} eager={index === 0} isVisible={!selected && !showFrames} onOpenEntry={openEntry} />;
      })}</div>
      {visible.length === 0 && <div className="progression-empty"><MagnifyingGlass size={35} /><h3>{t('No matching trophies')}</h3><p>{t('Try another name or category.')}</p><button className="progression-secondary" onClick={() => { setSearch(''); setCategory('all'); setFilter('all'); }}>{t('Show all achievements')}</button></div>}
    </div>
    {selected && <article className="achievement-detail" hidden={showFrames} aria-label={t('{name} details', { name: t(selected.name) })}>
      <div className="achievement-detail-hero"><span className="achievement-category-note">{t(selected.category)}</span><AchievementTrophy artKey={selected.artKey} level={preview.unlocked ? preview.level : previewId ? preview.level : 0} totalLevels={selected.totalLevels} preview={Boolean(previewId && !preview.unlocked)} /><h3 aria-live="polite">{selected.totalLevels === 1 ? t(preview.unlocked ? 'Trophy unlocked' : 'A trophy to earn') : t(preview.unlocked ? 'Level {level} unlocked' : 'Level {level} preview', { level: romans[preview.level - 1] })}</h3></div>
      <div className="achievement-detail-body"><p className="achievement-condition">{t(preview.description)}</p>
        {selected.totalLevels > 1 && <><p className="milestone-helper">{t('Select a level to see its trophy and reward.')}</p><ol className="achievement-levels" style={{ '--tier-columns': Math.min(5, selected.totalLevels) }}>{selected.milestones.map(item => <li key={item.id}><button data-achievement-level={item.id} aria-pressed={preview.id === item.id} className={`${item.unlocked ? 'is-earned' : ''} ${selected.nextMilestone?.id === item.id ? 'is-next' : ''}`} aria-label={t('Level {level}: {target} · {points} AP', { level: format(item.level), target: format(item.target), points: format(item.points) })} onClick={() => { setPreviewId(item.id); if (window.matchMedia('(max-width: 999px) and (orientation: portrait)').matches) body.current?.scrollTo({ top: 0, behavior: gentle || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}><span className="milestone-medal">{romans[item.level - 1]}{item.unlocked ? <Check weight="bold" /> : <LockKey weight="fill" />}</span><strong>{format(item.target)}</strong><small>{t('{count} AP', { count: format(item.points) })}</small></button></li>)}</ol></>}
        <div className="achievement-progress-note"><span>{preview.unlocked ? <><Check weight="bold" />{selected.totalLevels > 1 ? t('Level {level} earned', { level: romans[preview.level - 1] }) : t('Completed')}</> : `${format(Math.min(selected.current, preview.target))} / ${format(preview.target)}`}</span><strong><Sparkle weight="fill" />{preview.unlocked && preview.awardedPoints !== preview.points ? t('Previously earned: {count} AP', { count: format(preview.awardedPoints) }) : t(preview.unlocked ? '{count} AP earned' : '{count} AP on unlock', { count: format(preview.unlocked ? preview.awardedPoints : preview.points) })}</strong></div>
        {!preview.unlocked && <progress value={Math.min(selected.current, preview.target)} max={preview.target} aria-label={t('{name} progress', { name: t(selected.name) })} />}
        {preview.unlockedAt != null && <small className="achievement-unlock-date">{t('Earned {date}', { date: formatDate(preview.unlockedAt) })}</small>}
        <section className="achievement-next-step"><h4>{selected.complete ? t('Achievement mastered') : selected.totalLevels === 1 ? t('Your challenge') : t('Next: Level {level}', { level: romans[selected.nextMilestone.level - 1] })}</h4><p>{selected.complete ? t(selected.totalLevels > 1 ? '{count} Achievement Points earned across {levels} levels.' : '{count} Achievement Points earned.', { count: format(selected.earnedPoints), levels: format(selected.totalLevels) }) : t(selected.nextMilestone.description)}</p>{!selected.complete && <strong>{t('+{count} Achievement Points', { count: format(selected.nextRewardPoints) })}</strong>}</section>
        <button className="achievement-detail-frame-link" onClick={openFrames}><PlayerAvatar profile={{ ...profile, frameId: shownFrame.id }} size={50} /><span><strong>{nextFrame ? t('{count} AP to {name}', { count: format(Math.max(0, nextFrame.pointsRequired - progression.points)), name: t(nextFrame.name) }) : t('Your avatar frames')}</strong><small>{t('Achievement Points unlock profile frames')}</small></span><CaretRight weight="bold" /></button>
      </div>
    </article>}
    {showFrames && <div className="achievement-frame-page"><div className="frame-milestone-intro"><span>{t('Your Achievement Points')}</span><strong>{format(progression.points)}</strong><p>{t('Earn points, unlock a frame, make it yours.')}<br />{t('Your points are never spent.')}</p></div><div className="achievement-frame-list">{AVATAR_FRAMES.map(frame => <FrameReward key={frame.id} frame={frame} progression={progression} profile={profile} onEquipFrame={onEquipFrame} />)}</div></div>}
  </ProgressionPage>;
}
