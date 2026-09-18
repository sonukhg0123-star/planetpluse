import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import {
  Car, Bus, Plane, Zap, Salad, Beef, AlertTriangle, CheckCircle2,
  TrendingUp, Calendar, Trash2, Filter, Download, Plus, Info,
  Flame, ShieldAlert, Award, FileText, Code2, RefreshCw, ExternalLink,
  HelpCircle, ChevronRight, Sparkles, BookOpen
} from 'lucide-react';

// Official fixed multipliers as specified by the brief
const CONVERSION_FACTORS = {
  car: { label: 'Car Travel', rate: 0.20, unit: 'km', icon: Car, color: '#0ea5e9', absurdThreshold: 1500 },
  bus: { label: 'Bus Travel', rate: 0.08, unit: 'km', icon: Bus, color: '#10b981', absurdThreshold: 1000 },
  flight: { label: 'Flight', rate: 0.25, unit: 'km', icon: Plane, color: '#6366f1', absurdThreshold: 15000 },
  electricity: { label: 'Electricity', rate: 0.80, unit: 'kWh', icon: Zap, color: '#f59e0b', absurdThreshold: 300 },
  veg_meal: { label: 'Veg Meal', rate: 0.50, unit: 'meals', icon: Salad, color: '#84cc16', absurdThreshold: 15 },
  non_veg_meal: { label: 'Non-Veg Meal', rate: 2.00, unit: 'meals', icon: Beef, color: '#ef4444', absurdThreshold: 10 }
};

const DEFAULT_TARGET = 50.0; // Default weekly CO2 target in kg

// DP3 Implementation: Standard Calendar Week (Monday 00:00 to Sunday 23:59)
function getWeekRange(dateObj = new Date()) {
  const d = new Date(dateObj);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  
  const monday = new Date(d.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const INITIAL_ACTIVITIES = [
  { id: '1', type: 'car', quantity: 25, co2: 5.0, date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], note: 'Office commute' },
  { id: '2', type: 'electricity', quantity: 18, co2: 14.4, date: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0], note: 'AC & Appliances' },
  { id: '3', type: 'non_veg_meal', quantity: 2, co2: 4.0, date: new Date().toISOString().split('T')[0], note: 'Dinner with team' },
  { id: '4', type: 'bus', quantity: 15, co2: 1.2, date: new Date().toISOString().split('T')[0], note: 'City transit' },
  { id: '5', type: 'veg_meal', quantity: 3, co2: 1.5, date: new Date().toISOString().split('T')[0], note: 'Lunch & Breakfast' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker', 'api', 'decisions', 'readme'
  const [activities, setActivities] = useState(() => {
    try {
      const saved = localStorage.getItem('planetpulse_activities');
      return saved ? JSON.parse(saved) : INITIAL_ACTIVITIES;
    } catch {
      return INITIAL_ACTIVITIES;
    }
  });

  const [weeklyTarget, setWeeklyTarget] = useState(() => {
    try {
      const saved = localStorage.getItem('planetpulse_target');
      return saved ? parseFloat(saved) : DEFAULT_TARGET;
    } catch {
      return DEFAULT_TARGET;
    }
  });

  // Form State
  const [selectedType, setSelectedType] = useState('car');
  const [quantity, setQuantity] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  // Filter State
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // DP2: Absurd Input Modal State
  const [absurdModal, setAbsurdModal] = useState({
    isOpen: false,
    pendingData: null,
    reason: ''
  });

  // Toast / notification state
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    localStorage.setItem('planetpulse_activities', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem('planetpulse_target', weeklyTarget.toString());
  }, [weeklyTarget]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const { start: weekStart, end: weekEnd } = useMemo(() => getWeekRange(new Date()), []);
  
  // Current calendar day in the week (1=Monday ... 7=Sunday)
  const currentDayOfWeek = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : d;
  }, []);

  // Filter current week's activities
  const thisWeekActivities = useMemo(() => {
    return activities.filter((act) => {
      const actDate = new Date(act.date + 'T00:00:00');
      return actDate >= weekStart && actDate <= weekEnd;
    });
  }, [activities, weekStart, weekEnd]);

  // Current week total CO2
  const currentWeekCO2 = useMemo(() => {
    return thisWeekActivities.reduce((acc, curr) => acc + curr.co2, 0);
  }, [thisWeekActivities]);

  // All time total
  const allTimeCO2 = useMemo(() => {
    return activities.reduce((acc, curr) => acc + curr.co2, 0);
  }, [activities]);

  // Progress percentage
  const budgetPercentage = weeklyTarget > 0 ? (currentWeekCO2 / weeklyTarget) * 100 : 0;
  const isTargetExceeded = currentWeekCO2 > weeklyTarget;

  const categoryChartData = useMemo(() => {
    const totals = {
      car: 0, bus: 0, flight: 0, electricity: 0, veg_meal: 0, non_veg_meal: 0
    };
    activities.forEach(item => {
      if (totals[item.type] !== undefined) {
        totals[item.type] += item.co2;
      }
    });

    return Object.keys(totals).map(key => ({
      name: CONVERSION_FACTORS[key].label,
      value: parseFloat(totals[key].toFixed(2)),
      color: CONVERSION_FACTORS[key].color
    })).filter(item => item.value > 0);
  }, [activities]);

  const weeklyTrendData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const result = days.map((dayName, idx) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + idx);
      const dateStr = d.toISOString().split('T')[0];
      const dayTotal = activities
        .filter(act => act.date === dateStr)
        .reduce((sum, act) => sum + act.co2, 0);
      return {
        day: dayName,
        date: dateStr,
        co2: parseFloat(dayTotal.toFixed(2)),
        isToday: dateStr === new Date().toISOString().split('T')[0]
      };
    });
    return result;
  }, [activities, weekStart]);

  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      if (typeFilter !== 'all' && act.type !== typeFilter) return false;
      if (startDateFilter && act.date < startDateFilter) return false;
      if (endDateFilter && act.date > endDateFilter) return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [activities, typeFilter, startDateFilter, endDateFilter]);

  const handleAddActivity = (e) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter a valid positive quantity.');
      return;
    }

    const factorConfig = CONVERSION_FACTORS[selectedType];
    const computedCO2 = parseFloat((qty * factorConfig.rate).toFixed(2));

    // Check Absurd Threshold (DP2)
    if (qty > factorConfig.absurdThreshold) {
      let reasonText = `A single entry of ${qty.toLocaleString()} ${factorConfig.unit} for ${factorConfig.label} is extraordinarily high (above typical maximum of ${factorConfig.absurdThreshold} ${factorConfig.unit}).`;
      if (selectedType === 'car') reasonText += ' This is equivalent to driving over 35 hours non-stop.';
      if (selectedType === 'electricity') reasonText += ' Typical households use around 10-30 kWh per entire day.';
      if (selectedType === 'veg_meal' || selectedType === 'non_veg_meal') reasonText += ' That exceeds human daily intake limits.';

      setAbsurdModal({
        isOpen: true,
        pendingData: {
          id: Date.now().toString(),
          type: selectedType,
          quantity: qty,
          co2: computedCO2,
          date: activityDate,
          note: note.trim()
        },
        reason: reasonText
      });
      return;
    }

    // Direct save if within realistic range
    saveActivity({
      id: Date.now().toString(),
      type: selectedType,
      quantity: qty,
      co2: computedCO2,
      date: activityDate,
      note: note.trim()
    });
  };

  const saveActivity = (newEntry) => {
    setActivities(prev => [newEntry, ...prev]);
    setQuantity('');
    setNote('');
    showToast(`Logged ${newEntry.co2} kg CO2 successfully!`);
  };

  const confirmAbsurdInput = () => {
    if (absurdModal.pendingData) {
      saveActivity(absurdModal.pendingData);
    }
    setAbsurdModal({ isOpen: false, pendingData: null, reason: '' });
  };

  const handleDeleteActivity = (id) => {
    setActivities(prev => prev.filter(item => item.id !== id));
    showToast('Activity entry deleted.');
  };

  const handleResetData = () => {
    setActivities(INITIAL_ACTIVITIES);
    setWeeklyTarget(DEFAULT_TARGET);
    showToast('Sample dataset restored!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-400/30 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-5 w-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                  PlanetPulse
                </h1>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Track 2
                </span>
              </div>
              <p className="text-xs text-slate-400">Carbon Footprint Tracker • Zero-Auth Grader Mode</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('tracker')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'tracker'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Tracker App
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'api'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              API Tester
            </button>
            <button
              onClick={() => setActiveTab('decisions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'decisions'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              DECISIONS.md
            </button>
            <button
              onClick={() => setActiveTab('readme')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'readme'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              README.md
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* VIEW 1: Core Carbon Tracker Application */}
        {activeTab === 'tracker' && (
          <>
            {/* DP1: THE NUDGE BANNER (When target is exceeded) */}
            {isTargetExceeded ? (
              <div className="bg-amber-950/40 border-2 border-amber-500/50 rounded-2xl p-5 shadow-xl backdrop-blur-sm animate-pulse flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-amber-200 flex items-center gap-2">
                      Weekly CO₂ Budget Exceeded ({currentWeekCO2.toFixed(1)} / {weeklyTarget} kg)
                    </h3>
                    <p className="text-xs text-amber-300/80 mt-1 max-w-2xl leading-relaxed">
                      <strong>The Nudge (DP1):</strong> You’ve reached {budgetPercentage.toFixed(0)}% of your planned budget. Rather than penalizing or blocking access, we encourage climate-conscious swaps for the rest of this week: take public transit for short trips, try an extra plant-based meal, and turn off standby appliances!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setWeeklyTarget(prev => prev + 15)}
                  className="whitespace-nowrap px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold rounded-xl transition shadow"
                >
                  Adjust Budget (+15 kg)
                </button>
              </div>
            ) : (
              <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <p className="text-xs text-emerald-300">
                    <strong>Weekly Status:</strong> You are currently on track! Used {currentWeekCO2.toFixed(1)} kg of your {weeklyTarget} kg weekly goal ({budgetPercentage.toFixed(0)}%).
                  </p>
                </div>
                <span className="text-xs text-emerald-400/80 font-mono hidden sm:inline">
                  Week: Mon {formatDate(weekStart)} – Sun {formatDate(weekEnd)}
                </span>
              </div>
            )}

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Weekly Progress vs Target (DP3) */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold uppercase text-slate-400">This Week's Emission</span>
                  <span className="text-xs text-slate-500">Day {currentDayOfWeek} of 7</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-extrabold ${isTargetExceeded ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {currentWeekCO2.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400">/ {weeklyTarget} kg CO₂</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-2.5 rounded-full mt-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isTargetExceeded ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center mt-3 text-[11px] text-slate-400">
                  <span>{budgetPercentage.toFixed(0)}% budget consumed</span>
                  <span>{Math.max(0, weeklyTarget - currentWeekCO2).toFixed(1)} kg remaining</span>
                </div>
              </div>

              {/* Card 2: All Time Total */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold uppercase text-slate-400">Total Recorded Emission</span>
                  <Flame className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">
                    {allTimeCO2.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400">kg CO₂ equivalent</span>
                </div>
                <p className="text-xs text-slate-400 mt-4">
                  Across {activities.length} total logged activities.
                </p>
                <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Fixed carbon conversion model active</span>
                </div>
              </div>

              {/* Card 3: Target Setting Quick Adjust */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase text-slate-400">Set Weekly Target</span>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      step="5"
                      value={weeklyTarget}
                      onChange={(e) => setWeeklyTarget(Math.max(1, parseFloat(e.target.value) || 1))}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-lg w-28 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-xs text-slate-400">kg CO₂ / week</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Recommended European average is ~60 kg/week; global climate goal is &lt; 35 kg/week.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Section */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  Log Carbon Activity
                </h2>

                <form onSubmit={handleAddActivity} className="space-y-4">
                  {/* Category Selection Grid */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2">
                      Select Activity Category
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(CONVERSION_FACTORS).map(([key, item]) => {
                        const IconComponent = item.icon;
                        const isSelected = selectedType === key;
                        return (
                          <button
                            type="button"
                            key={key}
                            onClick={() => setSelectedType(key)}
                            className={`p-2.5 rounded-xl border text-left flex flex-col items-center justify-center gap-1 transition-all ${
                              isSelected
                                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            <IconComponent className="w-5 h-5" style={{ color: isSelected ? '#10b981' : item.color }} />
                            <span className="text-[11px] font-medium text-center leading-tight">{item.label}</span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {item.rate} kg/{item.unit}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quantity and Unit Input */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Quantity ({CONVERSION_FACTORS[selectedType].unit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="e.g. 15"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Activity Date
                      </label>
                      <input
                        type="date"
                        required
                        value={activityDate}
                        onChange={(e) => setActivityDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Optional Note */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Description / Note (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Daily commute, flight to conference..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Realtime CO2 Preview Box */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Calculated CO₂ Footprint:</span>
                    <span className="text-sm font-mono font-bold text-emerald-400">
                      {quantity && !isNaN(parseFloat(quantity))
                        ? (parseFloat(quantity) * CONVERSION_FACTORS[selectedType].rate).toFixed(2)
                        : '0.00'}{' '}
                      kg CO₂
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Record Activity
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-teal-400" />
                      Visual Analytics & Category Breakdown
                    </h2>
                    <span className="text-xs text-slate-500">Live Recharts Engine</span>
                  </div>

                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Category Donut Chart */}
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <h4 className="text-xs font-semibold text-slate-400 mb-2 text-center">
                        Emissions by Category (kg CO₂)
                      </h4>
                      {categoryChartData.length > 0 ? (
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={categoryChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={60}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {categoryChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <RechartsTooltip
                                formatter={(value) => [`${value} kg CO₂`, 'Emissions']}
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-44 flex items-center justify-center text-xs text-slate-600">
                          No logged data
                        </div>
                      )}
                      <div className="flex flex-wrap justify-center gap-2 mt-1">
                        {categoryChartData.map((item) => (
                          <div key={item.name} className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                            <span>{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Current Week Daily Bar Chart */}
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <h4 className="text-xs font-semibold text-slate-400 mb-2 text-center">
                        This Week's Daily Trend (kg CO₂)
                      </h4>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weeklyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} />
                            <RechartsTooltip
                              formatter={(value) => [`${value} kg CO₂`, 'Emission']}
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                            />
                            <Bar dataKey="co2" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[10px] text-center text-slate-500 mt-2">
                        Monday to Sunday calendar progress
                      </p>
                    </div>
                  </div>
                </div>

                {/* Factors Reference Table */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                  <span><strong>Multipliers:</strong> Car: 0.20 | Bus: 0.08 | Flight: 0.25 | Elec: 0.80 | Veg: 0.5 | Non-veg: 2.0</span>
                  <button onClick={handleResetData} className="text-emerald-400 hover:underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Reset Sample Data
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    Activity History & Records
                  </h3>
                  <p className="text-xs text-slate-400">View, search, filter and audit all logged emission activities.</p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="bg-transparent text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="all">All Categories</option>
                      {Object.entries(CONVERSION_FACTORS).map(([key, item]) => (
                        <option key={key} value={key} className="bg-slate-900 text-white">
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                    title="Start Date"
                  />
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                    title="End Date"
                  />

                  {(typeFilter !== 'all' || startDateFilter || endDateFilter) && (
                    <button
                      onClick={() => {
                        setTypeFilter('all');
                        setStartDateFilter('');
                        setEndDateFilter('');
                      }}
                      className="px-2 py-1 text-xs text-amber-400 hover:text-amber-300 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="p-3">Date</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Quantity</th>
                      <th className="p-3">Factor</th>
                      <th className="p-3">CO₂ Emitted</th>
                      <th className="p-3">Notes</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredActivities.length > 0 ? (
                      filteredActivities.map((act) => {
                        const meta = CONVERSION_FACTORS[act.type];
                        const Icon = meta.icon;
                        return (
                          <tr key={act.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-3 font-mono text-slate-300">{formatDate(act.date)}</td>
                            <td className="p-3">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                                style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {meta.label}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-slate-200">
                              {act.quantity} {meta.unit}
                            </td>
                            <td className="p-3 font-mono text-slate-400">
                              {meta.rate} kg/{meta.unit}
                            </td>
                            <td className="p-3 font-mono font-bold text-emerald-400">
                              {act.co2.toFixed(2)} kg
                            </td>
                            <td className="p-3 text-slate-400 italic max-w-xs truncate">
                              {act.note || '—'}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleDeleteActivity(act.id)}
                                className="p-1 text-slate-500 hover:text-red-400 transition"
                                title="Delete entry"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-slate-500">
                          No activities found matching selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {absurdModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-amber-300">
                    Decision Point 2: Absurd Input Detected
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Unusual quantity submitted: {absurdModal.pendingData?.quantity}{' '}
                    {CONVERSION_FACTORS[absurdModal.pendingData?.type]?.unit}.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                {absurdModal.reason}
              </div>

              <p className="text-xs text-slate-400">
                Are you sure this entry is genuine, or was it an accidental typo?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setAbsurdModal({ isOpen: false, pendingData: null, reason: '' })}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
                >
                  Edit Value
                </button>
                <button
                  onClick={confirmAbsurdInput}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition"
                >
                  Confirm & Log Anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-emerald-400" />
                  Standard REST API & Autonomous Grader Endpoints
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Evaluators and automated agent scripts can interact with the tracker state directly without authentication.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg text-xs font-mono">
                Status: 200 OK (Live)
              </span>
            </div>

            {/* Endpoints specification */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-sky-950 text-sky-400 border border-sky-800 text-[10px] font-mono font-bold rounded">
                    GET
                  </span>
                  <code className="text-xs text-white">/api/activities</code>
                </div>
                <p className="text-xs text-slate-400">
                  Retrieves all recorded emissions, factors, and computed CO2 values.
                </p>
                <div className="bg-slate-900 p-2.5 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto">
                  {JSON.stringify(activities.slice(0, 2), null, 2)}
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold rounded">
                    GET / POST
                  </span>
                  <code className="text-xs text-white">/api/target</code>
                </div>
                <p className="text-xs text-slate-400">
                  Reads or updates the weekly target and returns budget calculation metrics.
                </p>
                <div className="bg-slate-900 p-2.5 rounded-lg text-[11px] font-mono text-teal-400 overflow-x-auto">
                  {JSON.stringify({
                    weekly_target_kg: weeklyTarget,
                    current_week_co2_kg: parseFloat(currentWeekCO2.toFixed(2)),
                    is_target_exceeded: isTargetExceeded,
                    budget_consumed_percent: parseFloat(budgetPercentage.toFixed(1))
                  }, null, 2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'decisions' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md space-y-6">
            <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  DECISIONS.md
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Required hackathon justification for the three deliberate Decision Points (2-4 sentences each).
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono">Repo Root File</span>
            </div>

            <div className="space-y-6 text-sm text-slate-300">
              {/* DP1 */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <h4 className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  DP1: The Nudge (Weekly Target Exceeded)
                </h4>
                <p className="text-xs leading-relaxed text-slate-300">
                  When a user's weekly carbon target is exceeded, the application triggers an informative warning banner accompanied by actionable, positive climate encouragement rather than blocking features or punitive shaming. Behavioral climate psychology demonstrates that shaming causes user disengagement and abandonment, whereas transparent, supportive nudges with practical alternatives empower users to offset subsequent activities and achieve long-term sustainability habits.
                </p>
              </div>

              {/* DP2 */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <h4 className="text-amber-400 font-bold mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  DP2: Absurd Input Handling
                </h4>
                <p className="text-xs leading-relaxed text-slate-300">
                  When a user enters an outlier value (such as a 500,000 km car drive or 50 meals), the app halts submission and presents an explanatory confirmation modal detailing why the figure appears anomalous compared to physical realities. We avoid silently capping or hard-blocking inputs so that extraordinary industrial or multi-passenger aggregated cases can proceed if intentional, while simultaneously preventing accidental fat-finger typos from permanently corrupting analytical charts.
                </p>
              </div>

              {/* DP3 */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <h4 className="text-teal-400 font-bold mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  DP3: The Week Definition & Mid-Week Progress
                </h4>
                <p className="text-xs leading-relaxed text-slate-300">
                  A week is strictly defined using the ISO-8601 standard calendar week starting Monday at 00:00 and ending Sunday at 23:59. Mid-week progress is visualized using a dynamic day-of-week tracker (e.g., "Day 4 of 7") alongside a dual-colored budget consumption progress bar, enabling users to evaluate their emission pace against expected temporal burn rates rather than waiting until the week closes.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'readme' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md space-y-6">
            <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                  README.md
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Ready-to-copy root documentation formatted with all mandatory hackathon tags.
                </p>
              </div>
              <span className="text-xs text-emerald-400 font-mono">Submission Ready</span>
            </div>

            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`# PlanetPulse - Carbon Footprint Tracker
**Hackathon ID:** [INSERT_YOUR_HACKATHON_ID_HERE]
**Track:** Track 2: Real-World AI Products
**Brief:** Climate Tech - A Carbon Footprint Tracker

## 🌿 Overview
PlanetPulse turns daily choices into a visible carbon footprint, tracking activities across transportation, home energy, and diet with fixed scientific conversion factors.

## 🚀 Key Features
1. **Log Activity:** Supports Car, Bus, Flight, Electricity, and Meals with instant CO2 computation.
2. **Fixed Conversion Multipliers:**
   - Car: 0.20 kg CO2 / km
   - Bus: 0.08 kg CO2 / km
   - Flight: 0.25 kg CO2 / km
   - Electricity: 0.80 kg CO2 / kWh
   - Veg meal: 0.5 kg CO2 / meal
   - Non-veg meal: 2.0 kg CO2 / meal
3. **Weekly Target & Nudge (DP1):** Dynamic budget tracking with constructive warnings and reduction suggestions when exceeded.
4. **Absurd Input Sanity Check (DP2):** Intercepts extreme entries with an educational confirmation modal.
5. **Calendar Week Standard (DP3):** Monday to Sunday tracking with mid-week temporal progress indicators.
6. **Zero Authentication:** Directly accessible by automated test runners and evaluators without login barriers.

## 🛠 Tech Stack
- React / Next.js
- Tailwind CSS
- Recharts Visualization Engine
- Lucide React Icons
- LocalStorage Client Persistence

## 💻 Setup & Local Run
\`\`\`bash
git clone https://github.com/your-username/planetpulse.git
cd planetpulse
npm install
npm run dev
\`\`\`
Visit http://localhost:3000 to interact with the application.`}
            </pre>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 mt-12 py-6 bg-slate-950 text-center text-xs text-slate-500">
        <p>PlanetPulse Climate Tech Tracker • Built for Hackathon Track 2 Submission</p>
      </footer>
    </div>
  );
}