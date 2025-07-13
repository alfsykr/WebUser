"use client"

import { useState, useEffect, useRef, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { registerMember, loginMember, type Member, updateMember, getMemberTransactions, updateMemberPassword, getMemberLoans } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import Swal from 'sweetalert2'
import { CheckCircle, XCircle, X, Calendar, Book } from 'lucide-react';

function formatDate(dateString: string) {
  const date = new Date(dateString);
  // Always use UTC to avoid timezone issues
  return `${date.getUTCDate().toString().padStart(2, "0")}-${(date.getUTCMonth()+1).toString().padStart(2, "0")}-${date.getUTCFullYear()}`;
}

// Komponen ScrollReveal
type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  threshold?: number;
};
function ScrollReveal({ children, className = "", threshold = 0.2 }: ScrollRevealProps) {
  const ref = useRef(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true)
          observer.disconnect()
        }
      },
      { threshold }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold])
  return (
    <div
      ref={ref}
      className={
        `${className} transition-all duration-700 ease-out ${show ? "opacity-100 translate-y-0 animate-fade-in-up" : "opacity-0 translate-y-8"}`
      }
    >
      {children}
    </div>
  )
}

// Komponen LibraryAlert untuk menampilkan informasi peminjaman
function LibraryAlert({ onClose, userId }: { onClose: () => void; userId: string }) {
  const [loanData, setLoanData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const loans = await getMemberLoans(userId);
        setLoanData(loans);
      } catch (error) {
        console.error("Error fetching loans:", error);
        setLoanData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLoans();
  }, [userId]);

  // Fungsi untuk menghitung selisih hari
  const getDaysDifference = (date1: string, date2: string) => {
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDate = new Date(date1);
    const secondDate = new Date(date2);
    return Math.round((secondDate.getTime() - firstDate.getTime()) / oneDay);
  };

  // Pisahkan buku terlambat dan yang akan jatuh tempo
  const currentDate = new Date().toISOString().split('T')[0];
  const sevenDaysThreshold = 7;
  let overdueLoans: any[] = [];
  let upcomingLoans: any[] = [];

  loanData.forEach(loan => {
    const daysDiff = getDaysDifference(currentDate, loan.dueDate);
    if (daysDiff < 0) {
      overdueLoans.push({ ...loan, daysOverdue: Math.abs(daysDiff) });
    } else if (daysDiff <= sevenDaysThreshold) {
      upcomingLoans.push({ ...loan, daysLeft: daysDiff });
    }
  });

  // Tentukan prioritas alert: merah jika ada terlambat, hijau jika ada yang akan jatuh tempo
  let alertType: 'error' | 'success' | null = null;
  let alertData: any[] = [];
  let totalBooks = 0;
  let alertTitle = '';
  let alertMessage = '';
  let alertDetail = '';

  if (overdueLoans.length > 0) {
    alertType = 'error';
    alertData = overdueLoans;
    totalBooks = overdueLoans.length;
    alertTitle = 'BUKU TERLAMBAT!';
    if (totalBooks === 1) {
      const book = overdueLoans[0];
      alertMessage = `Buku "${book.bookTitle}" sudah terlambat ${book.daysOverdue} hari dari jadwal pengembalian. Harap segera mengembalikan ke perpustakaan untuk menghindari denda.`;
      alertDetail = `Jatuh tempo: ${book.dueDate}`;
    } else {
      const totalDays = Math.max(...overdueLoans.map((book: any) => book.daysOverdue));
      alertMessage = `Anda memiliki ${totalBooks} buku yang terlambat dikembalikan. Beberapa sudah terlambat hingga ${totalDays} hari. Harap segera mengembalikan semua buku untuk menghindari denda.`;
      alertDetail = `${totalBooks} buku perlu dikembalikan segera`;
    }
  } else if (upcomingLoans.length > 0) {
    alertType = 'success';
    alertData = upcomingLoans;
    totalBooks = upcomingLoans.length;
    alertTitle = 'PENGINGAT PENGEMBALIAN';
    if (totalBooks === 1) {
      const book = upcomingLoans[0];
      const daysText = book.daysLeft === 0 ? 'hari ini' : `${book.daysLeft} hari lagi`;
      alertMessage = `Buku "${book.bookTitle}" akan jatuh tempo ${daysText}. Jangan lupa untuk mengembalikan tepat waktu agar tidak terkena denda.`;
      alertDetail = `Jatuh tempo: ${book.dueDate}`;
    } else {
      const minDays = Math.min(...upcomingLoans.map((book: any) => book.daysLeft));
      const daysText = minDays === 0 ? 'hari ini' : `${minDays} hari lagi`;
      alertMessage = `Anda memiliki ${totalBooks} buku yang akan jatuh tempo dalam waktu dekat. Yang paling cepat ${daysText}. Pastikan untuk mengembalikan semua buku tepat waktu.`;
      alertDetail = `${totalBooks} buku perlu dikembalikan segera`;
    }
  }

  // Jika loading, tampilkan loading
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data peminjaman...</p>
        </div>
      </div>
    );
  }

  // Jika tidak ada alert, tidak tampilkan apa-apa
  if (!alertType) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header dengan Icon */}
        <div className={`p-6 text-center ${
          alertType === 'success' ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          {/* Icon */}
          <div className="mb-4">
            {alertType === 'success' ? (
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            )}
          </div>
          {/* Title */}
          <h2 className={`text-xl font-bold mb-2 ${
            alertType === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>{alertType === 'success' ? 'PENGINGAT' : 'PERINGATAN'}</h2>
          <h3 className={`text-lg font-semibold ${
            alertType === 'success' ? 'text-green-700' : 'text-red-700'
          }`}>{alertTitle}</h3>
        </div>
        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 text-center mb-4 leading-relaxed">
            {alertMessage}
          </p>
          {/* Badge jumlah buku */}
          <div className={`p-3 rounded-lg mb-6 flex items-center justify-center gap-2 font-medium text-sm ${
            alertType === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <Calendar className={`w-4 h-4 ${alertType === 'success' ? 'text-green-600' : 'text-red-600'}`} />
            {alertDetail}
          </div>
          {/* List buku */}
          {alertData.length > 0 && (
            <div className="mb-6">
              <div className="space-y-2">
                {alertData.slice(0, 3).map((book, index) => (
                  <div key={book.id || index} className="flex items-center p-2 bg-gray-50 rounded-lg">
                    <Book className="w-4 h-4 text-gray-500 mr-2" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {book.bookTitle}
                      </p>
                      <p className="text-xs text-gray-500">
                        {alertType === 'success' 
                          ? `${book.daysLeft === 0 ? 'Jatuh tempo hari ini' : `${book.daysLeft} hari lagi`}`
                          : `Terlambat ${book.daysOverdue} hari`
                        }
                      </p>
                    </div>
                  </div>
                ))}
                {alertData.length > 3 && (
                  <p className="text-xs text-gray-500 text-center">
                    dan {alertData.length - 3} buku lainnya...
                  </p>
                )}
              </div>
            </div>
          )}
          {/* Action Button */}
          <button
            onClick={onClose}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
              alertType === 'success' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {alertType === 'success' ? 'Mengerti' : 'Akan Segera Dikembalikan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [currentView, setCurrentView] = useState<"home" | "login" | "register" | "dashboard">("home")
  const [user, setUser] = useState<Member | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast();
  const [showLibraryAlert, setShowLibraryAlert] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    const result = await loginMember(email, password);
    setLoading(false);

    if (result.success) {
      setUser(result.member);
      setCurrentView("dashboard");
      Swal.fire({
        icon: 'success',
        title: 'Login Berhasil',
        text: 'Selamat datang di e-PERPUS.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'rounded-xl' }
      }).then(() => {
        // Tampilkan library alert setelah user klik OK pada pop up login
        setShowLibraryAlert(true);
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Login Gagal',
        text: result.error || 'Email atau password salah.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'rounded-xl' }
      });
    }
  }

  const handleRegister = async (data: any) => {
    setLoading(true)
    const result = await registerMember({
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone,
      address: data.address,
      type: data.type,
    })
    setLoading(false)

    if (result.success) {
      // Auto login after registration
      const loginResult = await loginMember(data.email, data.password)
      if (loginResult.success) {
        Swal.fire({
          icon: 'success',
          title: 'Akun Berhasil Dibuat',
          text: 'Selamat, akun Anda berhasil terdaftar!',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'rounded-xl' }
        });
        setUser(loginResult.member)
        setCurrentView("dashboard")
      }
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Mendaftar',
        text: result.error || 'Terjadi kesalahan saat mendaftar.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'rounded-xl' }
      });
    }
  }

  const handleLogout = () => {
    setUser(null)
    setCurrentView("home")
    Swal.fire({
      icon: 'success',
      title: 'Berhasil Keluar',
      text: 'Anda telah berhasil logout.',
      confirmButtonColor: '#6366f1',
      customClass: { popup: 'rounded-xl' }
    });
  }

  if (currentView === "login") {
    return (
      <LoginPage
        onLogin={handleLogin}
        onBack={() => setCurrentView("home")}
        onRegister={() => setCurrentView("register")}
        loading={loading}
      />
    )
  }

  if (currentView === "register") {
    return (
      <RegisterPage
        onRegister={handleRegister}
        onBack={() => setCurrentView("home")}
        onLogin={() => setCurrentView("login")}
        loading={loading}
      />
    )
  }

  if (currentView === "dashboard" && user) {
    return <DashboardPage user={user} onLogout={handleLogout} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-600 flex flex-col">
      {/* Header */}
      <header className="p-4">
        <nav className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-purple-600 font-bold text-sm">📚</span>
            </div>
            <span className="text-white font-bold text-xl">e-PERPUS</span>
          </div>
          <div className="flex items-center gap-6">
            <button className="text-white hover:text-purple-200 transition-colors" onClick={() => setCurrentView("home")}>Beranda</button>
            <button
              onClick={() => setCurrentView("login")}
              className="text-white hover:text-purple-200 transition-colors"
            >
              Login
            </button>
            <button
              onClick={() => setCurrentView("register")}
              className="text-white hover:text-purple-200 transition-colors"
            >
              Register
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="px-4 py-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Content */}
          <div className="text-white space-y-8">
            {/* Main Title */}
            <ScrollReveal>
              <div className="space-y-4">
                <h1 className="text-5xl font-bold">e-PERPUS</h1>
                <p className="text-lg leading-relaxed opacity-90">
                  e-PERPUS merupakan aplikasi Perpustakaan bagi mahasiswa.
                </p>
              </div>
            </ScrollReveal>

            {/* Action Buttons */}
            <ScrollReveal>
              <div className="flex gap-4">
                <Button
                  onClick={() => setCurrentView("login")}
                  variant="secondary"
                  className="bg-white text-purple-600 hover:bg-gray-100"
                >
                  Login
                </Button>
                <Button
                  onClick={() => setCurrentView("register")}
                  className="bg-indigo-700 hover:bg-indigo-800 text-white"
                >
                  Register
                </Button>
              </div>
            </ScrollReveal>
          </div>

          {/* Right Side - Library Image */}
          <ScrollReveal>
            <div className="flex justify-center items-center h-[350px] w-full">
              <div className="w-full h-full max-w-lg">
                <img
                  src="/images/library-large.png"
                  alt="Perpustakaan dengan tumpukan buku dan rak buku"
                  className="w-full h-full object-cover rounded-2xl shadow-lg"
                  style={{ display: 'block' }}
                />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 bg-black bg-opacity-20">
        <div className="max-w-7xl mx-auto px-4 text-center text-white text-sm">
          <span>© 2025 Universitas Negeri Jakarta | Nawanda Husna</span>
        </div>
      </footer>
      <Toaster />
      {/* Hapus render LibraryAlert dari HomePage, cukup render di DashboardPage */}
    </div>
  )
}

function LoginPage({
  onLogin,
  onBack,
  onRegister,
  loading,
}: {
  onLogin: (email: string, password: string) => void
  onBack: () => void
  onRegister: () => void
  loading: boolean
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onLogin(email, password)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-600">
      {/* Header */}
      <header className="p-4">
        <nav className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-purple-600 font-bold text-sm">📚</span>
            </div>
            <span className="text-white font-bold text-xl">e-PERPUS</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={onBack} className="text-white hover:text-purple-200 transition-colors">
              Beranda
            </button>
            <button className="text-white hover:text-purple-200 transition-colors font-medium">Login</button>
            <button onClick={onRegister} className="text-white hover:text-purple-200 transition-colors">
              Daftar
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="text-center space-y-8">
          <ScrollReveal>
            <div className="text-white space-y-4">
              <h1 className="text-4xl font-bold">FORM LOGIN</h1>
              <p className="text-lg opacity-90">
                Silahkan login dengan akun
                <br />
                username dan password yang sudah terdaftar.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <Card className="bg-white p-8 max-w-md mx-auto">
              <CardContent className="p-0">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="text-center mb-6">
                    <p className="text-gray-500">Sign in with credentials</p>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                          />
                        </svg>
                      </div>
                      <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      </div>
                      <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg"
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal>
            <div className="flex justify-between text-white text-sm max-w-md mx-auto">
              <button className="hover:text-purple-200 transition-colors">Lupa password?</button>
              <button onClick={onRegister} className="hover:text-purple-200 transition-colors">
                Buat akun
              </button>
            </div>
          </ScrollReveal>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 bg-indigo-900">
        <div className="max-w-7xl mx-auto px-4 text-center text-white text-sm">
          <span>© 2025 Universitas Negeri Jakarta | Nawanda Husna</span>
        </div>
      </footer>
    </div>
  )
}

function RegisterPage({
  onRegister,
  onBack,
  onLogin,
  loading,
}: {
  onRegister: (data: any) => void
  onBack: () => void
  onLogin: () => void
  loading: boolean
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
    type: "Mahasiswa",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      alert("Password tidak cocok!")
      return
    }
    onRegister(formData)
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-600">
      {/* Header */}
      <header className="p-4">
        <nav className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-purple-600 font-bold text-sm">📚</span>
            </div>
            <span className="text-white font-bold text-xl">e-PERPUS</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={onBack} className="text-white hover:text-purple-200 transition-colors">
              Beranda
            </button>
            <button onClick={onLogin} className="text-white hover:text-purple-200 transition-colors">
              Login
            </button>
            <button className="text-white hover:text-purple-200 transition-colors font-medium">Daftar</button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="text-center space-y-8">
          <ScrollReveal>
            <div className="text-white space-y-4">
              <h1 className="text-4xl font-bold">Registrasi Akun</h1>
              <p className="text-lg opacity-90">
                Lengkapi form registrasi berikut untuk mendapatkan
                <br />
                akun.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <Card className="bg-white p-8 max-w-md mx-auto">
              <CardContent className="p-0">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="text-center mb-6">
                    <p className="text-gray-500">Sign up with credentials</p>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Nama Lengkap"
                        value={formData.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                          />
                        </svg>
                      </div>
                      <input
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                      </div>
                      <input
                        type="tel"
                        placeholder="No. Telepon"
                        value={formData.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                          />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Alamat"
                        value={formData.address}
                        onChange={(e) => handleChange("address", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </div>
                      <select
                        value={formData.type}
                        onChange={(e) => handleChange("type", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        disabled={loading}
                      >
                        <option value="Mahasiswa">Mahasiswa</option>
                        <option value="Dosen">Dosen</option>
                        <option value="Staff">Staff</option>
                        <option value="Umum">Umum</option>
                      </select>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      </div>
                      <input
                        type="password"
                        placeholder="Password"
                        value={formData.password}
                        onChange={(e) => handleChange("password", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      </div>
                      <input
                        type="password"
                        placeholder="Konfirmasi Password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleChange("confirmPassword", e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="terms" className="rounded" required disabled={loading} />
                    <label htmlFor="terms" className="text-sm text-gray-500">
                      Data diatas sudah benar
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg"
                    disabled={loading}
                  >
                    {loading ? "Creating Account..." : "Buat Akun"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal>
            <div className="flex justify-between text-white text-sm max-w-md mx-auto">
              <button onClick={onLogin} className="hover:text-purple-200 transition-colors">
                sudah ada akun?
              </button>
              <button onClick={onBack} className="hover:text-purple-200 transition-colors">
                Beranda
              </button>
            </div>
          </ScrollReveal>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 bg-indigo-900">
        <div className="max-w-7xl mx-auto px-4 text-center text-white text-sm">
          <span>© 2025 Universitas Negeri Jakarta | Nawanda Husna</span>
        </div>
      </footer>
    </div>
  )
}

function DashboardPage({ user, onLogout }: { user: Member; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<"profil" | "riwayat" | "password">("profil")
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({
    phone: user.phone,
    address: user.address,
    type: user.type,
  })
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [userState, setUserState] = useState(user)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loadingTx, setLoadingTx] = useState(false)
  const [showLibraryAlert, setShowLibraryAlert] = useState(true);

  useEffect(() => {
    if (activeTab === "riwayat") {
      setLoadingTx(true)
      getMemberTransactions(userState.id!).then((data) => {
        setTransactions(data)
        setLoadingTx(false)
      })
    }
  }, [activeTab, userState.id])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Mengubah Password',
        text: 'Password baru tidak cocok!',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'rounded-xl' }
      });
      return;
    }
    const result = await updateMemberPassword(userState.id!, passwordData.oldPassword, passwordData.newPassword);
    if (result.success) {
      Swal.fire({
        icon: 'success',
        title: 'Password Berhasil Diubah',
        text: 'Password Anda telah berhasil diubah.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'rounded-xl' }
      });
      setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Mengubah Password',
        text: result.error || 'Password lama salah atau terjadi kesalahan.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'rounded-xl' }
      });
    }
  }

  const handleEditChange = (field: string, value: string) => {
    setEditData((prev) => ({ ...prev, [field]: value }))
  }

  const handleEditSave = async () => {
    setLoadingEdit(true)
    const result = await updateMember(userState.id!, {
      phone: editData.phone,
      address: editData.address,
      type: editData.type,
    })
    setLoadingEdit(false)
    if (result.success) {
      setUserState((prev) => ({ ...prev, ...editData }))
      setEditMode(false)
      alert("Data berhasil diupdate!")
    } else {
      alert(result.error || "Gagal update data")
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div
        className={`${sidebarCollapsed ? "w-24" : "w-64"} bg-white shadow-lg flex flex-col transition-all duration-300`}
      >
        <div className="p-6 flex-1">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">📚</span>
            </div>
            {!sidebarCollapsed && <span className="text-gray-800 font-bold text-xl">E-PERPUS</span>}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="ml-auto p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab("profil")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "profil" ? "bg-purple-600 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
              title={sidebarCollapsed ? "Profil" : ""}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              {!sidebarCollapsed && "Profil"}
            </button>

            <button
              onClick={() => setActiveTab("riwayat")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "riwayat" ? "bg-purple-600 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
              title={sidebarCollapsed ? "Riwayat" : ""}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {!sidebarCollapsed && "Riwayat"}
            </button>

            <button
              onClick={() => setActiveTab("password")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "password" ? "bg-purple-600 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
              title={sidebarCollapsed ? "Ganti Password" : ""}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              {!sidebarCollapsed && "Ganti Password"}
            </button>
          </nav>
        </div>
        <div className="mt-auto p-4">
          <Button
            onClick={onLogout}
            className={`w-full bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 ${
              sidebarCollapsed ? "px-2" : ""
            }`}
            title={sidebarCollapsed ? "Logout" : ""}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {!sidebarCollapsed && "Logout"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gradient-to-r from-pink-500 to-orange-400 text-white p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">E-PERPUS</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">👤</span>
                </div>
                <span className="font-medium">{userState.name}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            {showLibraryAlert && (
              <LibraryAlert onClose={() => setShowLibraryAlert(false)} userId={user.id!} />
            )}
            <ScrollReveal key={activeTab}>
              <Card className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Card Header */}
                <div className="h-32 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400"></div>

                {/* Card Content */}
                <div className="p-8">
                  <h2 className="text-3xl font-bold text-purple-600 mb-8 text-center">
                    {activeTab === "profil" && "Dashboard Anggota"}
                    {activeTab === "riwayat" && "Riwayat Peminjaman"}
                    {activeTab === "password" && "Ganti Password"}
                  </h2>

                  {/* Tab Content */}
                  {activeTab === "profil" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-gray-700 mb-2">
                            <span className="font-medium">Selamat datang, </span>
                            <span className="text-purple-600 font-bold">{userState.name}</span>
                          </p>
                          <p className="text-gray-700 mb-2">
                            <span className="font-medium">Email: </span>
                            {userState.email}
                          </p>
                          <p className="text-gray-700 mb-2">
                            <span className="font-medium">UID: </span>
                            {userState.uid}
                          </p>
                          <p className="text-gray-700 mb-2">
                            <span className="font-medium">No. Telepon: </span>
                            {editMode ? (
                              <input
                                type="text"
                                value={editData.phone}
                                onChange={e => handleEditChange("phone", e.target.value)}
                                className="border px-2 py-1 rounded w-full max-w-xs"
                                disabled={loadingEdit}
                              />
                            ) : (
                              userState.phone
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-700 mb-2">
                            <span className="font-medium">Alamat: </span>
                            {editMode ? (
                              <input
                                type="text"
                                value={editData.address}
                                onChange={e => handleEditChange("address", e.target.value)}
                                className="border px-2 py-1 rounded w-full max-w-xs"
                                disabled={loadingEdit}
                              />
                            ) : (
                              userState.address
                            )}
                          </p>
                          <p className="text-gray-700 mb-2">
                            <span className="font-medium">Status: </span>
                            <span className="text-green-600 font-medium">{userState.status}</span>
                          </p>
                          <p className="text-gray-700 mb-2">
                            <span className="font-medium">Tipe: </span>
                            {editMode ? (
                              <select
                                value={editData.type}
                                onChange={e => handleEditChange("type", e.target.value)}
                                className="border px-2 py-1 rounded w-full max-w-xs"
                                disabled={loadingEdit}
                              >
                                <option value="Mahasiswa">Mahasiswa</option>
                                <option value="Dosen">Dosen</option>
                                <option value="Staff">Staff</option>
                                <option value="Umum">Umum</option>
                              </select>
                            ) : (
                              userState.type
                            )}
                          </p>
                          <p className="text-gray-700 mb-2">
                            <span className="font-medium">Bergabung: </span>
                            {formatDate(userState.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        {editMode ? (
                          <>
                            <Button onClick={handleEditSave} disabled={loadingEdit} className="bg-green-600 hover:bg-green-700 text-white">
                              {loadingEdit ? "Menyimpan..." : "Simpan"}
                            </Button>
                            <Button onClick={() => { setEditMode(false); setEditData({ phone: userState.phone, address: userState.address, type: userState.type }) }} disabled={loadingEdit} className="bg-gray-400 hover:bg-gray-500 text-white">
                              Batal
                            </Button>
                          </>
                        ) : (
                          <Button onClick={() => setEditMode(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "riwayat" && (
                    <div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b-2 border-gray-200">
                              <th className="text-left py-3 px-4 text-purple-600 font-semibold">Judul Buku</th>
                              <th className="text-left py-3 px-4 text-purple-600 font-semibold">Tanggal Pinjam</th>
                              <th className="text-left py-3 px-4 text-purple-600 font-semibold">Status</th>
                              <th className="text-left py-3 px-4 text-purple-600 font-semibold">Jatuh Tempo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loadingTx ? (
                              <tr><td colSpan={4} className="text-center py-12 text-gray-500">Memuat...</td></tr>
                            ) : transactions.length === 0 ? (
                              <tr><td colSpan={4} className="text-center py-12 text-gray-500">Tidak ada riwayat peminjaman</td></tr>
                            ) : (
                              transactions.map((tx, idx) => (
                                <tr key={idx} className="border-b border-gray-100">
                                  <td className="py-3 px-4">{tx.bookTitle}</td>
                                  <td className="py-3 px-4">{tx.borrowDate}</td>
                                  <td className="py-3 px-4 capitalize">{tx.status}</td>
                                  <td className="py-3 px-4">{tx.dueDate}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === "password" && (
                    <div className="flex justify-center">
                      <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md w-full">
                        <input
                          type="password"
                          placeholder="Password Lama"
                          value={passwordData.oldPassword}
                          onChange={(e) => setPasswordData((prev) => ({ ...prev, oldPassword: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          required
                        />
                        <input
                          type="password"
                          placeholder="Password Baru"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          required
                        />
                        <input
                          type="password"
                          placeholder="Konfirmasi Password Baru"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          required
                        />
                        <Button
                          type="submit"
                          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white py-3 rounded-lg"
                        >
                          Ubah Password
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              </Card>
            </ScrollReveal>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-gray-200 py-4">
          <div className="max-w-7xl mx-auto px-6 text-center text-gray-600 text-sm">
            <span>© 2025 Universitas Negeri Jakarta | Nawanda Husna</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
