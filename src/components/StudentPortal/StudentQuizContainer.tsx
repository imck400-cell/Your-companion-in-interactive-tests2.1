import React, { useState, useEffect, useRef } from 'react';
import { QuizMetadata, Question, StudentAnswer, Submission, SubmissionDetail } from '../../types';
import { QuestionCard } from './QuestionCard';
import { QuizResultScreen } from './QuizResultScreen';
import { saveSubmission, syncOfflineData, checkGuestAlreadySubmitted } from '../../services/firebase';
import { evaluateShortAnswer, normalizeArabicText } from '../../services/quizParser';
import { saveStudentDraft, getStudentDraft, deleteStudentDraft } from '../../services/offlineDb';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, SkipForward, Clock, Send, ShieldCheck, WifiOff, AlertTriangle, CheckCircle, Save } from 'lucide-react';

interface StudentQuizContainerProps {
  quiz: QuizMetadata;
  studentInfo: { name: string; grade: string; section: string; schoolName?: string; branch?: string; guestDeviceUuid?: string };
  isStatelessPublic?: boolean;
  existingSubmission?: Submission | null;
  initialViewMode?: 'take' | 'result';
  onFinish?: () => void;
}

// Deep answer comparison helper for Diff Checking
function isEqualAnswer(a: any, b: any): boolean {
  if (a === b) return true;
  if (
    (a === null || a === undefined || (typeof a === 'string' && !a.trim())) &&
    (b === null || b === undefined || (typeof b === 'string' && !b.trim()))
  ) {
    return true;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return normalizeArabicText(a) === normalizeArabicText(b);
  }
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

// Fisher-Yates shuffle algorithm to prevent cheating
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const StudentQuizContainer: React.FC<StudentQuizContainerProps> = ({
  quiz,
  studentInfo,
  isStatelessPublic = false,
  existingSubmission = null,
  initialViewMode = 'take',
  onFinish,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [questionTimeSpent, setQuestionTimeSpent] = useState<Record<string, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(initialViewMode === 'result' && !!existingSubmission);
  const [finalSubmission, setFinalSubmission] = useState<Submission | null>(
    initialViewMode === 'result' ? existingSubmission : null
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [lastAutoSaveText, setLastAutoSaveText] = useState<string>('');
  const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(
    quiz.timeLimitMinutes && quiz.timeLimitMinutes > 0 ? quiz.timeLimitMinutes * 60 : null
  );

  // Initialize shuffled questions and shuffled options for multiple-choice questions
  useEffect(() => {
    if (quiz.questions && quiz.questions.length > 0) {
      const questionsList = quiz.questions as Question[];
      const randomized = shuffleArray(questionsList).map((q) => {
        if (q.type === 'multiple_choice' && q.options && q.options.length > 0) {
          return {
            ...q,
            options: shuffleArray(q.options),
          };
        }
        return q;
      });
      setShuffledQuestions(randomized);
    } else {
      setShuffledQuestions([]);
    }
  }, [quiz.id]);

  const questions = shuffledQuestions.length > 0 ? shuffledQuestions : (quiz.questions || []);
  const currentQuestion = questions[currentIndex];

  const navBarRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the active question button into view inside the horizontal navigation track
  useEffect(() => {
    if (navBarRef.current && navBarRef.current.children[currentIndex]) {
      const activeBtn = navBarRef.current.children[currentIndex] as HTMLElement;
      activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentIndex]);

  // Load Draft from IndexedDB on mount if available
  useEffect(() => {
    async function loadExistingDraft() {
      try {
        const draft = await getStudentDraft(quiz.id, studentInfo.name);
        if (draft && draft.answers && Object.keys(draft.answers).length > 0) {
          setAnswers(draft.answers);
          if (draft.questionTimeSpent) setQuestionTimeSpent(draft.questionTimeSpent);
          if (typeof draft.currentIndex === 'number' && draft.currentIndex < questions.length) {
            setCurrentIndex(draft.currentIndex);
          }
          setLastAutoSaveText('تم استرجاع مسودتك المحفوظة تلقائياً');
        }
      } catch (e) {
        console.warn('Draft load warning:', e);
      }
    }
    loadExistingDraft();
  }, [quiz.id, studentInfo.name]);

  // Per-question cognitive time counter (1-second tick)
  useEffect(() => {
    if (!currentQuestion || isSubmitted) return;
    const interval = setInterval(() => {
      setQuestionTimeSpent((prev) => ({
        ...prev,
        [currentQuestion.id]: (prev[currentQuestion.id] || 0) + 1,
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentQuestion?.id, isSubmitted]);

  // Auto-Save Draft to IndexedDB every 5 seconds
  useEffect(() => {
    if (isSubmitted) return;
    const saveInterval = setInterval(async () => {
      try {
        const draftId = `${quiz.id}_${studentInfo.name.trim().toLowerCase()}`;
        await saveStudentDraft({
          draftId,
          quizId: quiz.id,
          studentName: studentInfo.name,
          grade: studentInfo.grade,
          section: studentInfo.section,
          answers,
          questionTimeSpent,
          currentIndex,
          lastSavedAt: new Date().toLocaleTimeString('ar-EG'),
        });
        setLastAutoSaveText(`تم الحفظ التلقائي المسودة (${new Date().toLocaleTimeString('ar-EG')})`);
      } catch (err) {
        console.warn('Auto save draft failed:', err);
      }
    }, 5000);

    return () => clearInterval(saveInterval);
  }, [quiz.id, studentInfo, answers, questionTimeSpent, currentIndex, isSubmitted]);

  // Handle Online Event to auto sync
  useEffect(() => {
    const handleOnline = () => {
      syncOfflineData();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Timer Countdown
  useEffect(() => {
    if (timeLeftSeconds === null || isSubmitted) return;
    if (timeLeftSeconds <= 0) {
      executeFinalSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeftSeconds, isSubmitted]);

  const handleAnswerChange = (ans: any) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        questionId: currentQuestion.id,
        answer: ans,
        skipped: false,
        timeSpentSeconds: questionTimeSpent[currentQuestion.id] || 0,
      },
    }));
  };

  const handleSkipQuestion = () => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        questionId: currentQuestion.id,
        answer: null,
        skipped: true,
        timeSpentSeconds: questionTimeSpent[currentQuestion.id] || 0,
      },
    }));
    goToNextQuestion();
  };

  const goToNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const goToPrevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Grade student answer helper with Arabic Normalizer & Synonyms support
  const evaluateAnswer = (q: any, studentAns: any): { isCorrect: boolean | null; earnedPoints: number } => {
    if (!studentAns || studentAns.skipped || studentAns.answer === undefined || studentAns.answer === null) {
      return { isCorrect: false, earnedPoints: 0 };
    }

    const userAns = studentAns.answer;

    if (q.type === 'multiple_choice') {
      const correctOpt = q.options?.find((o: any) => o.isCorrect);
      const isCorrect = correctOpt ? normalizeArabicText(userAns) === normalizeArabicText(correctOpt.text) : false;
      return { isCorrect, earnedPoints: isCorrect ? q.points : 0 };
    }

    if (q.type === 'true_false') {
      const correctVal = q.correctAnswer || q.options?.find((o: any) => o.isCorrect)?.text || 'صواب';
      const isCorrect = normalizeArabicText(userAns) === normalizeArabicText(correctVal);
      return { isCorrect, earnedPoints: isCorrect ? q.points : 0 };
    }

    if (q.type === 'fill_in' || q.type === 'explain' || q.type === 'answer') {
      const modelAns = q.correctAnswer || '';
      if (!modelAns) {
        // Non-empty student response
        const hasText = typeof userAns === 'string' && userAns.trim().length > 0;
        return { isCorrect: hasText, earnedPoints: hasText ? q.points : 0 };
      }
      const isCorrect = evaluateShortAnswer(userAns.toString(), modelAns);
      return { isCorrect, earnedPoints: isCorrect ? q.points : 0 };
    }

    if (q.type === 'matching' && q.matchingPairs) {
      let correctPairsCount = 0;
      q.matchingPairs.forEach((pair: any) => {
        if (userAns && normalizeArabicText(userAns[pair.left] || '') === normalizeArabicText(pair.right)) {
          correctPairsCount++;
        }
      });
      const ratio = correctPairsCount / q.matchingPairs.length;
      return { isCorrect: ratio === 1, earnedPoints: Math.round(ratio * q.points) };
    }

    if (q.type === 'classify' && q.classification) {
      let totalItems = 0;
      let correctItems = 0;
      q.classification.forEach((catGroup: any) => {
        catGroup.items.forEach((item: string) => {
          totalItems++;
          const studentAssignedCats = userAns ? userAns[catGroup.category] || [] : [];
          if (studentAssignedCats.includes(item)) {
            correctItems++;
          }
        });
      });
      const ratio = totalItems > 0 ? correctItems / totalItems : 1;
      return { isCorrect: ratio === 1, earnedPoints: Math.round(ratio * q.points) };
    }

    // Drawing, Essay -> award points for non-empty response
    const hasValue = typeof userAns === 'string' ? userAns.trim().length > 0 : !!userAns;
    return { isCorrect: hasValue, earnedPoints: hasValue ? q.points : 0 };
  };

  const handleAttemptSubmit = () => {
    // Check if there are unanswered or skipped questions
    const unansweredList = questions.filter((q, idx) => {
      const ans = answers[q.id];
      if (!ans || ans.skipped || ans.answer === null || ans.answer === undefined) return true;
      if (typeof ans.answer === 'string' && !ans.answer.trim()) return true;
      return false;
    });

    if (unansweredList.length > 0) {
      setShowConfirmModal(true);
    } else {
      executeFinalSubmit();
    }
  };

  const executeFinalSubmit = async () => {
    setShowConfirmModal(false);

    // Diff checking: If student previously submitted, check if answers changed at all
    if (existingSubmission && existingSubmission.details && existingSubmission.details.length > 0) {
      let hasAnyChange = false;
      for (const q of questions) {
        const currentAns = answers[q.id]?.answer;
        const prevDetail = existingSubmission.details.find((d) => d.questionId === q.id);
        const prevAns = prevDetail ? prevDetail.studentAnswer : undefined;

        if (!isEqualAnswer(currentAns, prevAns)) {
          hasAnyChange = true;
          break;
        }
      }

      if (!hasAnyChange) {
        alert('لم تقم بإجراء أي تعديلات جديدة لإرسالها');
        return;
      }
    }

    // Duplicate submission lock check for Guest Direct Login
    if (studentInfo.guestDeviceUuid) {
      const alreadySubmitted = await checkGuestAlreadySubmitted(quiz.id, studentInfo.guestDeviceUuid);
      if (alreadySubmitted) {
        alert('لقد قمت بتسليم هذا الاختبار مسبقاً من هذا الجهاز');
        return;
      }
    }

    let totalScore = 0;
    let maxScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;
    let totalTimeSecs = 0;

    const details: SubmissionDetail[] = [];

    questions.forEach((q) => {
      maxScore += q.points;
      const studentAns = answers[q.id];
      const spentTime = questionTimeSpent[q.id] || 0;
      totalTimeSecs += spentTime;

      if (!studentAns || studentAns.skipped || studentAns.answer === null) {
        skippedCount++;
        details.push({
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.type,
          studentAnswer: null,
          correctAnswer: q.correctAnswer || q.options?.find((o) => o.isCorrect)?.text,
          isCorrect: false,
          points: q.points,
          earnedPoints: 0,
          skipped: true,
          explanation: q.explanation,
          timeSpentSeconds: spentTime,
        });
      } else {
        const evaluation = evaluateAnswer(q, studentAns);
        if (evaluation.isCorrect) correctCount++;
        else incorrectCount++;

        totalScore += evaluation.earnedPoints;

        details.push({
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.type,
          studentAnswer: studentAns.answer,
          correctAnswer: q.correctAnswer || q.options?.find((o) => o.isCorrect)?.text,
          isCorrect: evaluation.isCorrect,
          points: q.points,
          earnedPoints: evaluation.earnedPoints,
          skipped: false,
          explanation: q.explanation,
          timeSpentSeconds: spentTime,
        });
      }
    });

    const submissionObj: Submission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      quizId: quiz.id,
      quizTitle: quiz.title,
      studentName: studentInfo.name,
      grade: studentInfo.grade,
      section: studentInfo.section,
      schoolName: quiz.schoolName,
      teacherName: quiz.teacherName,
      score: totalScore,
      maxScore: maxScore,
      correctCount,
      incorrectCount,
      skippedCount,
      totalTimeSpentSeconds: totalTimeSecs,
      details,
      submittedAt: new Date().toLocaleString('ar-EG'),
      synced: isStatelessPublic ? true : false,
      guestDeviceUuid: studentInfo.guestDeviceUuid,
    };

    // Stage 13: STRICT CONSTRAINT - No POST Request for Public Stateless Tests!
    if (isStatelessPublic) {
      // Local Client-Side JS Evaluation only -> No server POST
      console.log('Stateless Public Test completed locally (Client-Side Evaluation, No POST request sent).');
    } else {
      // Regular School Assignment -> Save to Database
      const res = await saveSubmission(submissionObj);
      submissionObj.synced = res.synced;
    }

    // Delete draft after successful evaluation
    await deleteStudentDraft(quiz.id, studentInfo.name);

    setFinalSubmission(submissionObj);
    setIsSubmitted(true);
  };

  const handleRetry = () => {
    setAnswers({});
    setQuestionTimeSpent({});
    setCurrentIndex(0);
    setIsSubmitted(false);
    setFinalSubmission(null);
    if (quiz.timeLimitMinutes && quiz.timeLimitMinutes > 0) {
      setTimeLeftSeconds(quiz.timeLimitMinutes * 60);
    }
    if (quiz.questions && quiz.questions.length > 0) {
      const questionsList = quiz.questions as Question[];
      const randomized = shuffleArray(questionsList).map((q) => {
        if (q.type === 'multiple_choice' && q.options && q.options.length > 0) {
          return {
            ...q,
            options: shuffleArray(q.options),
          };
        }
        return q;
      });
      setShuffledQuestions(randomized);
    }
  };

  if (isSubmitted && finalSubmission) {
    return (
      <QuizResultScreen
        submission={finalSubmission}
        isStatelessPublic={isStatelessPublic}
        onRetry={quiz.allowFullQuizRetake ? handleRetry : undefined}
        onRestart={onFinish || (() => {})}
      />
    );
  }

  const currentStudentAns = answers[currentQuestion?.id]?.answer;
  const currentStudentAnsObj = answers[currentQuestion?.id];

  const isCurrentQuestionAnswered = (() => {
    if (!currentQuestion || !currentStudentAnsObj) return false;
    if (currentStudentAnsObj.skipped) return false;
    const ans = currentStudentAnsObj.answer;
    if (ans === null || ans === undefined) return false;
    if (typeof ans === 'string') return ans.trim().length > 0;
    if (typeof ans === 'number' || typeof ans === 'boolean') return true;
    if (Array.isArray(ans)) return ans.length > 0;
    if (typeof ans === 'object') {
      const keys = Object.keys(ans);
      if (keys.length === 0) return false;
      return keys.some((k) => {
        const val = ans[k];
        if (typeof val === 'string') return val.trim().length > 0;
        if (Array.isArray(val)) return val.length > 0;
        return !!val;
      });
    }
    return !!ans;
  })();

  const answeredCount = (Object.values(answers) as StudentAnswer[]).filter((a) => a.answer !== null && a.answer !== undefined && !a.skipped).length;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-3xl mx-auto my-6 px-4 dir-rtl space-y-4">
      {/* Top Header & Status */}
      <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-200 space-y-3">
        {/* Stage 13: Stateless Public Test Notice */}
        {isStatelessPublic && (
          <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-black flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              اختبار عام تدريبي (Stateless) - تصحيح كلي عبر Client-Side JS مع حظر تام لإرسال طلبات POST للخادم.
            </span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px]">0% Server Overhead</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            <span>الطالب: <strong className="text-indigo-700 font-extrabold">{studentInfo.name}</strong></span>
            {studentInfo.schoolName && (
              <>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600 font-bold">{studentInfo.schoolName} ({studentInfo.branch || 'عام'})</span>
              </>
            )}
            <span className="text-slate-300">|</span>
            <span>الصف: {studentInfo.grade} - الشعبة: {studentInfo.section}</span>
          </div>

          <div className="flex items-center gap-3">
            {lastAutoSaveText && (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200">
                <Save className="w-3 h-3 text-emerald-600" />
                {lastAutoSaveText}
              </span>
            )}
            {timeLeftSeconds !== null && (
              <div className={`flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded-lg ${
                timeLeftSeconds < 60 ? 'bg-red-100 text-red-700 font-bold animate-pulse' : 'bg-slate-100 text-slate-800'
              }`}>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                {formatTimer(timeLeftSeconds)}
              </div>
            )}
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>نسبة إكمال الإجابات:</span>
            <span className="text-indigo-600 font-extrabold">{progressPercent}% ({answeredCount} من {questions.length} سؤال)</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Interactive Scrollable Question Track under Progress Bar */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-0.5">
            <span>شريط أسئلة الاختبار التفاعلي (اسحب أفقيًا لتصفح كافة الأسئلة):</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> مجاب</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> متخطى</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> متبقي</span>
            </div>
          </div>

          <div
            ref={navBarRef}
            className="flex items-center gap-2 overflow-x-auto py-2 px-1.5 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-slate-100 rounded-xl bg-slate-50 border border-slate-200/80 shadow-inner"
            style={{ scrollBehavior: 'smooth' }}
          >
            {questions.map((q, idx) => {
              const ans = answers[q.id];
              const isCurrent = idx === currentIndex;
              const isAnswered = ans && ans.answer !== null && ans.answer !== undefined && !ans.skipped && (typeof ans.answer !== 'string' || ans.answer.trim().length > 0);
              const isSkipped = ans && ans.skipped;

              let pillStyle = 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100';
              if (isAnswered) pillStyle = 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs';
              else if (isSkipped) pillStyle = 'bg-amber-500 text-white border-amber-500 font-bold shadow-xs';

              if (isCurrent) pillStyle += ' ring-2 ring-indigo-600 ring-offset-2 scale-110 font-black z-10';

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`min-w-8 h-8 rounded-lg text-xs flex items-center justify-center border transition-all shrink-0 px-2.5 ${pillStyle}`}
                  title={`الانتقال إلى السؤال ${idx + 1}`}
                >
                  س{idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card Wrapper with AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
        >
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={questions.length}
            currentAnswer={currentStudentAns}
            onAnswerChange={handleAnswerChange}
            showImmediateFeedback={quiz.showFeedback === 'immediate'}
            isAnswerSubmitted={!!answers[currentQuestion.id]}
            questionTimeSpentSeconds={questionTimeSpent[currentQuestion.id] || 0}
            allowAnswerChange={quiz.allowAnswerChange}
          />
        </motion.div>
      </AnimatePresence>

      {/* Navigation & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-8">
        <button
          type="button"
          onClick={goToPrevQuestion}
          disabled={currentIndex === 0}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-30 transition-all"
        >
          <ArrowRight className="w-4 h-4" />
          السؤال السابق
        </button>

        <button
          type="button"
          onClick={handleSkipQuestion}
          className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs flex items-center gap-1 transition-all border border-amber-200"
        >
          <SkipForward className="w-4 h-4 text-amber-600" />
          تخطي السؤال
        </button>

        {currentIndex < questions.length - 1 ? (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={goToNextQuestion}
              disabled={!isCurrentQuestionAnswered}
              className={`px-5 py-2.5 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all ${
                isCurrentQuestionAnswered
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
              }`}
              title={!isCurrentQuestionAnswered ? 'يرجى الإجابة عن السؤال للانتقال، أو اضغط زر تخطي' : ''}
            >
              السؤال التالي
              <ArrowLeft className="w-4 h-4" />
            </button>
            {!isCurrentQuestionAnswered && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                أجِب للتفعيل أو اضغط "تخطي"
              </span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAttemptSubmit}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all transform hover:scale-[1.02] cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {isStatelessPublic ? 'إنهاء وإظهار التقرير' : 'تسليم وإرادة النتيجة'}
          </button>
        )}
      </div>

      {/* Confirmation Modal for Unanswered Questions */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-right dir-rtl"
          >
            <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="font-extrabold text-sm text-amber-900">تنبيه قبل التسليم النهائي!</h4>
                <p className="text-xs text-amber-800">توجد أسئلة لم تقم بإجابتها بعد.</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <p className="font-bold">قائمة الأسئلة الشاغرة أو المتخطاة:</p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {questions.map((q, idx) => {
                  const ans = answers[q.id];
                  const isEmpty = !ans || ans.skipped || ans.answer === null || ans.answer === undefined || (typeof ans.answer === 'string' && !ans.answer.trim());
                  if (!isEmpty) return null;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowConfirmModal(false);
                      }}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold border border-amber-300"
                    >
                      سؤال {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              هل تفضّل المراجعة وإكمال الإجابات أم ترغب في إنهاء الاختبار وتسليمه فوراً؟
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-all"
              >
                العودة للمراجعة
              </button>

              <button
                type="button"
                onClick={executeFinalSubmit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all"
              >
                تأكيد التسليم الآن
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
