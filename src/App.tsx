/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Megaphone, Clock } from 'lucide-react';
import { SchoolLogo } from './components/SchoolLogo';
import { GmailLoginForm } from './components/GmailLoginForm';
import { RoleSelectionDashboard } from './components/RoleSelectionDashboard';
import { AnnouncementPopupModal } from './components/AnnouncementPopupModal';
import { InactivityWarningModal } from './components/InactivityWarningModal';
import { SessionTimeoutModal } from './components/SessionTimeoutModal';
import {
  useInactivityTimeout,
  INACTIVITY_TIMEOUT_MS,
  WARNING_BEFORE_TIMEOUT_MS,
  ACU_LAST_ACTIVE_KEY,
} from './hooks/useInactivityTimeout';

export default function App() {
  // Check if session has expired prior to mount
  const [sessionTimedOut, setSessionTimedOut] = useState<boolean>(() => {
    try {
      const email = localStorage.getItem('acu_current_user_email');
      const lastActive = localStorage.getItem(ACU_LAST_ACTIVE_KEY);
      if (email && lastActive) {
        const diff = Date.now() - parseInt(lastActive, 10);
        if (diff >= INACTIVITY_TIMEOUT_MS) {
          localStorage.removeItem('acu_current_user_email');
          localStorage.removeItem('acu_user_role');
          localStorage.removeItem(ACU_LAST_ACTIVE_KEY);
          sessionStorage.clear();
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  });

  const [loggedInUser, setLoggedInUser] = useState<string | null>(() => {
    try {
      const email = localStorage.getItem('acu_current_user_email');
      const lastActive = localStorage.getItem(ACU_LAST_ACTIVE_KEY);
      if (email && lastActive) {
        const diff = Date.now() - parseInt(lastActive, 10);
        if (diff >= INACTIVITY_TIMEOUT_MS) {
          return null;
        }
      }
      if (email) {
        // Refresh active timestamp on valid existing session
        localStorage.setItem(ACU_LAST_ACTIVE_KEY, Date.now().toString());
      }
      return email;
    } catch {
      return null;
    }
  });

  const handleLogout = useCallback((reason?: 'manual' | 'timeout') => {
    setLoggedInUser(null);
    try {
      localStorage.removeItem('acu_current_user_email');
      localStorage.removeItem('acu_user_role');
      localStorage.removeItem(ACU_LAST_ACTIVE_KEY);
      sessionStorage.clear();
    } catch {
      // ignore
    }
    if (reason === 'timeout') {
      setSessionTimedOut(true);
    }
  }, []);

  const handleLoginSuccess = (email: string) => {
    setLoggedInUser(email);
    setSessionTimedOut(false);
    try {
      localStorage.setItem('acu_current_user_email', email);
      localStorage.setItem(ACU_LAST_ACTIVE_KEY, Date.now().toString());
    } catch {
      // ignore
    }
  };

  // Modern translucent gray popup open state for Page 1 (default open on visit)
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(() => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const hiddenDate = localStorage.getItem('acu_announcement_hidden_date');
      return hiddenDate !== todayStr;
    } catch {
      return true;
    }
  });

  // Track inactivity: auto-logout and bounce to login screen if inactive for 30 minutes
  const { showWarning, remainingSeconds, extendSession } = useInactivityTimeout({
    timeoutMs: INACTIVITY_TIMEOUT_MS,
    warningMs: WARNING_BEFORE_TIMEOUT_MS,
    isLoggedIn: Boolean(loggedInUser),
    onTimeout: () => handleLogout('timeout'),
  });

  // If user has logged in, show Page 2 (Role Selection Dashboard) with optional timeout warning
  if (loggedInUser) {
    return (
      <>
        <RoleSelectionDashboard
          userEmail={loggedInUser}
          onLogout={() => handleLogout('manual')}
        />
        {showWarning && (
          <InactivityWarningModal
            remainingSeconds={remainingSeconds}
            onStayLoggedIn={extendSession}
            onLogout={() => handleLogout('manual')}
          />
        )}
      </>
    );
  }

  return (
    <div
      id="main-login-viewport"
      className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden select-none bg-slate-900"
    >
      {/* Background Layer: International Educational Aesthetic */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Academic Image Backdrop with 45% Gaussian blur (4.5px) and 45% opacity */}
        <img
          src="/academic_bg.jpg"
          alt="International Academic Environment"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-45 scale-110 transition-transform duration-1000 ease-out"
          style={{ filter: 'blur(4.5px)' }}
        />
        
        {/* International modern ambient gradient mesh - keep upper left bright enough so blue/red text stands out clearly */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-900/90 to-blue-950/95" />
        
        {/* Soft atmospheric light orbs: gentle soft backlight behind the top-left logo & school text */}
        <div className="absolute -top-16 -left-16 w-[480px] h-[280px] bg-gradient-to-br from-white/12 via-sky-300/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/4 -right-32 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Subtle geometric dot grid for modern global tech feel */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Main Content Container (relative z-10) */}
      <div className="relative z-10 w-full flex flex-col flex-grow justify-between py-6 px-4 sm:px-8 md:px-12 max-w-7xl mx-auto">
        
        {/* =========================================================================
            บรรทัดที่ 1: ขอบซ้ายมือสุดเป็น รูปโลโก้โรงเรียนตามไฟล์ที่แนบมา
            ตามด้วยเป็นชื่อโรงเรียน Assumption College Ubonratchathani
            ชื่อฟอนต์ Roboto ขนาดพอดี สีนำเงินไล่เฉดแดงอ่านง่ายสวยสากล
           ========================================================================= */}
        <header
          id="row-1-school-identity"
          className="w-full flex items-center justify-between flex-wrap gap-4 pt-2 pb-4"
        >
          <div className="flex items-center gap-3.5 sm:gap-4.5">
            {/* ขอบซ้ายมือสุด: รูปโลโก้โรงเรียน (Clickable to change logo for Admin) */}
            <div className="flex-shrink-0">
              <SchoolLogo size="md" currentUserEmail={loggedInUser} />
            </div>

            {/* ตามด้วย: ชื่อโรงเรียน Assumption College Ubonratchathani */}
            <div className="flex flex-col justify-center">
              <h1
                id="school-name-text"
                className="font-['Roboto',sans-serif] font-black tracking-tight text-xl sm:text-2xl md:text-3xl select-none"
                style={{
                  background: 'linear-gradient(90deg, #60a5fa 0%, #93c5fd 32%, #f87171 78%, #ef4444 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.75)) drop-shadow(0 0 1px rgba(255, 255, 255, 0.4))',
                }}
              >
                Assumption College Ubonratchathani
              </h1>
              <p
                className="text-xs sm:text-sm font-semibold tracking-wider text-slate-200/90 drop-shadow-sm"
                style={{
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                }}
              >
                โรงเรียนอัสสัมชัญอุบลราชธานี
              </p>
            </div>
          </div>
        </header>

        {/* Center Content Section containing Row 2 and Row 3 */}
        <main className="w-full flex flex-col items-center justify-center my-auto py-6 sm:py-10">
          
          {/* =========================================================================
              บรรทัดที่ 2: ห่างลงมาตรงกลางเป็นตัวหนาใหญ่สมมาตรหนังสือคำว่า
              "ระบบคลังสื่อ และนวัตกรรมการเรียนรู้" สีม่วงเข้มขอบขาว
             ========================================================================= */}
          <div
            id="row-2-title-section"
            className="w-full max-w-4xl text-center mb-8 sm:mb-10 px-2 animate-in fade-in slide-in-from-top-4 duration-500"
          >
            <h2
              id="portal-main-heading"
              className="text-2xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-black text-center tracking-tight leading-tight text-purple-bordered select-none"
              style={{
                fontFamily: "'Prompt', sans-serif",
                color: '#2e0249',
                WebkitTextStroke: '2px #ffffff',
                paintOrder: 'stroke fill',
                textShadow: `
                  0 0 1px #ffffff,
                  0 0 2px #ffffff,
                  -2px -2px 0 #ffffff,
                  2px -2px 0 #ffffff,
                  -2px 2px 0 #ffffff,
                  2px 2px 0 #ffffff,
                  0 6px 18px rgba(0, 0, 0, 0.4)
                `,
              }}
            >
              ระบบคลังสื่อและนวัตกรรมการเรียนรู้
            </h2>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="h-0.5 w-8 sm:w-16 bg-gradient-to-r from-transparent to-blue-400 rounded-full" />
              <span className="text-xs sm:text-sm text-blue-200/90 font-medium tracking-wider uppercase">
                Learning Media & Innovation Repository
              </span>
              <span className="h-0.5 w-8 sm:w-16 bg-gradient-to-l from-transparent to-red-400 rounded-full" />
            </div>
          </div>

          {/* =========================================================================
              บรรทัดที่ 3: กล่องข้อความสำหรับลงชื่อเข้าใช้ด้วย Gmail
              พร้อมปุ่ม Login แบบโมเดิร์น ดีไซน์พื้นหลังสีสวยสากล
             ========================================================================= */}
          <section
            id="row-3-gmail-login-section"
            className="w-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-700"
          >
            {/* Session Timeout Banner if auto logged out */}
            {sessionTimedOut && (
              <div
                id="session-timeout-banner"
                className="w-full max-w-xl mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 backdrop-blur-md flex items-center justify-between gap-3 text-amber-200 shadow-lg animate-in fade-in slide-in-from-top-3 duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 flex-shrink-0">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-300">
                      ออกจากระบบอัตโนมัติ (Session Timeout)
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      ระบบได้ออกจากระบบอัตโนมัติเนื่องจากไม่มีการเข้าใช้งานเกิน 30 นาที กรุณาลงชื่อเข้าใช้ใหม่อีกครั้ง
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSessionTimedOut(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 text-sm font-semibold"
                  title="ปิดการแจ้งเตือน"
                >
                  ✕
                </button>
              </div>
            )}

            <GmailLoginForm onLoginSuccess={handleLoginSuccess} />
          </section>

        </main>

        {/* Elegant Minimal Footer */}
        <footer
          id="portal-footer"
          className="w-full text-center py-4 border-t border-white/10 text-xs text-slate-400/80 flex flex-col sm:flex-row items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ระบบบริการทางการศึกษาออนไลน์ พร้อมใช้งาน</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-reopen-announcement-popup"
              onClick={() => setIsAnnouncementOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/70 text-xs transition-colors shadow-xs"
              title="เปิดป๊อปอัปประกาศ/ภาพประชาสัมพันธ์"
            >
              <Megaphone className="w-3.5 h-3.5 text-amber-400" />
              <span>ป๊อปอัปประชาสัมพันธ์</span>
            </button>
            <p>© 2026 Assumption College Ubonratchathani. All Rights Reserved.</p>
          </div>
        </footer>

      </div>

      {/* Modern Translucent Gray Popup on Page 1 */}
      <AnnouncementPopupModal
        isOpen={isAnnouncementOpen}
        onClose={() => setIsAnnouncementOpen(false)}
      />

      {/* Session Timeout Explanatory Modal */}
      {sessionTimedOut && (
        <SessionTimeoutModal onClose={() => setSessionTimedOut(false)} />
      )}
    </div>
  );
}

