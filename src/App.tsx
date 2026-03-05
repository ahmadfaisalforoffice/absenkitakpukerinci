import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  MapPin, 
  Clock, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  LogOut,
  User,
  Calendar as CalendarIcon,
  Users,
  Download,
  LayoutDashboard,
  Lock,
  Search,
  Power,
  PowerOff,
  Eye,
  EyeOff,
  Loader2,
  Filter,
  KeyRound,
  RotateCcw
} from 'lucide-react';
import Webcam from 'react-webcam';
import { format, isAfter, parse, addMinutes, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { cn, OFFICE_LOCATION, calculateDistance, getWorkSchedule, parseDate, getJakartaDate } from './lib/utils';
import * as XLSX from 'xlsx';

type UserData = {
  id: number;
  username: string;
  role: string;
  display_name: string;
  is_active: number;
};

type AttendanceRecord = {
  id: number;
  user_id: number;
  display_name?: string;
  type: 'in' | 'out';
  timestamp: string;
  photo: string;
  latitude: number;
  longitude: number;
  is_late: number;
  late_minutes: number;
  scheduled_out_time: string | null;
};

const PasswordInput = ({ label, value, onChange, placeholder }: any) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 ml-1">{label}</label>
      <div className="relative group">
        <input 
          type={visible ? "text" : "password"}
          required
          className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all font-medium pr-12 outline-none"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button 
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600 transition-colors"
        >
          {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

const LoadingOverlay = ({ loading }: { loading: boolean }) => (
  <AnimatePresence>
    {loading && (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-slate-900/20 backdrop-blur-md flex items-center justify-center"
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white/90 p-8 rounded-[2.5rem] shadow-2xl border border-white/50 flex flex-col items-center gap-4"
        >
          <div className="relative">
            <Loader2 className="w-12 h-12 text-brand-600 animate-spin" />
            <div className="absolute inset-0 bg-brand-500/20 blur-xl rounded-full animate-pulse" />
          </div>
          <p className="text-sm font-bold text-slate-900 tracking-tight">Memproses...</p>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default function App() {
  const [user, setUser] = useState<UserData | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'profile' | 'admin-dash' | 'admin-users' | 'admin-filter'>('home');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [adminToday, setAdminToday] = useState<AttendanceRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(getJakartaDate());

  // Filters
  const [historyFilter, setHistoryFilter] = useState({ start: '', end: '' });
  const [adminFilter, setAdminFilter] = useState({ start: '', end: '', userId: '' });
  const [filteredHistory, setFilteredHistory] = useState<AttendanceRecord[]>([]);
  const [exportDataList, setExportDataList] = useState<any[]>([]);
  
  const webcamRef = useRef<Webcam>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [changePassData, setChangePassData] = useState({ old: '', new: '', confirm: '' });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changePassData.new !== changePassData.confirm) {
      alert("Password baru tidak cocok");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          oldPassword: changePassData.old,
          newPassword: changePassData.new
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Password berhasil diubah");
        setChangePassData({ old: '', new: '', confirm: '' });
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getJakartaDate()), 1000);
    if (user) {
      if (user.role === 'admin') {
        setActiveTab('admin-dash');
        fetchAdminData();
      } else {
        fetchTodayRecords();
        fetchHistory();
      }
    }
    return () => clearInterval(timer);
  }, [user]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [todayRes, usersRes] = await Promise.all([
        fetch('/api/admin/today-activity'),
        fetch('/api/admin/users')
      ]);
      setAdminToday(await todayRes.json());
      setAdminUsers(await usersRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayRecords = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/attendance/today?userId=${user.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTodayRecords(data);
        setError('');
      } else {
        console.error("Expected array for todayRecords, got:", data);
        setTodayRecords([]);
        if (data.error) setError(data.error);
      }
    } catch (err) {
      console.error(err);
      setTodayRecords([]);
      setError('Gagal memuat data hari ini');
    }
  };

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        userId: user.id.toString(),
        startDate: historyFilter.start,
        endDate: historyFilter.end
      });
      const res = await fetch(`/api/attendance/history?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistory(data);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error(err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchExportData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(adminFilter);
      const res = await fetch(`/api/admin/export?${params}`);
      const data = await res.json();
      setExportDataList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Gagal menghubungkan ke server');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    setActiveTab('home');
  };

  const toggleUserStatus = async (userId: number, currentStatus: number) => {
    setLoading(true);
    try {
      await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetUserPassword = async (userId: number) => {
    const newPass = prompt("Masukkan password baru:");
    if (!newPass) return;
    setLoading(true);
    try {
      await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPass })
      });
      alert("Password berhasil direset");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const data = exportDataList.map((r: any) => {
      const dateObj = parseDate(r.timestamp);
      return {
        'Nama': r.display_name,
        'Tanggal': format(dateObj, 'dd-MM-yyyy'),
        'Jam': format(dateObj, 'HH:mm:ss'),
        'Tipe': r.type === 'in' ? 'Clock In' : 'Clock Out',
        'Terlambat': r.is_late ? 'Ya' : 'Tidak',
        'Menit Terlambat': r.late_minutes
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Absensi");
    
    // Generate buffer and download
    XLSX.writeFile(workbook, `Laporan_Absensi_KPU_Kerinci_${format(getJakartaDate(), 'yyyyMMdd')}.xlsx`);
  };

  const handleAttendance = async () => {
    if (!location || !user) {
      alert("Mohon izinkan akses lokasi");
      return;
    }

    const dist = calculateDistance(location.lat, location.lng, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
    if (dist > OFFICE_LOCATION.radius) {
      alert(`Anda berada di luar jangkauan kantor (${Math.round(dist)}m). Maksimal ${OFFICE_LOCATION.radius}m.`);
      return;
    }

    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      alert("Gagal mengambil foto");
      return;
    }

    setLoading(true);
    const schedule = getWorkSchedule(getJakartaDate());
    const type = todayRecords.some(r => r.type === 'in') ? 'out' : 'in';
    
    // Logic: Earliest check-in 06:00
    if (type === 'in') {
      const now = getJakartaDate();
      const earliest = parse('06:00', 'HH:mm', now);
      if (now < earliest) {
        alert("Absen masuk baru tersedia mulai pukul 06:00 WIB.");
        setLoading(false);
        return;
      }
    }

    let isLate = false;
    let lateMinutes = 0;
    let scheduledOutTime = null;
    let alertMessage = "";

    if (type === 'in' && schedule) {
      const now = getJakartaDate();
      const startTime = parse(schedule.start, 'HH:mm', now);
      const lateLimitTime = parse(schedule.lateLimit, 'HH:mm', now);
      const baseOutTime = parse(schedule.end, 'HH:mm', now);
      const shiftDuration = differenceInMinutes(baseOutTime, startTime);
      
      // If check-in is before start time, count from start time. Otherwise count from now.
      const effectiveStartTime = isAfter(now, startTime) ? now : startTime;
      const finalOutTime = addMinutes(effectiveStartTime, shiftDuration);
      
      scheduledOutTime = finalOutTime.toISOString();
      isLate = isAfter(now, lateLimitTime);
      if (isLate) {
        lateMinutes = differenceInMinutes(now, lateLimitTime);
      }

      alertMessage = `Absen Masuk Berhasil. Anda bisa absen pulang jam ${format(finalOutTime, 'HH:mm')} WIB.`;
    }

    try {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type,
          photo: imageSrc,
          latitude: location.lat,
          longitude: location.lng,
          isLate,
          lateMinutes,
          scheduledOutTime,
          timestamp: getJakartaDate().toISOString()
        })
      });
      
      if (alertMessage) alert(alertMessage);
      setIsCameraOpen(false);
      fetchTodayRecords();
      fetchHistory();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        setDistance(calculateDistance(loc.lat, loc.lng, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng));
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm glass p-10 rounded-[3rem] relative z-10"
        >
          <div className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-brand-500/20 p-2"
            >
              <img src="/logo.png" alt="Logo AbsenKita" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </motion.div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1">Absen<span className="text-brand-600">Kita</span></h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">KPU Kabupaten Kerinci</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1 ml-1">Username</label>
              <div className="relative group">
                <input 
                  type="text" 
                  required
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all font-medium outline-none"
                  placeholder="email@kpukerinci"
                  value={loginData.username}
                  onChange={e => setLoginData({...loginData, username: e.target.value})}
                />
              </div>
            </div>
            <PasswordInput 
              label="Password"
              placeholder="••••••••"
              value={loginData.password}
              onChange={(val: string) => setLoginData({...loginData, password: val})}
            />
            {error && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 justify-center text-red-500">
                <AlertCircle className="w-4 h-4" />
                <p className="text-[10px] font-bold uppercase tracking-wider">{error}</p>
              </motion.div>
            )}
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 btn-primary rounded-2xl font-bold flex items-center justify-center gap-3 text-sm tracking-wide"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <span>Login</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
        <LoadingOverlay loading={loading} />
      </div>
    );
  }

  const schedule = getWorkSchedule(currentTime);
  const checkIn = todayRecords.find(r => r.type === 'in');
  const checkOut = todayRecords.find(r => r.type === 'out');

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col max-w-md mx-auto shadow-2xl relative overflow-hidden">
      {/* Header */}
      <header className="p-6 glass sticky top-0 z-30 flex justify-between items-center border-b-0 rounded-b-[2rem]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 shadow-sm border border-slate-100">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">Absen<span className="text-brand-600">Kita</span></h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">{user.display_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn(
              "p-2.5 rounded-2xl transition-all duration-300",
              activeTab === 'profile' ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
            )}
          >
            <User className="w-5 h-5" />
          </button>
          <button onClick={handleLogout} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 pb-28">
        {activeTab === 'home' && (
          <>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 mb-4"
              >
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">{error}</p>
              </motion.div>
            )}

            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="glass-dark text-white p-8 rounded-[3rem] shadow-2xl shadow-slate-900/20 relative overflow-hidden"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3 opacity-60">
                  <Clock className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Current Time</span>
                </div>
                <div className="text-6xl font-extrabold tracking-tighter mb-6 font-mono">{format(currentTime, 'HH:mm:ss')}</div>
                <div className="flex gap-4">
                  <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Clock In Schedule</p>
                    <p className="text-lg font-bold">{schedule?.start || '--:--'}</p>
                  </div>
                  <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Clock Out Schedule</p>
                    <p className="text-lg font-bold">{checkIn?.scheduled_out_time ? format(parseDate(checkIn.scheduled_out_time), 'HH:mm') : schedule?.end || '--:--'}</p>
                  </div>
                </div>
              </div>
              {/* Decorative Gradients */}
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-brand-500/30 rounded-full blur-[60px]" />
              <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/20 rounded-full blur-[60px]" />
            </motion.div>

            <div className="grid grid-cols-2 gap-4">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className={cn(
                  "p-6 rounded-[2.5rem] border transition-all duration-500 card-hover", 
                  checkIn ? "bg-emerald-50/50 border-emerald-100 shadow-lg shadow-emerald-500/5" : "bg-white border-slate-100"
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("w-9 h-9 rounded-2xl flex items-center justify-center transition-colors", checkIn ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-slate-50 text-slate-300")}>
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Clock In</span>
                </div>
                <p className="text-2xl font-extrabold text-slate-900">{checkIn ? format(parseDate(checkIn.timestamp), 'HH:mm') : '--:--'}</p>
                {checkIn?.is_late ? (
                  <div className="flex items-center gap-1 mt-2 text-red-500">
                    <AlertCircle className="w-3 h-3" />
                    <p className="text-[9px] font-bold uppercase">Terlambat {checkIn.late_minutes}m</p>
                  </div>
                ) : checkIn && (
                  <p className="text-[9px] text-emerald-600 font-bold mt-2 uppercase tracking-wide">Tepat Waktu</p>
                )}
                {checkIn?.scheduled_out_time && (
                  <div className="mt-2 pt-2 border-t border-emerald-100/50">
                    <p className="text-[8px] text-brand-600 font-bold uppercase tracking-wider">Bisa pulang jam {format(parseDate(checkIn.scheduled_out_time), 'HH:mm')}</p>
                  </div>
                )}
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                className={cn(
                  "p-6 rounded-[2.5rem] border transition-all duration-500 card-hover", 
                  checkOut ? "bg-brand-50/50 border-brand-100 shadow-lg shadow-brand-500/5" : "bg-white border-slate-100"
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("w-9 h-9 rounded-2xl flex items-center justify-center transition-colors", checkOut ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30" : "bg-slate-50 text-slate-300")}>
                    <LogOut className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Clock Out</span>
                </div>
                <p className="text-2xl font-extrabold text-slate-900">{checkOut ? format(parseDate(checkOut.timestamp), 'HH:mm') : '--:--'}</p>
                {checkOut && <p className="text-[9px] text-brand-600 font-bold mt-2 uppercase tracking-wide">Sudah Absen</p>}
              </motion.div>
            </div>

            <div className="glass p-6 rounded-[2.5rem] flex items-center justify-between card-hover">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center shadow-inner">
                  <MapPin className={cn("w-6 h-6", distance !== null && distance <= OFFICE_LOCATION.radius ? "text-emerald-500" : "text-slate-300")} />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-0.5">Status Lokasi</p>
                  <p className={cn("text-sm font-bold", distance !== null && distance <= OFFICE_LOCATION.radius ? "text-slate-900" : "text-red-500")}>
                    {distance !== null ? (distance <= OFFICE_LOCATION.radius ? "Dalam Jangkauan" : `Luar Jangkauan (${Math.round(distance)}m)`) : "Searching for Location"}
                  </p>
                </div>
              </div>
              <button onClick={requestLocation} className="p-2.5 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {!checkOut && (
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }} 
                onClick={() => { requestLocation(); setIsCameraOpen(true); }} 
                className="w-full py-6 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-[2.5rem] font-bold shadow-xl shadow-brand-500/30 flex items-center justify-center gap-3 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-lg tracking-tight">{checkIn ? "Absen Pulang" : "Absen Masuk"}</span>
              </motion.button>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Riwayat <span className="text-brand-600">Absensi</span></h2>
              <button 
                onClick={() => setShowPassword(!showPassword)} 
                className={cn(
                  "p-2.5 rounded-xl transition-all duration-300",
                  showPassword ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30" : "bg-white text-slate-400 border border-slate-100"
                )}
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>

            <AnimatePresence>
              {showPassword && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="glass p-6 rounded-[2.5rem] space-y-4 overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Mulai Tanggal</label>
                      <input type="date" className="w-full text-sm p-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" value={historyFilter.start} onChange={e => setHistoryFilter({...historyFilter, start: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Sampai Tanggal</label>
                      <input type="date" className="w-full text-sm p-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" value={historyFilter.end} onChange={e => setHistoryFilter({...historyFilter, end: e.target.value})} />
                    </div>
                  </div>
                  <button onClick={fetchHistory} className="w-full py-3 btn-primary rounded-2xl text-xs font-bold uppercase tracking-widest">Terapkan Filter</button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <History className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-slate-400 text-sm font-medium">Belum ada riwayat absensi</p>
                </div>
              ) : history.map((record) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={record.id} 
                  className="glass p-4 rounded-[2rem] flex items-center gap-4 card-hover"
                >
                  <div className="relative">
                    <img src={record.photo} className="w-16 h-16 rounded-2xl object-cover shadow-md" referrerPolicy="no-referrer" />
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm",
                      record.type === 'in' ? "bg-emerald-500" : "bg-brand-500"
                    )}>
                      {record.type === 'in' ? <CheckCircle2 className="w-3 h-3 text-white" /> : <LogOut className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-extrabold text-slate-900 text-sm">{record.type === 'in' ? 'Check In' : 'Check Out'}</p>
                      <p className="text-[10px] text-slate-400 font-mono font-bold">{format(parseDate(record.timestamp), 'dd MMM, HH:mm')}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {record.is_late ? (
                        <span className="text-[9px] px-2.5 py-1 bg-red-50 text-red-600 rounded-full font-bold uppercase tracking-wide border border-red-100">Terlambat {record.late_minutes}m</span>
                      ) : (
                        <span className="text-[9px] px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full font-bold uppercase tracking-wide border border-emerald-100">Tepat Waktu</span>
                      )}
                      {record.type === 'in' && record.scheduled_out_time && (
                        <span className="text-[9px] px-2.5 py-1 bg-brand-50 text-brand-600 rounded-full font-bold uppercase tracking-wide border border-brand-100">
                          Bisa pulang {format(parseDate(record.scheduled_out_time), 'HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'admin-dash' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Aktivitas <span className="text-brand-600">Hari Ini</span></h2>
            <div className="space-y-3">
              {adminToday.length === 0 ? (
                <div className="text-center py-12 glass rounded-[2.5rem]">
                  <p className="text-slate-400 text-sm font-medium">Belum ada aktivitas hari ini</p>
                </div>
              ) : adminToday.map((record) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={record.id} 
                  className="glass p-4 rounded-[2rem] flex items-center gap-4 card-hover"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm", 
                    record.type === 'in' ? "bg-emerald-50 text-emerald-500 border border-emerald-100" : "bg-brand-50 text-brand-500 border border-brand-100"
                  )}>
                    {record.type === 'in' ? <CheckCircle2 className="w-6 h-6" /> : <LogOut className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-extrabold text-slate-900 text-sm">{record.display_name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {record.type === 'in' ? 'Clock In' : 'Clock Out'} • {format(parseDate(record.timestamp), 'HH:mm')}
                      </p>
                      {record.is_late === 1 && <span className="text-[8px] px-2 py-0.5 bg-red-50 text-red-500 rounded-full font-bold uppercase tracking-widest border border-red-100">Terlambat</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'admin-users' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Kelola <span className="text-brand-600">Pegawai</span></h2>
            <div className="space-y-4">
              {adminUsers.map((u) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={u.id} 
                  className="glass p-6 rounded-[2.5rem] space-y-5 card-hover"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                        <User className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-900 text-sm">{u.display_name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em]">{u.role}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => toggleUserStatus(u.id, u.is_active)}
                      className={cn(
                        "px-4 py-2 rounded-2xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 shadow-sm",
                        u.is_active ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
                      )}
                    >
                      {u.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                      {u.is_active ? "Aktif" : "Cuti"}
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => resetUserPassword(u.id)}
                      className="flex-1 py-3 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors border border-slate-100"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset Password
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'admin-filter' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Laporan <span className="text-brand-600">Absensi</span></h2>
            <div className="glass p-8 rounded-[3rem] space-y-6 shadow-xl shadow-slate-200/50">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 ml-1">Dari Tanggal</label>
                  <input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" value={adminFilter.start} onChange={e => setAdminFilter({...adminFilter, start: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 ml-1">Sampai Tanggal</label>
                  <input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all" value={adminFilter.end} onChange={e => setAdminFilter({...adminFilter, end: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 ml-1">Pilih Pegawai</label>
                <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all appearance-none" value={adminFilter.userId} onChange={e => setAdminFilter({...adminFilter, userId: e.target.value})}>
                  <option value="">Semua Pegawai</option>
                  {adminUsers.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                </select>
              </div>
              <button onClick={fetchExportData} className="w-full py-5 btn-primary rounded-2xl font-bold text-sm tracking-wide">Tampilkan Data</button>
            </div>

            <AnimatePresence>
              {exportDataList.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex justify-between items-center px-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{exportDataList.length} Data Ditemukan</p>
                    <button onClick={exportToExcel} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-colors shadow-sm">
                      <Download className="w-4 h-4" /> Export Excel
                    </button>
                  </div>
                  <div className="space-y-3">
                    {exportDataList.slice(0, 10).map((r, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={i} 
                        className="glass p-4 rounded-[2rem] text-[11px] flex justify-between items-center card-hover"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                            <User className="w-5 h-5 text-slate-300" />
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900">{r.display_name}</p>
                            <p className="text-slate-400 font-medium">
                              {format(parseDate(r.timestamp), 'dd MMM yyyy')} • {format(parseDate(r.timestamp), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                        <span className={cn(
                          "px-3 py-1 rounded-full font-bold uppercase tracking-widest text-[8px] border", 
                          r.type === 'in' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-brand-50 text-brand-600 border-brand-100"
                        )}>
                          {r.type === 'in' ? 'Clock In' : 'Clock Out'}
                        </span>
                      </motion.div>
                    ))}
                    {exportDataList.length > 10 && (
                      <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest py-4">...dan {exportDataList.length - 10} data lainnya</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Profil <span className="text-brand-600">Saya</span></h2>
            <div className="glass p-8 rounded-[3rem] space-y-8 shadow-xl shadow-slate-200/50">
              <div className="flex items-center gap-6 pb-8 border-b border-slate-100/50">
                <div className="relative">
                  <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/30">
                    <User className="w-10 h-10 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white shadow-sm" />
                </div>
                <div>
                  <p className="font-extrabold text-xl text-slate-900 leading-tight">{user.display_name}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] mt-1">{user.role}</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                    <KeyRound className="w-4 h-4 text-brand-600" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Ganti Password</h3>
                </div>
                <div className="space-y-4">
                  <PasswordInput label="Password Lama" value={changePassData.old} onChange={(v: string) => setChangePassData({...changePassData, old: v})} placeholder="Masukkan password lama" />
                  <PasswordInput label="Password Baru" value={changePassData.new} onChange={(v: string) => setChangePassData({...changePassData, new: v})} placeholder="Masukkan password baru" />
                  <PasswordInput label="Konfirmasi Password Baru" value={changePassData.confirm} onChange={(v: string) => setChangePassData({...changePassData, confirm: v})} placeholder="Ulangi password baru" />
                </div>
                <button type="submit" className="w-full py-5 btn-primary rounded-[2rem] font-bold text-sm tracking-wide shadow-xl shadow-brand-500/20">Simpan Password Baru</button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto glass rounded-t-[2.5rem] px-8 py-5 flex justify-around items-center z-40 shadow-[0_-8px_32px_rgba(0,0,0,0.05)]">
        {user.role === 'admin' ? (
          <>
            <button onClick={() => setActiveTab('admin-dash')} className={cn("flex flex-col items-center gap-1.5 transition-all duration-300", activeTab === 'admin-dash' ? "text-brand-600 scale-110" : "text-slate-400 hover:text-slate-600")}>
              <div className={cn("p-2 rounded-xl transition-colors", activeTab === 'admin-dash' ? "bg-brand-50" : "bg-transparent")}>
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <span className="text-[8px] font-bold uppercase tracking-[0.15em]">Dashboard</span>
            </button>
            <button onClick={() => setActiveTab('admin-filter')} className={cn("flex flex-col items-center gap-1.5 transition-all duration-300", activeTab === 'admin-filter' ? "text-brand-600 scale-110" : "text-slate-400 hover:text-slate-600")}>
              <div className={cn("p-2 rounded-xl transition-colors", activeTab === 'admin-filter' ? "bg-brand-50" : "bg-transparent")}>
                <Filter className="w-6 h-6" />
              </div>
              <span className="text-[8px] font-bold uppercase tracking-[0.15em]">Laporan</span>
            </button>
            <button onClick={() => setActiveTab('admin-users')} className={cn("flex flex-col items-center gap-1.5 transition-all duration-300", activeTab === 'admin-users' ? "text-brand-600 scale-110" : "text-slate-400 hover:text-slate-600")}>
              <div className={cn("p-2 rounded-xl transition-colors", activeTab === 'admin-users' ? "bg-brand-50" : "bg-transparent")}>
                <Users className="w-6 h-6" />
              </div>
              <span className="text-[8px] font-bold uppercase tracking-[0.15em]">Pegawai</span>
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setActiveTab('home')} className={cn("flex flex-col items-center gap-1.5 transition-all duration-300", activeTab === 'home' ? "text-brand-600 scale-110" : "text-slate-400 hover:text-slate-600")}>
              <div className={cn("p-2 rounded-xl transition-colors", activeTab === 'home' ? "bg-brand-50" : "bg-transparent")}>
                <CalendarIcon className="w-6 h-6" />
              </div>
              <span className="text-[8px] font-bold uppercase tracking-[0.15em]">Absen</span>
            </button>
            <button onClick={() => setActiveTab('history')} className={cn("flex flex-col items-center gap-1.5 transition-all duration-300", activeTab === 'history' ? "text-brand-600 scale-110" : "text-slate-400 hover:text-slate-600")}>
              <div className={cn("p-2 rounded-xl transition-colors", activeTab === 'history' ? "bg-brand-50" : "bg-transparent")}>
                <History className="w-6 h-6" />
              </div>
              <span className="text-[8px] font-bold uppercase tracking-[0.15em]">Riwayat</span>
            </button>
          </>
        )}
      </nav>

      <LoadingOverlay loading={loading} />

      {/* Camera Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 bg-slate-950 flex flex-col max-w-md mx-auto"
          >
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
              <Webcam 
                audio={false} 
                ref={webcamRef} 
                screenshotFormat="image/jpeg" 
                videoConstraints={{ facingMode: "user" }} 
                className="w-full h-full object-cover" 
                mirrored={true} 
                screenshotQuality={0.7} 
                disablePictureInPicture={true}
                forceScreenshotSourceSize={false}
                imageSmoothing={true}
                onUserMedia={() => {}}
                onUserMediaError={() => {}}
              />
              {/* Face Frame Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-96 border-2 border-white/30 rounded-[4rem] relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-500 text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Posisikan Wajah</div>
                  {/* Corner Accents */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-500 rounded-tl-3xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-500 rounded-tr-3xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-500 rounded-bl-3xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-500 rounded-br-3xl" />
                </div>
              </div>
            </div>
            <div className="p-10 glass-dark flex flex-col items-center gap-8 rounded-t-[3rem] -mt-12 relative z-10">
              <div className="text-center">
                <p className="text-white font-extrabold text-xl mb-1 tracking-tight">Verifikasi Wajah</p>
                <p className="text-slate-400 text-xs font-medium">Pastikan pencahayaan cukup dan wajah terlihat jelas</p>
              </div>
              <div className="flex items-center gap-10">
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsCameraOpen(false)} 
                  className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-white border border-slate-700 hover:bg-slate-700 transition-colors"
                >
                  <AlertCircle className="w-6 h-6" />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={loading} 
                  onClick={handleAttendance} 
                  className="w-24 h-24 rounded-full bg-white p-1 shadow-[0_0_40px_rgba(255,255,255,0.3)] disabled:opacity-50"
                >
                  <div className="w-full h-full rounded-full border-[6px] border-slate-900 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-brand-600 animate-pulse" />
                  </div>
                </motion.button>
                <div className="w-14 h-14" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
