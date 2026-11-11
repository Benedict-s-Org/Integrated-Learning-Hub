import React, { useState } from 'react';
import { BookOpen, ClipboardCheck, Layers, PlayCircle, HandHelping, UserPlus, LineChart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GradeTaughtChecklistPanel } from './GradeTaughtChecklistPanel';
import { LearningSystemPractice } from './LearningSystemPractice';
import { TeacherFollowUpPanel } from './TeacherFollowUpPanel';
import { LearningSystemAssignModal } from './LearningSystemAssignModal';
import { LearningSystemProgressPanel } from './LearningSystemProgressPanel';
import { fetchStudentsForAssignment } from '../../lib/learningSystem/assignmentService';

type HubTab = 'overview' | 'checklist' | 'practice' | 'followup' | 'charts';

export interface LearningSystemPageProps {
  assignmentId?: string | null;
  assignmentGradeKey?: string | null;
  assignmentTitle?: string | null;
}

export const LearningSystemPage: React.FC<LearningSystemPageProps> = ({
  assignmentId = null,
  assignmentGradeKey = null,
  assignmentTitle = null,
}) => {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'class_staff';
  const fromAssignment = Boolean(assignmentId);
  const [tab, setTab] = useState<HubTab>(fromAssignment ? 'practice' : isStaff ? 'checklist' : 'overview');
  const [showAssign, setShowAssign] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-100 text-teal-700">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Learning System</h1>
                <p className="text-slate-600 text-sm md:text-base">
                  {assignmentTitle
                    ? `Assignment: ${assignmentTitle}`
                    : 'Grammar SRS and Proofreading hub with micro-skills and a shared grade taught checklist.'}
                </p>
              </div>
            </div>
            {isStaff && (
              <button
                type="button"
                onClick={() => setShowAssign(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              >
                <UserPlus className="w-4 h-4" />
                Assign practice
              </button>
            )}
          </div>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          <TabButton
            active={tab === 'overview'}
            onClick={() => setTab('overview')}
            icon={<BookOpen className="w-4 h-4" />}
            label="Overview"
          />
          <TabButton
            active={tab === 'practice'}
            onClick={() => setTab('practice')}
            icon={<PlayCircle className="w-4 h-4" />}
            label="Practice"
          />
          {isStaff && (
            <TabButton
              active={tab === 'checklist'}
              onClick={() => setTab('checklist')}
              icon={<ClipboardCheck className="w-4 h-4" />}
              label="Taught checklist"
            />
          )}
          {isStaff && (
            <TabButton
              active={tab === 'followup'}
              onClick={() => setTab('followup')}
              icon={<HandHelping className="w-4 h-4" />}
              label="Follow-up"
            />
          )}
          {isStaff && (
            <TabButton
              active={tab === 'charts'}
              onClick={() => setTab('charts')}
              icon={<LineChart className="w-4 h-4" />}
              label="Student charts"
            />
          )}
        </div>

        {tab === 'overview' && (
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard
              title="Standalone modules still available"
              body="Spaced Repetition and Proofreading Exercise remain in the Learning menu. This hub combines grammar practice with micro-skill rules without removing those entries."
            />
            <InfoCard
              title="Assignments"
              body="Teachers can assign a Learning System practice round. Students open it from My Assignments, finish one set, and the assignment completes."
            />
            <InfoCard
              title="How to try a set"
              body="Teachers mark skills taught on the checklist. Students open Practice to start a size-10 set. Tips for missed skills show after the set."
            />
            <InfoCard
              title="Still coming"
              body="Notion question banks. Seed examples power practice until then. Score charts are on My Progress. Teachers see weakness and follow-up on Student charts."
            />
          </div>
        )}

        {tab === 'practice' && (
          <LearningSystemPractice
            onExit={() => setTab('overview')}
            assignmentId={assignmentId}
            assignmentGradeKey={assignmentGradeKey}
            autoStart={fromAssignment}
          />
        )}

        {isStaff && tab === 'checklist' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
            <GradeTaughtChecklistPanel />
          </div>
        )}

        {isStaff && tab === 'followup' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
            <TeacherFollowUpPanel />
          </div>
        )}

        {isStaff && tab === 'charts' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
            <StaffStudentCharts />
          </div>
        )}
      </div>

      {showAssign && <LearningSystemAssignModal onClose={() => setShowAssign(false)} />}
    </div>
  );
};

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
        active
          ? 'bg-teal-600 text-white'
          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

function StaffStudentCharts() {
  const [students, setStudents] = React.useState<
    { id: string; display_name: string | null; username: string; class: string | null }[]
  >([]);
  const [studentId, setStudentId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetchStudentsForAssignment()
      .then((rows) => {
        setStudents(rows);
        if (rows[0]) setStudentId(rows[0].id);
      })
      .catch((err: any) => setError(err?.message || 'Could not load students.'));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Student charts</h2>
        <p className="text-sm text-slate-600 mt-1">
          Scores plus weakness and follow-up flags. Students see the charts on My Progress without this table.
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      <label className="block text-sm max-w-md space-y-1">
        <span className="font-semibold text-slate-700">Student</span>
        <select
          className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {(s.display_name || s.username) + (s.class ? ` (${s.class})` : '')}
            </option>
          ))}
        </select>
      </label>
      {studentId && <LearningSystemProgressPanel userId={studentId} showTeacherFields />}
    </div>
  );
}

export default LearningSystemPage;
