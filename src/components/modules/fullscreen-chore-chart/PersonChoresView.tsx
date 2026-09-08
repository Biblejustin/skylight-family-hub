'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, Check, ChevronRight, Gift, LoaderCircle, Ticket } from 'lucide-react';
import type { ChoreMember } from '@/types/config';
import type { MemberStats, ResolvedAssignment } from '../chore-chart/types';
import { getTimeOfDayLabelKey, TIME_OF_DAY_META } from '../chore-chart/types';
import ChoreIcon from '../chore-chart/ChoreIcon';
import { formatDateInTZ } from '@/lib/timezone';
import { useFormattingLocale, useTranslate } from '@/i18n';

export interface PersonChoresViewProps {
  members: ChoreMember[];
  memberStats: Map<string, MemberStats>;
  assignments: ResolvedAssignment[];
  selectedMemberId: string | null;
  onSelectMember: (id: string | null) => void;
  allowTouch: boolean;
  showPoints: boolean;
  showTimeOfDay: boolean;
  onToggle: (choreId: string, memberId: string) => Promise<boolean>;
  onRewards?: () => void;
  timezone?: string;
  loading?: boolean;
  error?: boolean;
}

const assignmentKey = (choreId: string, memberId: string) => JSON.stringify([choreId, memberId]);

/** Person selection stays local; each chore action names one resolved assignment. */
export default function PersonChoresView({
  members, memberStats, assignments, selectedMemberId, onSelectMember,
  allowTouch, showPoints, showTimeOfDay, onToggle, onRewards, timezone, loading, error,
}: PersonChoresViewProps) {
  const t = useTranslate('modules');
  const locale = useFormattingLocale();
  const selectedMember = members.find((member) => member.id === selectedMemberId);
  const [pending, setPending] = useState<Set<string>>(new Set());
  // State alone is too late for two clicks before React commits a render.
  // The shared hook replaces whole snapshots, so only one mutation may run,
  // even for another chore/member. Keys still associate feedback correctly.
  const pendingRef = useRef(new Set<string>());
  const [saveErrors, setSaveErrors] = useState<Set<string>>(new Set());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const myAssignments = useMemo(() => {
    const mine = assignments.filter((assignment) => assignment.memberId === selectedMember?.id);
    return showTimeOfDay
      ? mine.sort((a, b) => TIME_OF_DAY_META[a.chore.timeOfDay].order - TIME_OF_DAY_META[b.chore.timeOfDay].order)
      : mine;
  }, [assignments, selectedMember?.id, showTimeOfDay]);
  const done = myAssignments.filter((assignment) => assignment.isCompleted).length;
  const balance = selectedMember ? memberStats.get(selectedMember.id)?.rewardBalance ?? 0 : 0;
  const dateLabel = formatDateInTZ(new Date(), timezone, { weekday: 'long', month: 'long', day: 'numeric' }, locale);

  const toggle = async (assignment: ResolvedAssignment) => {
    if (!allowTouch || loading || error || !selectedMember || assignment.memberId !== selectedMember.id) return;
    // Read the member id from the assignment, never from a later selection.
    const { memberId, chore } = assignment;
    const key = assignmentKey(chore.id, memberId);
    if (pendingRef.current.size > 0) return;
    pendingRef.current.add(key);
    setPending(new Set(pendingRef.current));
    setSaveErrors((previous) => {
      const next = new Set(previous);
      next.delete(key);
      return next;
    });
    try {
      const saved = await onToggle(chore.id, memberId);
      if (!saved && mounted.current) setSaveErrors((previous) => new Set(previous).add(key));
    } catch {
      if (mounted.current) setSaveErrors((previous) => new Set(previous).add(key));
    } finally {
      pendingRef.current.delete(key);
      if (mounted.current) setPending(new Set(pendingRef.current));
    }
  };

  const memberStyle = (member: ChoreMember): CSSProperties => ({ '--person-color': member.color } as CSSProperties);
  const avatar = (member: ChoreMember, large = false) => (
    <span className={large ? 'fcc-person-avatar fcc-person-avatar-large' : 'fcc-person-avatar'} aria-hidden="true">
      {member.emoji ? <ChoreIcon value={member.emoji} size={large ? 46 : 25} color="currentColor" bare /> : member.name.charAt(0)}
    </span>
  );

  return (
    <section className="fcc-person-view" aria-label="Chores by person">
      <style>{css}</style>
      <header className="fcc-person-header">
        <div className="fcc-person-heading">
          <h1>{selectedMember ? `${selectedMember.name}'s chores` : 'Chores'}</h1>
          <p>{dateLabel}</p>
        </div>
        {selectedMember && (
          <button type="button" className="fcc-person-control" disabled={pending.size > 0} onClick={() => onSelectMember(null)}>
            <ArrowLeft size={22} aria-hidden="true" /> Change person
          </button>
        )}
        {onRewards && (
          <button type="button" className="fcc-person-control" disabled={pending.size > 0} onClick={onRewards}>
            <Gift size={22} aria-hidden="true" /> Rewards
          </button>
        )}
      </header>

      {selectedMember && (
        <nav className="fcc-person-tabs" aria-label="Choose person">
          {members.map((member) => (
            <button type="button" key={member.id} className="fcc-person-tab" style={memberStyle(member)}
              aria-label={`Show chores for ${member.name}`} aria-pressed={member.id === selectedMember.id}
              onClick={() => onSelectMember(member.id)}>
              {avatar(member)} <span>{member.name}</span>
            </button>
          ))}
        </nav>
      )}

      {error && <p className="fcc-person-message" role="alert">Couldn’t load chores. Try again shortly.</p>}
      {!allowTouch && <p className="fcc-person-message">Viewing only — chore completion is disabled.</p>}

      {loading ? (
        <div className="fcc-person-empty" role="status">Loading chores…</div>
      ) : members.length === 0 ? (
        !error && <div className="fcc-person-empty">No people added yet.</div>
      ) : !selectedMember ? (
        <div className="fcc-person-scroll">
          <p className="fcc-person-instruction">Choose your name to see today’s chores.</p>
          <div className="fcc-person-chooser">
            {members.map((member) => {
              const mine = assignments.filter((assignment) => assignment.memberId === member.id);
              const completed = mine.filter((assignment) => assignment.isCompleted).length;
              return (
                <button type="button" key={member.id} className="fcc-person-card" style={memberStyle(member)}
                  aria-label={`Show chores for ${member.name}`} onClick={() => onSelectMember(member.id)}>
                  {avatar(member, true)}
                  <span className="fcc-person-card-body">
                    <strong>{member.name}</strong>
                    <span>{mine.length ? `${completed} of ${mine.length} complete` : 'No chores today'}</span>
                    {showPoints && <span className="fcc-person-points"><Ticket size={22} aria-hidden="true" /> {memberStats.get(member.id)?.rewardBalance ?? 0} points</span>}
                  </span>
                  <ChevronRight size={28} className="fcc-person-chevron" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="fcc-person-summary" style={memberStyle(selectedMember)}>
            <div className="fcc-person-progress-label"><strong>{done} of {myAssignments.length} complete</strong>
              {showPoints && <span className="fcc-person-points"><Ticket size={24} aria-hidden="true" /> {balance} points</span>}
            </div>
            <div className="fcc-person-progress" role="progressbar" aria-label={`${selectedMember.name}'s chore progress`}
              aria-valuemin={0} aria-valuemax={myAssignments.length || 1} aria-valuenow={done}>
              <span style={{ width: `${myAssignments.length ? done / myAssignments.length * 100 : 0}%` }} />
            </div>
          </div>
          <div className="fcc-person-scroll">
            {myAssignments.length === 0 ? (
              !error && <div className="fcc-person-empty">No chores today.</div>
            ) : (
              <div className="fcc-person-chores">
                {myAssignments.map((assignment) => {
                  const { chore, memberId, isCompleted } = assignment;
                  const key = assignmentKey(chore.id, memberId);
                  const isPending = pending.has(key);
                  const failed = saveErrors.has(key);
                  return (
                    <div key={key} className="fcc-person-row-wrap">
                      <button type="button" className="fcc-person-row" style={memberStyle(selectedMember)}
                        aria-label={isCompleted ? `Undo ${chore.name} for ${selectedMember.name}` : `Mark ${chore.name} complete for ${selectedMember.name}`}
                        aria-pressed={isCompleted} aria-busy={isPending}
                        disabled={!allowTouch || !!loading || !!error || pending.size > 0}
                        onClick={() => void toggle(assignment)}>
                        <span className="fcc-person-check" aria-hidden="true">
                          {isPending ? <LoaderCircle size={25} /> : isCompleted ? <Check size={28} strokeWidth={3} /> : null}
                        </span>
                        <span className="fcc-person-row-body">
                          <strong>{chore.name}</strong>
                          <span className="fcc-person-row-meta">
                            {showTimeOfDay && <span>{t(getTimeOfDayLabelKey(chore.timeOfDay))}</span>}
                            {showPoints && <span>{chore.points} {chore.points === 1 ? 'point' : 'points'}</span>}
                            {isPending && <span>Saving…</span>}
                            {!isPending && isCompleted && <span>{allowTouch ? 'Done · tap to undo' : 'Done'}</span>}
                          </span>
                        </span>
                      </button>
                      {failed && <p className="fcc-person-row-error" role="alert">Couldn’t confirm save. Check this chore’s status.</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

const css = `
.fcc-person-view { display:flex; flex-direction:column; height:100%; min-height:0; min-width:0; overflow:hidden; padding:clamp(18px,2.2vmin,32px); gap:16px; color:var(--fcc-text); font-family:inherit; box-sizing:border-box; }
.fcc-person-view *, .fcc-person-view *::before, .fcc-person-view *::after { box-sizing:border-box; }
.fcc-person-view button { font:inherit; color:inherit; touch-action:pan-y; -webkit-tap-highlight-color:transparent; cursor:pointer; }
.fcc-person-view button:focus-visible { outline:3px solid var(--fcc-accent); outline-offset:3px; }
.fcc-person-view button:disabled { cursor:default; opacity:.65; }
.fcc-person-header { display:flex; align-items:center; flex-wrap:wrap; gap:12px; flex-shrink:0; }
.fcc-person-heading { flex:1; min-width:180px; }
.fcc-person-heading h1 { margin:0; font-size:clamp(30px,3.5vmin,46px); line-height:1.15; overflow-wrap:anywhere; }
.fcc-person-heading p { margin:6px 0 0; font-size:clamp(16px,1.9vmin,24px); color:var(--fcc-text-2); }
.fcc-person-control { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:48px; padding:10px 16px; border:1px solid var(--fcc-border); border-radius:14px; background:var(--fcc-surface); font-weight:650!important; }
.fcc-person-tabs { display:flex; flex-wrap:wrap; gap:10px; flex-shrink:0; }
.fcc-person-tab { display:inline-flex; align-items:center; gap:10px; min-height:52px; padding:7px 16px 7px 8px; border:2px solid var(--fcc-border); border-radius:999px; background:var(--fcc-surface); font-size:clamp(19px,2.1vmin,28px)!important; font-weight:650!important; }
.fcc-person-tab[aria-pressed="true"] { border-color:var(--person-color); background:color-mix(in srgb,var(--person-color) 14%,var(--fcc-surface)); }
.fcc-person-avatar { width:36px; height:36px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; background:color-mix(in srgb,var(--person-color) 20%,var(--fcc-surface)); color:var(--person-color); font-weight:750; }
.fcc-person-avatar-large { width:82px; height:82px; font-size:36px; }
.fcc-person-scroll { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; touch-action:pan-y; padding:4px 4px 12px; scrollbar-gutter:stable; }
.fcc-person-instruction { margin:0 0 22px; color:var(--fcc-text-2); font-size:clamp(20px,2.3vmin,30px); }
.fcc-person-chooser, .fcc-person-chores { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; align-content:start; }
.fcc-person-card { display:flex; align-items:center; gap:22px; min-height:190px; padding:24px; text-align:left; border:2px solid var(--fcc-border); border-radius:24px; background:var(--fcc-surface); box-shadow:var(--fcc-card-shadow); }
.fcc-person-card:hover { border-color:var(--person-color); }
.fcc-person-card-body { display:flex; flex:1; min-width:0; flex-direction:column; gap:10px; font-size:clamp(20px,2.2vmin,28px); color:var(--fcc-text-2); }
.fcc-person-card-body strong { font-size:clamp(30px,3.6vmin,46px); line-height:1.12; color:var(--fcc-text); overflow-wrap:anywhere; }
.fcc-person-chevron { flex-shrink:0; color:var(--fcc-text-2); }
.fcc-person-points { display:inline-flex; align-items:center; gap:7px; white-space:nowrap; }
.fcc-person-summary { flex-shrink:0; }
.fcc-person-progress-label { display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:9px; font-size:clamp(20px,2.25vmin,28px); }
.fcc-person-progress { height:9px; overflow:hidden; border-radius:999px; background:var(--fcc-border); }
.fcc-person-progress > span { display:block; height:100%; background:var(--person-color); transition:width .2s ease-out; }
.fcc-person-row-wrap { min-width:0; }
.fcc-person-row { display:flex; align-items:center; gap:18px; width:100%; min-height:104px; padding:18px; text-align:left; border:2px solid var(--fcc-border); border-radius:18px; background:var(--fcc-surface); box-shadow:var(--fcc-card-shadow); user-select:none; -webkit-user-select:none; }
.fcc-person-row[aria-pressed="true"] { border-color:color-mix(in srgb,var(--person-color) 45%,var(--fcc-border)); background:color-mix(in srgb,var(--person-color) 9%,var(--fcc-surface)); }
.fcc-person-check { width:42px; height:42px; border:3px solid var(--person-color); border-radius:12px; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; color:var(--person-color); }
.fcc-person-row[aria-pressed="true"] .fcc-person-check { background:var(--person-color); color:var(--fcc-bg); }
.fcc-person-row-body { display:flex; flex-direction:column; min-width:0; gap:8px; }
.fcc-person-row-body > strong { font-size:clamp(24px,2.65vmin,34px); line-height:1.2; overflow-wrap:anywhere; }
.fcc-person-row-meta { display:flex; flex-wrap:wrap; gap:5px 16px; font-size:clamp(17px,1.8vmin,23px); color:var(--fcc-text-2); }
.fcc-person-message, .fcc-person-row-error { margin:0; color:var(--fcc-text-2); font-size:18px; }
.fcc-person-message[role="alert"], .fcc-person-row-error { color:var(--fcc-text); background:var(--fcc-surface); border-left:4px solid var(--fcc-accent); padding:10px 14px; }
.fcc-person-row-error { margin-top:8px; }
.fcc-person-empty { min-height:150px; display:flex; align-items:center; justify-content:center; text-align:center; flex:1; color:var(--fcc-text-2); font-size:clamp(24px,3vmin,38px); }
@media (max-width:760px) { .fcc-person-chooser, .fcc-person-chores { grid-template-columns:minmax(0,1fr); } .fcc-person-card { min-height:152px; padding:20px; } .fcc-person-avatar-large { width:64px; height:64px; } .fcc-person-view { gap:12px; } }
@media (prefers-reduced-motion:reduce) { .fcc-person-progress > span { transition:none; } }
`;
