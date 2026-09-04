"use client";

import React, { useState, useEffect } from "react";
import { 
  UploadCloud, Video, FileText, Sparkles, 
  Loader2, Crown, Settings, LogOut, Download, 
  Clock, AlertTriangle, X, CheckCircle2, XCircle, RotateCcw
} from "lucide-react";
import confetti from "canvas-confetti";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";
import { supabase } from "../lib/supabase";

// 🔴 YAHAN APNI ORIGINAL UPI ID LIKHEIN (Jaise: 9876543210@ybl ya suhani@oksbi)
const MY_ACTUAL_UPI_ID = "your-upi@oksbi"; 

interface Flashcard {
  category?: string;
  front: string;
  back: string;
}

interface QuizItem {
  question: string;
  options: string[];
  correct_index?: number;
  correct_answer?: string;
  explanation?: string;
}

interface StudyData {
  title?: string;
  summary?: string;
  key_takeaways?: string[];
  notes_markdown?: string;
  flashcards?: Flashcard[];
  quiz?: QuizItem[];
}

export default function LectureApp() {
  const [activeTab, setActiveTab] = useState<"notes" | "flashcards" | "quiz">("notes");
  const [loading, setLoading] = useState<boolean>(false);
  const [studyData, setStudyData] = useState<StudyData | null>(null);
  const [error, setError] = useState<string>("");

  // Input states
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");

  // Auth & Profile
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>({
    is_premium: false,
    daily_syntheses_count: 0,
    plan_type: "none",
    premium_expiry: null
  });

  // Quiz interactive state
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [showExplanations, setShowExplanations] = useState<{ [key: number]: boolean }>({});

  // Flashcard flip state
  const [flippedCards, setFlippedCards] = useState<{ [key: number]: boolean }>({});

  // Modals & Panels
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [settingsActiveView, setSettingsActiveView] = useState<"profile" | "history" | "about" | "help">("profile");
  const [showPricingModal, setShowPricingModal] = useState<boolean>(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");
  const [utrNumber, setUtrNumber] = useState<string>("");
  const [paymentSubmitted, setPaymentSubmitted] = useState<boolean>(false);
  const [userHistory, setUserHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await syncUserProfile(session.user);
      }
    };
    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        setUser(session.user);
        await syncUserProfile(session.user);
      } else {
        setUser(null);
        setProfile({ is_premium: false, daily_syntheses_count: 0, plan_type: "none" });
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const syncUserProfile = async (currentUser: any) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (data) {
      setProfile(data);
      const { data: hist } = await supabase
        .from("history")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });
      if (hist) setUserHistory(hist);
    }
  };

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setShowSettingsMenu(false);
  };

  const verifyLimitAndProceed = (): boolean => {
    if (profile.is_premium) return true;
    if (profile.daily_syntheses_count >= 3) {
      setError("24 ghante ki limit (3 syntheses) poori ho chuki hai. Unlimited access ke liye Pro lein!");
      setShowPricingModal(true);
      return false;
    }
    return true;
  };

  const incrementDailyUsage = async () => {
    if (profile.is_premium || !user) return;
    const newCount = profile.daily_syntheses_count + 1;
    setProfile((prev: any) => ({ ...prev, daily_syntheses_count: newCount }));
    await supabase.from("profiles").update({ daily_syntheses_count: newCount }).eq("id", user.id);
  };

  const saveToHistory = async (deck: StudyData) => {
    if (!user) return;
    await supabase.from("history").insert({
      user_id: user.id,
      title: deck.title || "Untitled",
      content: deck
    });
  };

  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file || !verifyLimitAndProceed()) return;

    setLoading(true);
    setError("");
    setStudyData(null);
    setSelectedAnswers({});
    setShowExplanations({});
    setFlippedCards({});

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("https://lecture-ai-7fqi.onrender.com/api/process-file", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Processing failed");
      const result = await res.json();
      setStudyData(result.data);
      await incrementDailyUsage();
      await saveToHistory(result.data);
      confetti({ particleCount: 60, spread: 60 });
    } catch (err: any) {
      setError(err?.message || "Failed to process document");
    } finally {
      setLoading(false);
    }
  };

  const handleYoutubeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!youtubeUrl || !verifyLimitAndProceed()) return;

    setLoading(true);
    setError("");
    setStudyData(null);
    setSelectedAnswers({});
    setShowExplanations({});
    setFlippedCards({});

    try {
      const res = await fetch("https://lecture-ai-7fqi.onrender.com/api/process-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl }),
      });
      if (!res.ok) throw new Error("Processing failed");
      const result = await res.json();
      setStudyData(result.data);
      await incrementDailyUsage();
      await saveToHistory(result.data);
      confetti({ particleCount: 60, spread: 60 });
    } catch (err: any) {
      setError(err?.message || "Failed to process link");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!profile.is_premium) {
      setShowPricingModal(true);
      return;
    }
    if (!studyData) return;
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(studyData.title || "Untitled", 14, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const splitSummary = doc.splitTextToSize(studyData.summary || "", 180);
    doc.text(splitSummary, 14, 30);
    doc.save(`${(studyData.title || "Untitled").replace(/\s+/g, "_")}.pdf`);
  };

  const handlePaymentVerification = async () => {
    if (!utrNumber.trim() || !user) return;
    setLoading(true);
    const amount = selectedPlan === "monthly" ? 199 : 999;
    await supabase.from("payments").insert({
      user_id: user.id,
      user_email: user.email,
      user_name: user.user_metadata?.full_name || "Student",
      amount,
      plan: selectedPlan,
      utr_number: utrNumber
    });
    setPaymentSubmitted(true);
    setLoading(false);
  };

  // Generate UPI QR Code URL with automatic locked amount and currency
  const planAmount = selectedPlan === "monthly" ? 199 : 999;
  const upiPayload = `upi://pay?pa=${MY_ACTUAL_UPI_ID}&pn=LectureAI&am=${planAmount}.00&cu=INR&tn=Lecture%20AI%20${selectedPlan}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiPayload)}`;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-indigo-500">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#070b14]/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-white">Lecture AI</span>
            {profile.is_premium && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-bold">
                <Crown className="w-2.5 h-2.5" /> PRO
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {!profile.is_premium && (
              <button 
                onClick={() => setShowPricingModal(true)} 
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition"
              >
                <Crown className="w-3.5 h-3.5" /> Upgrade (₹199)
              </button>
            )}

            <button 
              onClick={() => setShowSettingsMenu(true)} 
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </button>

            {!user ? (
              <button 
                onClick={handleGoogleSignIn}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Sign In
              </button>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <span className="text-xs text-slate-400 hidden sm:inline">{user.email}</span>
                <button onClick={handleSignOut} className="p-2 rounded-xl bg-rose-950/40 text-rose-300 hover:bg-rose-900/50">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {!profile.is_premium && (
          <div className="mb-6 p-3 rounded-2xl bg-indigo-950/30 border border-indigo-800/40 flex items-center justify-between text-xs text-indigo-300">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Daily Syntheses: <strong>{profile.daily_syntheses_count} / 3 uploads used</strong> (Resets every 24h)
            </span>
            <button onClick={() => setShowPricingModal(true)} className="underline hover:text-white">Unlock Unlimited</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Input Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-4">
              <h2 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
                <UploadCloud className="w-4 h-4" /> Input Material
              </h2>

              <form onSubmit={handleFileUpload} className="space-y-3">
                <input type="file" id="doc" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <label htmlFor="doc" className="block border border-dashed border-slate-800 hover:border-indigo-500 p-4 rounded-xl text-center cursor-pointer text-xs text-slate-400">
                  {file ? file.name : "Select PDF or Document"}
                </label>
                <button type="submit" disabled={!file || loading} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Process File"}
                </button>
              </form>

              <div className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">OR</div>

              <form onSubmit={handleYoutubeSubmit} className="space-y-3">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                  <Video className="w-4 h-4 text-rose-400 shrink-0" />
                  <input 
                    type="url" 
                    placeholder="YouTube Video Link..." 
                    value={youtubeUrl} 
                    onChange={(e) => setYoutubeUrl(e.target.value)} 
                    className="bg-transparent outline-none w-full text-slate-200"
                  />
                </div>
                <button type="submit" disabled={!youtubeUrl || loading} className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 rounded-xl text-xs font-semibold disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Synthesize Link"}
                </button>
              </form>

              {error && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-8">
            {studyData && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setActiveTab("notes")} 
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium ${activeTab === "notes" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                      Notes
                    </button>
                    <button 
                      onClick={() => setActiveTab("flashcards")} 
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium ${activeTab === "flashcards" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                      Flashcards ({studyData.flashcards?.length || 0})
                    </button>
                    <button 
                      onClick={() => setActiveTab("quiz")} 
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-medium ${activeTab === "quiz" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                      Quiz ({studyData.quiz?.length || 0})
                    </button>
                  </div>

                  {/* Lock Protected PDF Button */}
                  <button 
                    onClick={handleDownloadPDF} 
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      profile.is_premium 
                        ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 hover:bg-emerald-600/30" 
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-amber-500 hover:text-amber-300"
                    }`}
                  >
                    {profile.is_premium ? <Download className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    {profile.is_premium ? "Download PDF" : "Download (Pro Only)"}
                  </button>
                </div>

                {/* 1. NOTES TAB */}
                {activeTab === "notes" && (
                  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl space-y-4">
                    <h2 className="text-xl font-bold text-white">{studyData.title || "Untitled"}</h2>
                    {studyData.summary && (
                      <p className="text-xs italic text-indigo-200 border-l-2 border-indigo-500 pl-3">
                        {studyData.summary}
                      </p>
                    )}
                    <div className="text-xs space-y-3 prose prose-invert leading-relaxed max-w-none">
                      <ReactMarkdown>{studyData.notes_markdown || ""}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* 2. FLASHCARDS TAB */}
                {activeTab === "flashcards" && (
                  <div className="space-y-4">
                    {(!studyData.flashcards || studyData.flashcards.length === 0) ? (
                      <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800">
                        No flashcards available for this topic.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {studyData.flashcards.map((fc, index) => {
                          const isFlipped = flippedCards[index] || false;
                          return (
                            <div 
                              key={index}
                              onClick={() => setFlippedCards(prev => ({ ...prev, [index]: !prev[index] }))}
                              className={`p-5 rounded-2xl border cursor-pointer transition-all duration-300 min-h-[160px] flex flex-col justify-between ${
                                isFlipped 
                                  ? "bg-indigo-950/40 border-indigo-500/60 text-slate-200" 
                                  : "bg-slate-900/80 border-slate-800 hover:border-slate-700 text-white"
                              }`}
                            >
                              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                <span>{fc.category || `Card #${index + 1}`}</span>
                                <span className="flex items-center gap-1 text-indigo-400">
                                  <RotateCcw className="w-3 h-3" /> {isFlipped ? "Answer" : "Question"}
                                </span>
                              </div>
                              <div className="my-3 text-sm font-medium">
                                {isFlipped ? fc.back : fc.front}
                              </div>
                              <div className="text-[10px] text-slate-500 text-right">
                                Click to {isFlipped ? "see question" : "flip"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. QUIZ TAB */}
                {activeTab === "quiz" && (
                  <div className="space-y-4">
                    {(!studyData.quiz || studyData.quiz.length === 0) ? (
                      <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800">
                        No quiz questions generated for this topic.
                      </div>
                    ) : (
                      studyData.quiz.map((q, qIndex) => {
                        const selected = selectedAnswers[qIndex];
                        const isAnswered = selected !== undefined;
                        const correctIdx = q.correct_index ?? (q.correct_answer ? q.options.indexOf(q.correct_answer) : -1);

                        return (
                          <div key={qIndex} className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3">
                            <p className="text-sm font-semibold text-white">
                              <span className="text-indigo-400 font-bold mr-1.5">Q{qIndex + 1}.</span>
                              {q.question}
                            </p>

                            <div className="space-y-2">
                              {q.options.map((opt, optIndex) => {
                                let btnStyle = "bg-slate-950 border-slate-800 text-slate-300 hover:border-indigo-500/60";
                                
                                if (isAnswered) {
                                  if (optIndex === correctIdx) {
                                    btnStyle = "bg-emerald-950/50 border-emerald-500 text-emerald-300 font-medium";
                                  } else if (selected === optIndex) {
                                    btnStyle = "bg-rose-950/50 border-rose-500 text-rose-300";
                                  } else {
                                    btnStyle = "bg-slate-950/50 border-slate-900 text-slate-500 opacity-60";
                                  }
                                }

                                return (
                                  <button
                                    key={optIndex}
                                    disabled={isAnswered}
                                    onClick={() => {
                                      setSelectedAnswers(prev => ({ ...prev, [qIndex]: optIndex }));
                                      setShowExplanations(prev => ({ ...prev, [qIndex]: true }));
                                    }}
                                    className={`w-full text-left p-3 rounded-xl border text-xs flex items-center justify-between transition ${btnStyle}`}
                                  >
                                    <span>{opt}</span>
                                    {isAnswered && optIndex === correctIdx && (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    )}
                                    {isAnswered && selected === optIndex && optIndex !== correctIdx && (
                                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {showExplanations[qIndex] && q.explanation && (
                              <div className="mt-2 p-3 bg-indigo-950/20 border border-indigo-800/40 rounded-xl text-xs text-indigo-300">
                                <strong>Explanation:</strong> {q.explanation}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>

      {/* SETTINGS MENU DRAWER */}
      {showSettingsMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 relative">
            <button onClick={() => setShowSettingsMenu(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="flex border-b border-slate-800 gap-6 text-xs font-semibold pb-3 mb-4">
              <button onClick={() => setSettingsActiveView("profile")} className={settingsActiveView === "profile" ? "text-indigo-400 border-b-2 border-indigo-500 pb-1" : "text-slate-400"}>Profile</button>
              <button onClick={() => setSettingsActiveView("history")} className={settingsActiveView === "history" ? "text-indigo-400 border-b-2 border-indigo-500 pb-1" : "text-slate-400"}>History</button>
              <button onClick={() => setSettingsActiveView("about")} className={settingsActiveView === "about" ? "text-indigo-400 border-b-2 border-indigo-500 pb-1" : "text-slate-400"}>About</button>
              <button onClick={() => setSettingsActiveView("help")} className={settingsActiveView === "help" ? "text-indigo-400 border-b-2 border-indigo-500 pb-1" : "text-slate-400"}>Help</button>
            </div>

            {settingsActiveView === "profile" && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                  <p className="text-slate-400">Email: <span className="text-white font-medium">{user?.email || "Not signed in"}</span></p>
                  <p className="text-slate-400">Subscription: <span className="text-amber-400 font-bold">{profile.is_premium ? `PRO (${profile.plan_type})` : "Free"}</span></p>
                  {profile.is_premium && (
                    <p className="text-slate-400">Expires: <span className="text-emerald-400">{profile.premium_expiry ? new Date(profile.premium_expiry).toLocaleDateString() : "Active"}</span></p>
                  )}
                </div>
              </div>
            )}

            {settingsActiveView === "history" && (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {userHistory.length === 0 ? <p className="text-xs text-slate-500">No saved history found.</p> : (
                  userHistory.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                      <span>{item.title || "Untitled"}</span>
                      <button onClick={() => { setStudyData(item.content); setShowSettingsMenu(false); }} className="text-indigo-400 hover:underline">Open</button>
                    </div>
                  ))
                )}
              </div>
            )}

            {settingsActiveView === "about" && (
              <div className="text-xs text-slate-300 space-y-2">
                <p><strong>Lecture AI</strong> transforms university notes and videos into structured study guides.</p>
              </div>
            )}

            {settingsActiveView === "help" && (
              <div className="text-xs text-slate-300 space-y-2">
                <p>• Free tier offers 3 uploads every 24 hours.</p>
                <p>• PDF download feature requires active Pro tier.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPGRADE MODAL - Auto-fills exact ₹199 or ₹999 on Scanner */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 relative">
            <button onClick={() => setShowPricingModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white">Upgrade to Pro</h3>
            <p className="text-xs text-slate-400 mb-4">Unlimited uploads, all history & PDF downloads.</p>

            {/* Plan Selector */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button 
                onClick={() => setSelectedPlan("monthly")} 
                className={`p-2.5 rounded-xl border text-left text-xs transition ${
                  selectedPlan === "monthly" 
                    ? "bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10" 
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <div>1 Month</div>
                <div className="font-bold text-indigo-300 text-base">₹199</div>
              </button>
              <button 
                onClick={() => setSelectedPlan("yearly")} 
                className={`p-2.5 rounded-xl border text-left text-xs transition ${
                  selectedPlan === "yearly" 
                    ? "bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10" 
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <div>1 Year</div>
                <div className="font-bold text-amber-300 text-base">₹999</div>
              </button>
            </div>

            {/* Automatic Amount Locked QR Code */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-2">
              <p className="text-xs text-slate-300 font-medium">
                Scan to pay exactly <span className="text-emerald-400 font-bold">₹{planAmount}</span>
              </p>
              <div className="w-44 h-44 mx-auto bg-white p-2 rounded-xl flex items-center justify-center shadow-md">
                <img 
                  src={qrCodeUrl} 
                  alt={`Pay ₹${planAmount} via UPI`} 
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                UPI ID: <strong className="text-indigo-300">{MY_ACTUAL_UPI_ID}</strong>
              </p>
            </div>

            {!paymentSubmitted ? (
              <div className="mt-3 space-y-2">
                <input 
                  type="text" 
                  placeholder="Enter 12-digit UPI UTR No." 
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-indigo-500"
                />
                <button 
                  onClick={handlePaymentVerification} 
                  disabled={!utrNumber.trim() || loading}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white disabled:opacity-50"
                >
                  Verify & Submit
                </button>
              </div>
            ) : (
              <div className="mt-3 p-2.5 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs rounded-xl text-center">
                UTR submitted! Plan will activate once verified.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}