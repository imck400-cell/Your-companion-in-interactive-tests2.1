import React, { useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';
import { BarChart, CheckCircle, XCircle, TrendingUp, AlertTriangle } from 'lucide-react';

interface WeakPoint {
  question_text: string;
  mistakes_count: number;
}

interface AnalyticsData {
  total_completed: number;
  average_performance: number;
  weak_points: WeakPoint[];
}

const TeacherDashboardAnalytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.get('/analytics/dashboard');
      if (res.data && res.data.status === 'success') {
        setData(res.data.data);
      }
    } catch (err: any) {
      setError('تعذر تحميل بيانات الإحصائيات');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium">جاري تحليل البيانات وإعداد الإحصائيات...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 p-6 rounded-xl flex items-center gap-3">
        <AlertTriangle className="w-6 h-6" />
        <p>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  // Maximum mistakes to calculate percentage for progress bar
  const maxMistakes = data.weak_points.length > 0 ? Math.max(...data.weak_points.map(w => w.mistakes_count)) : 0;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-center gap-2 mb-2">
        <BarChart className="w-6 h-6 text-indigo-600" />
        <h2 className="text-2xl font-bold text-slate-800">نظرة عامة على الأداء</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Total Completed Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden group">
          <div className="absolute -left-4 -top-4 opacity-20 group-hover:scale-110 transition-transform duration-500">
            <CheckCircle className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <p className="text-indigo-100 font-medium text-lg mb-1">إجمالي الاختبارات المنجزة</p>
            <p className="text-4xl font-bold">{data.total_completed}</p>
          </div>
        </div>

        {/* Average Performance Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden group">
          <div className="absolute -left-4 -top-4 opacity-20 group-hover:scale-110 transition-transform duration-500">
            <TrendingUp className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <p className="text-emerald-100 font-medium text-lg mb-1">متوسط الأداء العام</p>
            <div className="flex items-baseline gap-1">
              <p className="text-4xl font-bold">{data.average_performance}</p>
              <span className="text-xl font-semibold">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Weak Points Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <XCircle className="w-5 h-5 text-rose-500" />
          <h3 className="text-xl font-bold text-slate-800">نقاط الضعف (أكثر الأسئلة خطأً)</h3>
        </div>

        {data.weak_points.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-slate-50 rounded-xl font-medium">
            لا توجد أخطاء مسجلة حتى الآن. أداء ممتاز!
          </div>
        ) : (
          <div className="space-y-6">
            {data.weak_points.map((point, index) => {
              const percentage = maxMistakes > 0 ? (point.mistakes_count / maxMistakes) * 100 : 0;
              return (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-start gap-4">
                    <p className="text-slate-700 font-medium leading-relaxed" title={point.question_text}>
                      {point.question_text}
                    </p>
                    <span className="bg-rose-100 text-rose-700 text-xs font-bold px-3 py-1 rounded-md shrink-0">
                      {point.mistakes_count} أخطاء
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden" dir="ltr">
                    <div 
                      className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboardAnalytics;
